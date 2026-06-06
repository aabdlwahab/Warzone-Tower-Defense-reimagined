/* Core gameplay scene — server-driven rendering.
   All simulation runs on the backend.  This scene:
     • Paints static terrain + bases from the map JSON.
     • Reconciles enemy/tower Phaser sprites from each server snapshot.
     • Interpolates enemy positions so 10 Hz updates look smooth at 60 fps.
     • Plays shot/kill/leak/placed FX in sync with the interpolation lag.
     • Forwards build commands to the server on tile click.
     • Scales the camera to fit the full map in the play area (no panning). */

import Phaser from 'phaser';
import { paintMap } from '../map.js';
import {
  HUD_BAR_HEIGHT,
  INFANTRY_KINDS,
  TILE,
  TOP_BAR_HEIGHT,
  TOWERS,
  towerRangeAtLevel,
} from '../config.js';

// Render this many ms behind the live server stream so we always have two
// buffered snapshots to interpolate between.
const INTERP_DELAY = 120;
const BUFFER_MAX   = 30;
const RANGE_TEXTURE_KEY = 'range_ring_smooth';

// Projectile visual properties per tower kind.
const PROJ = {
  rifle:    { key: 'proj_bullet', ms: 220, color: 0xb8d8ff },
  mg:       { key: 'proj_tracer', ms: 160, color: 0xfff0a0 },
  mortar:   { key: 'proj_mortar', ms: 420, color: 0xff9900 },
  cannon:   { key: 'proj_shell',  ms: 300, color: 0xffb060 },
  at:       { key: 'proj_shell',  ms: 280, color: 0xffcc80 },
  flak:     { key: 'proj_bullet', ms: 160, color: 0xff6060 },
  howitzer: { key: 'proj_mortar', ms: 500, color: 0xff7700 },
  sniper:   { key: 'proj_bullet', ms: 180, color: 0xccffee },
  flame:    { key: 'proj_flame',  ms: 200, color: 0xff4400 },
  rocket:   { key: 'proj_rocket', ms: 320, color: 0xff9966 },
  bazooka:  { key: 'proj_rocket', ms: 260, color: 0xffaa44 },
  command:  { key: null,          ms: 0,   color: 0xffffff },
};

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  /* ------------------------------------------------------------------ */
  /*  Lifecycle                                                           */
  /* ------------------------------------------------------------------ */

  create() {
    this._net      = this.registry.get('net');
    this._myId     = this.registry.get('playerId');
    const snapshot = this.registry.get('snapshot');

    const mapData  = this.cache.json.get('map_data');
    paintMap(this, mapData);
    this._mapPixelWidth = mapData?.width ?? (snapshot?.map?.cols ?? 0) * TILE ?? this.scale.width;
    this._mapPixelHeight = mapData?.height ?? (snapshot?.map ? snapshot.map.rows * snapshot.map.tile : this.scale.height);
    // _playViewportHeight is initialised by _layoutCamera() below.

    this._buffer   = [];
    this._pending  = [];
    this._enemies  = new Map();   // id -> { spr, bar, barBg, maxHp }
    this._towers   = new Map();   // id -> { base, gun, kind, team, tile }
    this._buildable = new Set();  // "x,y"
    this._myTeam   = '';
    this._selected = null;
    this._inspectedTower = null;
    this._hover    = null;
    this._snapshot = null;

    this._topBarHeight = this.registry.get('topBarHeight') ?? TOP_BAR_HEIGHT;

    this._overlayG = this.add.graphics().setDepth(20);
    this._ensureRangeTexture();
    this._rangeSprite = this.add.image(0, 0, RANGE_TEXTURE_KEY)
      .setDepth(19)
      .setVisible(false)
      .setOrigin(0.5);

    this._onCameraResize = () => this._layoutCamera();
    this._layoutCamera();

    this.scale.on('resize', this._onCameraResize);
    this.events.once('shutdown', () => this.scale.off('resize', this._onCameraResize));

    this._bindInput();
    this._listenNet();

    if (snapshot) this._handleSnapshot(snapshot, []);

    this.game.events.on('selectTower', k => {
      this._selected = k;
      if (k) this._inspectedTower = null;
    });
    this._net.onClose(() => this.game.events.emit('disconnect'));
  }

  update(time, delta) {
    const d = delta / 1000;

    // Fire deferred events whose render time has arrived.
    while (this._pending.length && this._pending[0].t <= time) {
      for (const ev of this._pending.shift().events) this._playEvent(ev);
    }

    // Interpolated enemy positions.
    const interp = this._interpolate(time - INTERP_DELAY);
    if (interp) this._renderEnemies(interp);

    // Rotate tower guns toward nearest visible enemy.
    for (const [, tw] of this._towers) {
      if (!tw.gun) continue;
      if (tw.shotLockUntil && time < tw.shotLockUntil) continue;
      const def = TOWERS[tw.kind];
      if (!def?.range) { tw.gun.rotation += (def?.turn ?? 0.6) * d; continue; }
      const target = this._nearestEnemy(tw.tile.x, tw.tile.y, towerRangeAtLevel(tw.kind, tw.level ?? 1), tw.team, interp);
      if (target) {
        const cx = (tw.tile.x + 0.5) * TILE, cy = (tw.tile.y + 0.5) * TILE;
        const angle = Math.atan2(target.position.y * TILE - cy, target.position.x * TILE - cx);
        tw.gun.rotation = Phaser.Math.Angle.RotateTo(tw.gun.rotation, angle, (def.turn ?? 4) * d);
      }
    }

    this._drawBuildPreview();
  }

  /* ------------------------------------------------------------------ */
  /*  Networking                                                          */
  /* ------------------------------------------------------------------ */

  _listenNet() {
    this._net.on(msg => {
      if (msg.type === 'snapshot')   this._handleSnapshot(msg.payload, msg.events ?? []);
      else if (msg.type === 'error') this.game.events.emit('serverError', msg.message);
    });
  }

  _handleSnapshot(state, events) {
    const t = this.time.now;

    this._buffer.push({ t, state });
    if (this._buffer.length > BUFFER_MAX) this._buffer.shift();

    this._reconcileTowers(state.towers);
    // map.buildable is only present in the initial joined snapshot, not in
    // per-tick state updates — skip the sync when the data isn't there.
    if (state.map?.buildable) this._syncBuildable(state.map.buildable);

    if (!this._myTeam) {
      const me = state.players.find(p => p.id === this._myId);
      if (me) this._myTeam = me.team;
    }

    this._snapshot = state;
    if (events.length) this._pending.push({ t, events });

    const me     = state.players.find(p => p.id === this._myId);
    const myBase = (state.bases ?? []).find(b => b.team === this._myTeam);
    this.game.events.emit('stats', {
      money:        me?.money         ?? 0,
      baseHP:       myBase?.health    ?? 0,
      maxHP:        myBase?.max_health ?? 100,
      wave:         state.wave,
      totalWaves:   10,
      status:       state.status,
      waveActive:   state.wave_active,
      prepRemaining: state.prep_remaining ?? 0,
      players:      state.players,
      bases:        state.bases ?? [],
      winner:       state.winner ?? null,
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Interpolation                                                       */
  /* ------------------------------------------------------------------ */

  _interpolate(renderTime) {
    const buf = this._buffer;
    if (!buf.length) return null;
    if (buf.length === 1 || renderTime <= buf[0].t) return buf[0].state;

    let i = buf.length - 2;
    while (i > 0 && buf[i].t > renderTime) i--;

    const f0 = buf[i], f1 = buf[i + 1];
    const span = f1.t - f0.t;
    const alpha = span > 0 ? Phaser.Math.Clamp((renderTime - f0.t) / span, 0, 1) : 1;
    if (alpha >= 1) return f1.state;

    const prevById = {};
    for (const e of f0.state.enemies) prevById[e.id] = e;

    const enemies = f1.state.enemies.map(e => {
      const e0 = prevById[e.id];
      if (!e0) return e;
      return {
        ...e,
        position: {
          x: e0.position.x + (e.position.x - e0.position.x) * alpha,
          y: e0.position.y + (e.position.y - e0.position.y) * alpha,
        },
      };
    });

    return { ...f1.state, enemies };
  }

  /* ------------------------------------------------------------------ */
  /*  Enemy sprites                                                       */
  /* ------------------------------------------------------------------ */

  _renderEnemies(state) {
    const T = TILE;
    const seen = new Set();

    for (const e of state.enemies) {
      seen.add(e.id);
      const px = e.position.x * T, py = e.position.y * T;

      if (this._enemies.has(e.id)) {
        const obj = this._enemies.get(e.id);
        obj.spr.x = px; obj.spr.y = py;
        obj.spr.rotation = e.heading ?? 0;
        const ratio = Math.max(0, e.health / (obj.maxHp || 1));
        obj.bar.x = obj.barBg.x = px;
        obj.bar.y = obj.barBg.y = py - obj.spr.height * 0.55;
        obj.bar.width = 28 * ratio;
        obj.bar.fillColor = ratio > 0.5 ? 0x3fd56a : ratio > 0.25 ? 0xffcf3f : 0xe8413a;
      } else {
        this._spawnEnemySprite(e, px, py);
      }
    }

    for (const [id, obj] of this._enemies) {
      if (!seen.has(id)) {
        obj.spr.destroy(); obj.bar.destroy(); obj.barBg.destroy();
        this._enemies.delete(id);
      }
    }
  }

  _spawnEnemySprite(e, px, py) {
    let spr;
    if (INFANTRY_KINDS.has(e.kind)) {
      spr = this.add.sprite(px, py, `unit_${e.kind}_p0`, 0).play(`unit_${e.kind}_p0`);
    } else {
      spr = this.add.image(px, py, `unit_${e.kind}_p0`);
    }
    spr.setDepth(8);
    if (e.kind === 'boss') spr.setScale(1.1);

    const barBg = this.add.rectangle(px, py - spr.height * 0.55, 28, 4, 0x000000).setDepth(8).setAlpha(0.5);
    const bar   = this.add.rectangle(px, py - spr.height * 0.55, 28, 4, 0x3fd56a).setDepth(9);
    this._enemies.set(e.id, { spr, bar, barBg, maxHp: e.health });
  }

  /* ------------------------------------------------------------------ */
  /*  Tower sprites                                                       */
  /* ------------------------------------------------------------------ */

  _reconcileTowers(towers) {
    const T = TILE;
    const serverIds = new Set(towers.map(t => t.id));

    for (const [id, obj] of this._towers) {
      if (!serverIds.has(id)) {
        obj.base?.destroy(); obj.gun?.destroy(); obj.badge?.destroy();
        this._towers.delete(id);
        if (this._inspectedTower?.id === id) {
          this._inspectedTower = null;
          this.game.events.emit('towerInspect', null);
        }
      }
    }

    for (const t of towers) {
      if (this._towers.has(t.id)) {
        const obj = this._towers.get(t.id);
        obj.owner_id = t.owner_id;
        obj.level = t.level;
        obj.badge?.setText(t.level > 1 ? `L${t.level}` : '').setVisible(t.level > 1);
        continue;
      }
      const team = t.team || 'p1';
      const cx = (t.x + 0.5) * T, cy = (t.y + 0.5) * T;
      const base = this.add.image(cx, cy, `tower_${t.kind}_base_${team}`).setDepth(6);
      const gun  = this.add.image(cx, cy, `tower_${t.kind}_gun_${team}`).setDepth(7);
      const badge = this.add.text(cx + 15, cy - 18, t.level > 1 ? `L${t.level}` : '', {
        fontFamily: 'monospace',
        fontSize: 10,
        color: '#ffcf3f',
        fontStyle: 'bold',
        backgroundColor: '#050608',
        padding: { x: 3, y: 1 },
      }).setOrigin(0.5).setDepth(8).setVisible(t.level > 1);
      this._towers.set(t.id, {
        base,
        gun,
        badge,
        id: t.id,
        owner_id: t.owner_id,
        kind: t.kind,
        team,
        level: t.level,
        tile: { x: t.x, y: t.y },
      });
    }
  }

  _syncBuildable(list) {
    this._buildable.clear();
    for (const { x, y } of list) this._buildable.add(`${x},${y}`);
  }

  /* ------------------------------------------------------------------ */
  /*  FX events                                                           */
  /* ------------------------------------------------------------------ */

  _playEvent(ev) {
    const T = TILE;
    switch (ev.type) {
      case 'shot':     this._shotFx(ev); break;
      case 'kill':     this._killFx(ev.x * T, ev.y * T, ev.kind === 'boss'); break;
      case 'leak':     this._leakFx(ev.x * T, ev.y * T); break;
      case 'unit_upgraded': this.game.events.emit('unitUpgraded', ev); break;
      case 'placed':
      case 'upgraded':
        this._smokeFx((ev.x + 0.5) * T, (ev.y + 0.5) * T, 0.6);
        if (ev.type === 'upgraded') this.game.events.emit('towerUpgraded', ev);
        break;
      case 'eliminated': {
        const base = this._snapshot?.bases?.find(b => b.team === ev.team);
        if (base) this._killFx((base.x + 0.5) * T, (base.y + 0.5) * T, true);
        break;
      }
    }
  }

  _shotFx(ev) {
    const T = TILE;
    const p = PROJ[ev.kind] ?? PROJ.rifle;
    if (!p.key) return;
    const sx = ev.x * T, sy = ev.y * T, ex = ev.tx * T, ey = ev.ty * T;
    const angle = Math.atan2(ey - sy, ex - sx);
    const tower = this._towers.get(ev.tower_id);
    if (tower?.gun) {
      tower.gun.rotation = angle;
      tower.shotLockUntil = this.time.now + 90;
    }
    const tipX  = sx + Math.cos(angle) * 22;
    const tipY  = sy + Math.sin(angle) * 22;
    this._muzzleFx(tipX, tipY, angle, p.color);
    this._projectileFx(tipX, tipY, ex, ey, angle, p);
  }

  _muzzleFx(x, y, angle, color) {
    const s = this.add.sprite(x, y, 'fx_muzzle', 0).setDepth(11).setScale(0.72)
               .setRotation(angle).setTint(color).play('fx_muzzle');
    s.once('animationcomplete', () => s.destroy());
    this.time.delayedCall(220, () => { if (s.active) s.destroy(); });
  }

  _projectileFx(sx, sy, ex, ey, angle, p) {
    const dist     = Phaser.Math.Distance.Between(sx, sy, ex, ey);
    const duration = Phaser.Math.Clamp(dist * 1.05, 80, p.ms);
    const shot  = this.add.image(sx, sy, p.key).setDepth(10).setScale(0.78)
                   .setRotation(angle).setTint(p.color);
    const trail = this.add.graphics().setDepth(9);
    const prog  = { v: 0 };

    this.tweens.add({
      targets: shot, x: ex, y: ey, duration, ease: 'Quad.easeOut',
      onUpdate: () => {
        const tail = Math.max(0, prog.v - 0.22);
        trail.clear();
        trail.lineStyle(4, p.color, 0.28);
        trail.lineBetween(Phaser.Math.Linear(sx, ex, tail), Phaser.Math.Linear(sy, ey, tail), shot.x, shot.y);
        trail.lineStyle(1, 0xffffff, 0.65);
        trail.lineBetween(Phaser.Math.Linear(sx, ex, tail), Phaser.Math.Linear(sy, ey, tail), shot.x, shot.y);
      },
      onComplete: () => {
        trail.destroy(); shot.destroy();
        this._impactFx(ex, ey, angle, p.color);
      },
    });
    this.tweens.add({ targets: prog, v: 1, duration, ease: 'Quad.easeOut' });
  }

  _impactFx(x, y, angle, color) {
    const s = this.add.sprite(x, y, 'fx_impact', 0).setDepth(12).setScale(0.82)
               .setRotation(angle).setTint(color).play('fx_impact');
    s.once('animationcomplete', () => s.destroy());
    this.time.delayedCall(300, () => { if (s.active) s.destroy(); });
  }

  _killFx(x, y, big = false) {
    const key   = big ? 'fx_explosion_big' : 'fx_explosion';
    const scale = big ? 0.9 : 0.78;
    const s = this.add.sprite(x, y, key, 0).setDepth(13).setScale(scale).play(key);
    s.once('animationcomplete', () => s.destroy());
    this.time.delayedCall(520, () => this._smokeFx(x, y, 0.68));
    this.time.delayedCall(700, () => { if (s.active) s.destroy(); });
  }

  _leakFx(x, y) {
    this._smokeFx(x, y, 0.92);
    this.time.delayedCall(60, () => this._killFx(x, y));
  }

  _smokeFx(x, y, scale) {
    const s = this.add.sprite(x, y, 'fx_smoke', 0).setDepth(12).setScale(scale).play('fx_smoke');
    s.once('animationcomplete', () => s.destroy());
    this.time.delayedCall(560, () => { if (s.active) s.destroy(); });
  }

  /* ------------------------------------------------------------------ */
  /*  Camera — fit the whole map in the play viewport                     */
  /* ------------------------------------------------------------------ */

  _layoutCamera() {
    const hudH = this.registry.get('hudHeight') ?? HUD_BAR_HEIGHT;
    this._playViewportHeight = this.scale.height - hudH;

    const cam = this.cameras.main;
    const viewW = this.scale.width;
    const viewH = Math.max(1, this._playViewportHeight - this._topBarHeight);

    // Fit the whole map into the band between the top bar and the HUD; never
    // zoom past 1:1 if the map is smaller than the band.
    const fitZoom = Math.min(1, viewW / this._mapPixelWidth, viewH / this._mapPixelHeight);

    cam.setViewport(0, this._topBarHeight, viewW, viewH);
    cam.setBounds(0, 0, this._mapPixelWidth, this._mapPixelHeight);
    cam.setZoom(fitZoom);
    cam.centerOn(this._mapPixelWidth / 2, this._mapPixelHeight / 2);
  }

  /* ------------------------------------------------------------------ */
  /*  Input & build preview                                               */
  /* ------------------------------------------------------------------ */

  _bindInput() {
    const insidePlayArea = (p) =>
      p.y >= this._topBarHeight && p.y < this._playViewportHeight;

    this.input.on('pointermove', (p) => {
      this._hover = insidePlayArea(p)
        ? { x: Math.floor(p.worldX / TILE), y: Math.floor(p.worldY / TILE) }
        : null;
    });

    this.input.on('pointerup', (p) => {
      if (!insidePlayArea(p) || !this._hover) return;
      const { x, y } = this._hover;

      if (this._selected && this._canBuild(x, y)) {
        this._net.place(this._selected, x, y);
        this._inspectedTower = null;
        this.game.events.emit('towerInspect', null);
        return;
      }

      if (!this._selected) {
        this._inspectedTower = this._towerAt(x, y);
        this.game.events.emit('towerInspect', this._inspectedTower);
      }
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      this._selected = null;
      this._inspectedTower = null;
      this.game.events.emit('deselect');
      this.game.events.emit('towerInspect', null);
    });

    this.input.on('gameout', () => { this._hover = null; });
  }

  _canBuild(x, y) {
    return this._buildable.has(`${x},${y}`) && !this._hasTowerAt(x, y);
  }

  _hasTowerAt(x, y) {
    return this._towerAt(x, y) !== null;
  }

  _towerAt(x, y) {
    for (const [, t] of this._towers) {
      if (t.tile.x === x && t.tile.y === y) return t;
    }
    return null;
  }

  _drawBuildPreview() {
    this._overlayG.clear();
    this._rangeSprite.setVisible(false);
    if (!this._selected && this._inspectedTower) {
      this._drawTowerInspect();
      return;
    }
    if (!this._selected || !this._hover) return;
    const { x, y } = this._hover;
    const T = TILE;
    const ok    = this._canBuild(x, y);
    const color = ok ? 0x77c84a : 0xe8413a;
    this._overlayG.fillStyle(color, ok ? 0.18 : 0.28);
    this._overlayG.fillRect(x * T + 2, y * T + 2, T - 4, T - 4);
    this._overlayG.lineStyle(2, color, 0.8);
    this._overlayG.strokeRect(x * T + 3, y * T + 3, T - 6, T - 6);
    const def = TOWERS[this._selected];
    if (def?.range && ok) {
      const cx = (x + 0.5) * T;
      const cy = (y + 0.5) * T;
      this._showRangeRing(cx, cy, def.range, 0.9);
    }
  }

  _drawTowerInspect() {
    const tower = this._inspectedTower;
    if (!tower) return;

    const T = TILE;
    const cx = (tower.tile.x + 0.5) * T;
    const cy = (tower.tile.y + 0.5) * T;
    const range = towerRangeAtLevel(tower.kind, tower.level ?? 1);
    this._showRangeRing(cx, cy, range, 1);
    this._overlayG.lineStyle(3, 0xffcf3f, 0.95);
    this._overlayG.strokeRect(tower.tile.x * T + 4, tower.tile.y * T + 4, T - 8, T - 8);
  }

  _ensureRangeTexture() {
    if (this.textures.exists(RANGE_TEXTURE_KEY)) return;

    const size = 1024;
    const canvas = this.textures.createCanvas(RANGE_TEXTURE_KEY, size, size);
    const ctx = canvas.getContext();
    const center = size / 2;
    const radius = center - 8;

    ctx.clearRect(0, 0, size, size);
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 207, 63, 0.07)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = 10;
    ctx.strokeStyle = 'rgba(5, 6, 8, 0.66)';
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 207, 63, 0.96)';
    ctx.stroke();
    canvas.refresh();
  }

  _showRangeRing(x, y, radius, alpha) {
    const textureSize = this.textures.get(RANGE_TEXTURE_KEY).getSourceImage().width;
    const drawnRadius = textureSize / 2 - 8;
    const scale = radius / drawnRadius;
    this._rangeSprite
      .setPosition(x, y)
      .setScale(scale)
      .setAlpha(alpha)
      .setVisible(true);
  }

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                             */
  /* ------------------------------------------------------------------ */

  _nearestEnemy(tileX, tileY, rangePx, team, interp) {
    if (!interp) return null;
    const cx = (tileX + 0.5) * TILE, cy = (tileY + 0.5) * TILE;
    let best = null, bestDist = Infinity;
    for (const e of interp.enemies) {
      if (e.target !== team) continue;
      const d = Phaser.Math.Distance.Between(cx, cy, e.position.x * TILE, e.position.y * TILE);
      if (d <= rangePx && d < bestDist) { bestDist = d; best = e; }
    }
    return best;
  }
}
