/* Core gameplay scene — terrain, lane, bases, units, towers, combat. */
import Phaser from 'phaser';
import {
  TILE, COLS, ROWS, LANE, TEAM_COLORS, PLAYER_TEAM, PLAYER_COUNT,
  TOWERS, UNITS, WAVES, START_MONEY, START_BASE_HP,
} from '../config.js';

const g2 = (gx, gy) => ({ x: gx * TILE + TILE / 2, y: gy * TILE + TILE / 2 });

export default class Game extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    this.money = START_MONEY;
    this.baseHP = START_BASE_HP;
    this.waveIndex = 0;
    this.running = false;
    this.selectedTower = null;     // tower key chosen in HUD for placing
    this.occupied = new Set();     // "gx,gy" tiles with a tower
    this.towers = [];
    this.units = this.add.group();
    this.projectiles = this.add.group();

    this.buildTerrain();
    this.buildLane();
    this.buildBases();
    this.bindInput();
    this.syncHud();

    // HUD -> Game commands
    this.game.events.on('selectTower', k => { this.selectedTower = k; this.updateGhost(); });
    this.game.events.on('startWave', () => this.startWave());
    this.game.events.on('setSpeed', s => { this.time.timeScale = s; this.physics ? 0 : 0; this.tweens.timeScale = s; this.unitTimeScale = s; });
    this.unitTimeScale = 1;
  }

  /* ---------------- map ---------------- */
  buildTerrain() {
    this.add.rectangle(0, 0, COLS * TILE, ROWS * TILE, 0x3c5a2e).setOrigin(0);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const key = (x * 7 + y * 3) % 5 === 0 ? 'tile_grass2' : 'tile_grass';
      this.add.image(x * TILE, y * TILE, key).setOrigin(0);
    }
    // a few props off-lane
    [['deco_tree',1,1],['deco_tree',2,11],['deco_bush',17,1],['deco_rock',6,8],
     ['deco_hedgehog',12,3],['deco_crate',16,11],['deco_barrel',7,11],['deco_tree',18,10]]
      .forEach(([k,gx,gy]) => this.add.image(...Object.values(g2(gx,gy)), k).setDepth(2));
  }

  buildLane() {
    // mark lane tiles + place path sprites along segments
    this.laneTiles = new Set();
    const path = new Phaser.Curves.Path();
    const p0 = g2(LANE[0].x, LANE[0].y);
    path.moveTo(p0.x, p0.y);
    for (let i = 1; i < LANE.length; i++) { const p = g2(LANE[i].x, LANE[i].y); path.lineTo(p.x, p.y); }
    this.lanePath = path;

    // stamp dirt path tiles on each grid cell the lane crosses
    for (let i = 0; i < LANE.length - 1; i++) {
      const a = LANE[i], b = LANE[i + 1];
      const dx = Math.sign(b.x - a.x), dy = Math.sign(b.y - a.y);
      let x = a.x, y = a.y;
      while (x !== b.x || y !== b.y) {
        this.stampLane(x, y); x += dx; y += dy;
      }
      this.stampLane(b.x, b.y);
    }
  }
  stampLane(gx, gy) {
    if (gx < 0 || gx >= COLS) return;
    const id = gx + ',' + gy;
    if (this.laneTiles.has(id)) return;
    this.laneTiles.add(id);
    // pick connection mask by neighbours in lane sequence -> use cross-ish; visual only
    this.add.image(gx * TILE, gy * TILE, 'tile_dirt').setOrigin(0).setDepth(1);
  }

  buildBases() {
    // local player's HQ at the lane end; other players' HQs decorate corners
    const end = LANE[LANE.length - 1];
    const ep = g2(end.x, end.y);
    this.base = this.add.image(ep.x, ep.y, 'base_hq_' + PLAYER_TEAM).setDepth(5);
    this.basePos = ep;

    const others = Object.keys(TEAM_COLORS).filter(t => t !== 'p0' && t !== PLAYER_TEAM).slice(0, PLAYER_COUNT - 1);
    const spots = [g2(2, 2), g2(2, 10), g2(17, 2)];
    others.forEach((t, i) => { if (spots[i]) this.add.image(spots[i].x, spots[i].y, 'base_hq_' + t).setDepth(5).setScale(0.7).setAlpha(0.92); });
  }

  /* ---------------- waves / units ---------------- */
  startWave() {
    if (this.running || this.waveIndex >= WAVES.length) return;
    this.running = true;
    this._pendingSpawns = 0;
    const groups = WAVES[this.waveIndex];
    groups.forEach((grp, gi) => {
      for (let n = 0; n < grp.count; n++) {
        this._pendingSpawns++;
        this.time.delayedCall(gi * 400 + n * grp.gap, () => { this._pendingSpawns--; this.spawnUnit(grp.unit); });
      }
    });
    this.game.events.emit('wave', { index: this.waveIndex + 1, total: WAVES.length });
  }

  spawnUnit(key) {
    const def = UNITS[key];
    const start = this.lanePath.getStartPoint();
    let spr;
    if (def.kind === 'inf') {
      spr = this.add.sprite(start.x, start.y, 'unit_' + key + '_p0', 0).play('unit_' + key + '_p0');
    } else {
      spr = this.add.sprite(start.x, start.y, 'unit_' + key + '_p0');
    }
    spr.setDepth(8);
    if (def.boss) spr.setScale(1);
    spr.hp = def.hp; spr.maxHp = def.hp; spr.def = def; spr.unitKey = key;
    spr.t = 0; spr.speedT = def.speed / this.lanePath.getLength();
    // hp bar
    spr.bar = this.add.rectangle(start.x, start.y - spr.height * 0.6, 30, 4, 0x3fd56a).setDepth(9);
    spr.barBg = this.add.rectangle(start.x, start.y - spr.height * 0.6, 30, 4, 0x000000).setDepth(8).setAlpha(0.5);
    this.units.add(spr);
  }

  damageUnit(spr, dmg) {
    if (!spr.active) return;
    spr.hp -= dmg;
    if (spr.hp <= 0) {
      this.money += spr.def.reward;
      this.spawnFx(spr.def.boss ? 'fx_explosion_big' : 'fx_explosion', spr.x, spr.y);
      this.killUnit(spr);
      this.syncHud();
    }
  }
  killUnit(spr) { spr.bar.destroy(); spr.barBg.destroy(); spr.destroy(); }

  spawnFx(key, x, y) {
    const s = this.add.sprite(x, y, key, 0).setDepth(20).play(key);
    s.once('animationcomplete', () => s.destroy());
  }

  update(time, dt) {
    const d = dt / 1000 * (this.unitTimeScale || 1);
    // units
    this.units.children.each(spr => {
      if (!spr.active) return;
      spr.t += spr.speedT * d;
      if (spr.t >= 1) { // reached base
        this.baseHP = Math.max(0, this.baseHP - spr.def.dmg);
        this.spawnFx('fx_explosion', this.basePos.x, this.basePos.y);
        this.killUnit(spr); this.syncHud();
        if (this.baseHP <= 0) this.gameOver();
        return;
      }
      const pt = this.lanePath.getPoint(spr.t);
      const ang = this.lanePath.getTangent(spr.t);
      spr.x = pt.x; spr.y = pt.y;
      spr.rotation = Math.atan2(ang.y, ang.x);
      spr.bar.x = spr.barBg.x = pt.x; spr.bar.y = spr.barBg.y = pt.y - spr.height * 0.6;
      spr.bar.width = 30 * Math.max(0, spr.hp / spr.maxHp);
      spr.bar.fillColor = spr.hp / spr.maxHp > 0.5 ? 0x3fd56a : spr.hp / spr.maxHp > 0.25 ? 0xffcf3f : 0xe8413a;
    });
    // towers + projectiles handled in tower file (mixed in)
    this.updateTowers(time, d);
    this.updateProjectiles(d);

    if (this.running && this.units.getLength() === 0 && !this.spawningLeft()) {
      this.running = false;
      this.waveIndex++;
      this.money += 60 + this.waveIndex * 12;
      this.syncHud();
      this.game.events.emit('waveCleared', { next: this.waveIndex, total: WAVES.length });
      if (this.waveIndex >= WAVES.length) this.victory();
    }
  }
  spawningLeft() { return (this._pendingSpawns || 0) > 0; }

  /* ---------------- placement / input ---------------- */
  bindInput() {
    this.input.on('pointermove', p => {
      if (this.ghost) {
        const gx = Math.floor(p.worldX / TILE), gy = Math.floor(p.worldY / TILE);
        const c = g2(gx, gy);
        this.ghost.setPosition(c.x, c.y);
        this.ghostGun.setPosition(c.x, c.y);
        this.ghostRange.setPosition(c.x, c.y);
        const ok = this.canBuild(gx, gy);
        this.ghost.setTint(ok ? 0xffffff : 0xff5555);
        this.ghostGun.setTint(ok ? 0xffffff : 0xff5555);
        this.ghostRange.setStrokeStyle(2, ok ? 0x77c84a : 0xe8413a);
      }
    });
    this.input.on('pointerdown', p => {
      if (!this.selectedTower) return;
      const gx = Math.floor(p.worldX / TILE), gy = Math.floor(p.worldY / TILE);
      if (this.canBuild(gx, gy) && this.money >= TOWERS[this.selectedTower].cost) {
        this.placeTower(this.selectedTower, gx, gy);
      }
    });
    this.input.keyboard.on('keydown-ESC', () => { this.selectedTower = null; this.updateGhost(); this.game.events.emit('deselect'); });
  }

  canBuild(gx, gy) {
    if (gx < 0 || gy < 0 || gx >= COLS || gy >= ROWS) return false;
    const id = gx + ',' + gy;
    if (this.laneTiles.has(id) || this.occupied.has(id)) return false;
    // keep clear of the HQ footprint
    const end = LANE[LANE.length - 1];
    if (Math.abs(gx - end.x) <= 1 && Math.abs(gy - end.y) <= 1) return false;
    return true;
  }

  updateGhost() {
    if (this.ghost) { this.ghost.destroy(); this.ghostGun.destroy(); this.ghostRange.destroy(); this.ghost = null; }
    if (!this.selectedTower) return;
    const k = this.selectedTower, t = PLAYER_TEAM;
    this.ghostRange = this.add.circle(-99, -99, TOWERS[k].range, 0x77c84a, 0.10).setStrokeStyle(2, 0x77c84a).setDepth(30);
    this.ghost = this.add.image(-99, -99, 'tower_' + k + '_base_' + t).setDepth(31).setAlpha(0.7);
    this.ghostGun = this.add.image(-99, -99, 'tower_' + k + '_gun_' + t).setDepth(32).setAlpha(0.7);
  }

  placeTower(key, gx, gy) {
    const def = TOWERS[key], t = PLAYER_TEAM, c = g2(gx, gy);
    this.money -= def.cost;
    this.occupied.add(gx + ',' + gy);
    const base = this.add.image(c.x, c.y, 'tower_' + key + '_base_' + t).setDepth(6);
    const gun = this.add.image(c.x, c.y, 'tower_' + key + '_gun_' + t).setDepth(7);
    const tw = { key, def, x: c.x, y: c.y, base, gun, last: 0, team: t };
    if (def.income) this.time.addEvent({ delay: 3000, loop: true, callback: () => { this.money += def.income; this.syncHud(); } });
    this.towers.push(tw);
    this.syncHud();
  }

  /* ---------------- combat ---------------- */
  updateTowers(time, d) {
    for (const tw of this.towers) {
      if (!tw.def.range) { tw.gun.rotation += tw.def.turn * d; continue; } // command spins idly
      const target = this.findTarget(tw);
      if (target) {
        const ang = Math.atan2(target.y - tw.y, target.x - tw.x);
        tw.gun.rotation = Phaser.Math.Angle.RotateTo(tw.gun.rotation, ang, tw.def.turn * d);
        if (time - tw.last >= tw.def.cd && Math.abs(Phaser.Math.Angle.Wrap(ang - tw.gun.rotation)) < 0.25) {
          tw.last = time; this.fire(tw, target, ang);
        }
      }
    }
  }

  findTarget(tw) {
    let best = null, bestT = -1;
    this.units.children.each(u => {
      if (!u.active) return;
      const dist = Phaser.Math.Distance.Between(tw.x, tw.y, u.x, u.y);
      if (dist <= tw.def.range && u.t > bestT) { bestT = u.t; best = u; } // target unit furthest along lane
    });
    return best;
  }

  fire(tw, target, ang) {
    const tipX = tw.x + Math.cos(ang) * 22, tipY = tw.y + Math.sin(ang) * 22;
    const mf = this.add.sprite(tipX, tipY, 'fx_muzzle', 0).setDepth(8).setRotation(ang).play('fx_muzzle');
    mf.once('animationcomplete', () => mf.destroy());
    const p = this.add.image(tipX, tipY, tw.def.proj).setDepth(8).setRotation(ang);
    p.dmg = tw.def.dmg; p.splash = tw.def.splash; p.speed = 520;
    p.target = target; p.tx = target.x; p.ty = target.y;
    this.projectiles.add(p);
  }

  updateProjectiles(d) {
    this.projectiles.children.each(p => {
      if (!p.active) return;
      // home toward live target, else last known point
      if (p.target && p.target.active) { p.tx = p.target.x; p.ty = p.target.y; }
      const ang = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.rotation = ang;
      const step = p.speed * d;
      const dist = Phaser.Math.Distance.Between(p.x, p.y, p.tx, p.ty);
      if (dist <= step) { this.impact(p); return; }
      p.x += Math.cos(ang) * step; p.y += Math.sin(ang) * step;
    });
  }

  impact(p) {
    this.spawnFx('fx_impact', p.tx, p.ty);
    if (p.splash > 0) {
      this.units.children.each(u => {
        if (u.active && Phaser.Math.Distance.Between(p.tx, p.ty, u.x, u.y) <= p.splash) this.damageUnit(u, p.dmg);
      });
    } else if (p.target && p.target.active) {
      this.damageUnit(p.target, p.dmg);
    }
    p.destroy();
  }

  gameOver() { this.scene.pause(); this.game.events.emit('gameOver', { wave: this.waveIndex + 1 }); }
  victory() { this.game.events.emit('victory', {}); }

  syncHud() { this.game.events.emit('stats', { money: this.money, baseHP: this.baseHP, wave: this.waveIndex, totalWaves: WAVES.length }); }
}
