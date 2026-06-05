import Phaser from "phaser";

import { AssetCatalog } from "./assets";
import type { GameEvent, GameMap, Snapshot, StateSnapshot } from "./types";

export const TILE_SIZE = 48;
const GRID_COLOR = 0x1d2c36;
const EMPTY_COLOR = 0x0f171f;
const PATH_EDGE_COLOR = 0x3d352e;
const PATH_COLOR = 0x74634c;
const PATH_LIGHT_COLOR = 0x9a8260;
const WARNING_COLOR = 0xd45f55;
const ASSET_SCALE = TILE_SIZE / 48;
const BARREL_TIP = 22;
const RANGE_ASSET_SIZE = 200;
// Render ~one broadcast interval in the past and lerp between snapshots so the
// 10 Hz server stream looks smooth at 60 fps. Events are delayed to match.
const INTERP_DELAY_MS = 120;
const BUFFER_MS = 1000;
const TEAM_COLORS: Record<string, number> = {
  p0: 0x86922f,
  p1: 0x2e74d6,
  p2: 0xe8413a,
  p3: 0x25c065,
  p4: 0xf5b21e
};
type TowerStat = {
  base: string;
  color: number;
  gun: string;
  projectile: string;
  projectileRadius: number;
  projectileMs: number;
  range: number;
};
const TOWER_STATS: Record<string, TowerStat> = {
  rifle: {
    base: "tower_rifle_base",
    color: 0x86c5ff,
    gun: "tower_rifle_gun",
    projectile: "proj_tracer",
    projectileRadius: 8,
    projectileMs: 240,
    range: 3.0
  },
  cannon: {
    base: "tower_cannon_base",
    color: 0xffb35f,
    gun: "tower_cannon_gun",
    projectile: "proj_shell",
    projectileRadius: 7,
    projectileMs: 320,
    range: 2.5
  },
  frost: {
    base: "tower_flak_base",
    color: 0x9ff2e8,
    gun: "tower_flak_gun",
    projectile: "proj_bullet",
    projectileRadius: 6,
    projectileMs: 260,
    range: 2.75
  }
};
const ENEMY_STATS: Record<string, { asset: string; health: number; scale: number }> = {
  grunt: { asset: "unit_armoredcar", health: 55, scale: 0.9 },
  runner: { asset: "unit_motorcycle", health: 38, scale: 0.82 },
  armored: { asset: "unit_lighttank", health: 95, scale: 0.96 },
  boss: { asset: "unit_boss", health: 340, scale: 1.25 }
};
const DECO = [
  { asset: "deco_sandbag", x: 1, y: 0, angle: -0.1 },
  { asset: "deco_crate", x: 10, y: 0, angle: 0.2 },
  { asset: "deco_rock", x: 12, y: 2, angle: 0.0 },
  { asset: "deco_barrel", x: 5, y: 7, angle: -0.2 },
  { asset: "deco_hedgehog", x: 11, y: 8, angle: 0.25 },
  { asset: "deco_crater", x: 2, y: 6, angle: 0.0 }
];

type Frame = {
  t: number;
  snapshot: StateSnapshot;
};

export class BattleScene extends Phaser.Scene {
  private _assets: AssetCatalog;
  private _buffer: Frame[];
  private _effects: Phaser.GameObjects.GameObject[];
  private _graphics!: Phaser.GameObjects.Graphics;
  private _hoverTile: { x: number; y: number } | null;
  private _localPlayerId: string | null;
  private _map: GameMap | null;
  private _onPlace: (towerType: string, x: number, y: number) => void;
  private _overlay!: Phaser.GameObjects.Graphics;
  private _snapshot: Snapshot | null;
  private _sprites: Phaser.GameObjects.Image[];
  private _staticSprites: Phaser.GameObjects.Image[];
  private _terrain!: Phaser.GameObjects.Graphics;
  private _towerType: string;

  constructor(assets: AssetCatalog) {
    super("battle");
    this._assets = assets;
    this._buffer = [];
    this._effects = [];
    this._hoverTile = null;
    this._localPlayerId = null;
    this._map = null;
    this._onPlace = () => {};
    this._snapshot = null;
    this._sprites = [];
    this._staticSprites = [];
    this._towerType = "rifle";
  }

  preload(): void {
    this._assets.preload(this);
  }

  create(): void {
    this._assets.create(this);
    this._terrain = this.add.graphics();
    this._graphics = this.add.graphics();
    this._overlay = this.add.graphics();
    this._terrain.setDepth(0);
    this._graphics.setDepth(4);
    this._overlay.setDepth(20);
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const tile = this._getTile(pointer);
      this._onPlace(this._towerType, tile.x, tile.y);
    });
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this._hoverTile = this._getTile(pointer);
    });
    this.input.on("gameout", () => {
      this._hoverTile = null;
    });
  }

  update(): void {
    if (this._map === null) {
      return;
    }

    const sampled = this._sample();

    if (sampled === null) {
      return;
    }

    this._snapshot = { ...sampled, map: this._map };
    this._drawDynamic();
  }

  setMap(map: GameMap): void {
    const changed = this._map === null || this._map.id !== map.id;
    this._map = map;

    if (changed) {
      this.scale.resize(map.width * TILE_SIZE, map.height * TILE_SIZE);
      this._drawStatic();
    }
  }

  pushState(snapshot: StateSnapshot): void {
    const now = this.time.now;
    this._buffer.push({ t: now, snapshot });

    const cutoff = now - BUFFER_MS;

    while (this._buffer.length > 2 && this._buffer[0].t < cutoff) {
      this._buffer.shift();
    }
  }

  setLocalPlayer(playerId: string): void {
    this._localPlayerId = playerId;
  }

  playEvents(events: GameEvent[]): void {
    for (const event of events) {
      this.time.delayedCall(INTERP_DELAY_MS, () => this._playEvent(event));
    }
  }

  setPlacement(callback: (towerType: string, x: number, y: number) => void): void {
    this._onPlace = callback;
  }

  setTower(towerType: string): void {
    this._towerType = towerType;
  }

  private _sample(): StateSnapshot | null {
    if (this._buffer.length === 0) {
      return null;
    }

    const renderTime = this.time.now - INTERP_DELAY_MS;
    const oldest = this._buffer[0];
    const newest = this._buffer[this._buffer.length - 1];

    if (renderTime <= oldest.t) {
      return oldest.snapshot;
    }

    if (renderTime >= newest.t) {
      return newest.snapshot;
    }

    for (let index = 0; index < this._buffer.length - 1; index += 1) {
      const from = this._buffer[index];
      const to = this._buffer[index + 1];

      if (renderTime >= from.t && renderTime <= to.t) {
        const span = Math.max(1, to.t - from.t);
        return this._interpolate(from.snapshot, to.snapshot, (renderTime - from.t) / span);
      }
    }

    return newest.snapshot;
  }

  private _interpolate(from: StateSnapshot, to: StateSnapshot, factor: number): StateSnapshot {
    const previous = new Map(from.enemies.map((enemy) => [enemy.id, enemy]));
    const enemies = to.enemies.map((enemy) => {
      const before = previous.get(enemy.id);

      if (before === undefined) {
        return enemy;
      }

      return {
        ...enemy,
        distance: Phaser.Math.Linear(before.distance, enemy.distance, factor),
        position: {
          x: Phaser.Math.Linear(before.position.x, enemy.position.x, factor),
          y: Phaser.Math.Linear(before.position.y, enemy.position.y, factor)
        }
      };
    });

    return { ...to, enemies };
  }

  private _drawStatic(): void {
    if (this._map === null) {
      return;
    }

    this._staticSprites.forEach((sprite) => sprite.destroy());
    this._staticSprites = [];
    this._terrain.clear();

    const map = this._map;
    this._drawBackdrop(map);
    this._drawGrid(map);
    this._drawPath(map);
    this._drawDeco(map);
    this._drawEntrances(map);
  }

  private _drawDynamic(): void {
    if (this._snapshot === null) {
      return;
    }

    this._sprites.forEach((sprite) => sprite.destroy());
    this._sprites = [];
    this._graphics.clear();
    this._overlay.clear();
    this._drawPreview();
    this._drawTowers();
    this._drawEnemies();
  }

  private _canBuild(x: number, y: number): boolean {
    if (this._map === null) {
      return false;
    }

    const hasTile = this._map.buildable.some((tile) => tile.x === x && tile.y === y);
    return hasTile && this._getTower(x, y) === undefined;
  }

  private _create(
    key: string,
    x: number,
    y: number,
    depth: number,
    scale = ASSET_SCALE
  ): Phaser.GameObjects.Image {
    const sprite = this.add.image(x, y, key);
    sprite.setDepth(depth);
    sprite.setScale(scale);
    this._sprites.push(sprite);
    return sprite;
  }

  private _createStatic(
    key: string,
    x: number,
    y: number,
    depth: number,
    scale = ASSET_SCALE
  ): Phaser.GameObjects.Image {
    const sprite = this.add.image(x, y, key);
    sprite.setDepth(depth);
    sprite.setScale(scale);
    this._staticSprites.push(sprite);
    return sprite;
  }

  private _drawBackdrop(map: GameMap): void {
    const width = map.width * TILE_SIZE;
    const height = map.height * TILE_SIZE;
    this._terrain.fillStyle(0x081018, 1);
    this._terrain.fillRect(0, 0, width, height);
    this._terrain.lineStyle(2, 0x20303b, 1);
    this._terrain.strokeRect(1, 1, width - 2, height - 2);
  }

  private _drawGrid(map: GameMap): void {
    this._terrain.fillStyle(EMPTY_COLOR, 1);
    this._terrain.fillRect(0, 0, map.width * TILE_SIZE, map.height * TILE_SIZE);

    const buildable = new Set(map.buildable.map((tile) => `${tile.x},${tile.y}`));

    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        const key = buildable.has(`${x},${y}`) ? this._getGround(x, y) : "tile_road";
        this._createStatic(key, x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 1);
      }
    }

    for (const tile of map.buildable) {
      this._terrain.fillStyle(0xffffff, 0.035);
      this._terrain.fillRect(tile.x * TILE_SIZE + 3, tile.y * TILE_SIZE + 3, TILE_SIZE - 6, 7);
    }

    this._terrain.lineStyle(1, GRID_COLOR, 1);

    for (let x = 0; x <= map.width; x += 1) {
      this._terrain.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, map.height * TILE_SIZE);
    }

    for (let y = 0; y <= map.height; y += 1) {
      this._terrain.lineBetween(0, y * TILE_SIZE, map.width * TILE_SIZE, y * TILE_SIZE);
    }
  }

  private _drawPath(map: GameMap): void {
    this._drawPathLine(map, 34, PATH_EDGE_COLOR, 1);
    this._drawPathLine(map, 26, PATH_COLOR, 1);
    this._drawPathLine(map, 3, PATH_LIGHT_COLOR, 0.45);
  }

  private _drawPathLine(map: GameMap, width: number, color: number, alpha: number): void {
    this._terrain.lineStyle(width, color, alpha);

    for (let index = 0; index < map.path.length - 1; index += 1) {
      const start = map.path[index];
      const end = map.path[index + 1];
      this._terrain.lineBetween(
        start.x * TILE_SIZE,
        start.y * TILE_SIZE,
        end.x * TILE_SIZE,
        end.y * TILE_SIZE
      );
    }
  }

  private _drawDeco(map: GameMap): void {
    const buildable = new Set(map.buildable.map((tile) => `${tile.x},${tile.y}`));

    for (const deco of DECO) {
      if (!buildable.has(`${deco.x},${deco.y}`)) {
        continue;
      }

      this._createStatic(
        deco.asset,
        deco.x * TILE_SIZE + TILE_SIZE / 2,
        deco.y * TILE_SIZE + TILE_SIZE / 2,
        3,
        ASSET_SCALE * 0.85
      ).setRotation(deco.angle);
    }
  }

  private _drawEntrances(map: GameMap): void {
    const start = map.path[0];
    const end = map.path[map.path.length - 1];
    this._drawGate(start.x * TILE_SIZE, start.y * TILE_SIZE, "base_flag", "p0");
    this._drawGate(end.x * TILE_SIZE, end.y * TILE_SIZE, "base_hq", "p1");
  }

  private _drawGate(x: number, y: number, asset: string, team: string): void {
    const color = TEAM_COLORS[team] ?? TEAM_COLORS.p1;
    this._terrain.fillStyle(0x0b1218, 1);
    this._terrain.fillCircle(x, y, 24);
    this._terrain.lineStyle(4, color, 0.72);
    this._terrain.strokeCircle(x, y, 20);
    this._terrain.lineStyle(1, 0xffffff, 0.2);
    this._terrain.strokeCircle(x, y, 27);
    this._createStatic(this._assets.team(asset, team), x, y, 7, ASSET_SCALE * 0.9);
  }

  private _drawEnemies(): void {
    if (this._snapshot === null) {
      return;
    }

    for (const enemy of this._snapshot.enemies) {
      const stat = ENEMY_STATS[enemy.kind] ?? ENEMY_STATS.grunt;
      const x = enemy.position.x * TILE_SIZE;
      const y = enemy.position.y * TILE_SIZE;
      const size = enemy.kind === "boss" ? 19 : 13;
      const angle = this._getAngle(enemy.distance, this._snapshot.map);
      this._graphics.fillStyle(0x000000, 0.24);
      this._graphics.fillEllipse(x + 2, y + 8, size * 1.9, size * 0.75);
      this._create(this._assets.team(stat.asset, "p0"), x, y, 8, ASSET_SCALE * stat.scale).setRotation(
        angle
      );
      this._drawHealth(x, y - size - 10, enemy.health, stat.health);
    }
  }

  private _drawHealth(x: number, y: number, health: number, maxHealth: number): void {
    const width = 28;
    const value = Phaser.Math.Clamp(health / maxHealth, 0, 1);
    this._overlay.fillStyle(0x05080b, 0.9);
    this._overlay.fillRoundedRect(x - width / 2, y, width, 5, 2);
    this._overlay.fillStyle(value > 0.45 ? 0x8fe388 : WARNING_COLOR, 1);
    this._overlay.fillRoundedRect(x - width / 2, y, width * value, 5, 2);
  }

  private _drawTowers(): void {
    if (this._snapshot === null) {
      return;
    }

    for (const tower of this._snapshot.towers) {
      const stat = TOWER_STATS[tower.kind] ?? TOWER_STATS.rifle;
      const team = this._getTeam(tower.owner_id);
      const x = tower.x * TILE_SIZE + TILE_SIZE / 2;
      const y = tower.y * TILE_SIZE + TILE_SIZE / 2;
      const angle = this._getTargetAngle(x, y, stat.range);
      this._graphics.fillStyle(0x000000, 0.26);
      this._graphics.fillEllipse(x + 2, y + 10, 42, 15);
      this._create(this._assets.team(stat.base, team), x, y, 6, ASSET_SCALE * 1.05);
      this._create(this._assets.team(stat.gun, team), x, y, 7, ASSET_SCALE * 1.05).setRotation(angle);
      this._overlay.lineStyle(1, TEAM_COLORS[team] ?? stat.color, 0.34);
      this._overlay.strokeCircle(x, y, 20);
    }
  }

  private _drawPreview(): void {
    if (this._hoverTile === null || this._snapshot === null) {
      return;
    }

    const x = this._hoverTile.x * TILE_SIZE + TILE_SIZE / 2;
    const y = this._hoverTile.y * TILE_SIZE + TILE_SIZE / 2;
    const canBuild = this._canBuild(this._hoverTile.x, this._hoverTile.y);
    const tower = this._getTower(this._hoverTile.x, this._hoverTile.y);
    const stat = TOWER_STATS[this._towerType] ?? TOWER_STATS.rifle;
    const color = canBuild ? stat.color : WARNING_COLOR;
    const marker = canBuild ? "ui_place_ok" : "ui_place_no";

    if (tower !== undefined) {
      const towerStat = TOWER_STATS[tower.kind] ?? TOWER_STATS.rifle;
      this._range(x, y, towerStat.color, towerStat.range, 0.24);
      return;
    }

    this._create(marker, x, y, 19, ASSET_SCALE);
    this._overlay.fillStyle(color, canBuild ? 0.16 : 0.22);
    this._overlay.fillRect(
      this._hoverTile.x * TILE_SIZE + 2,
      this._hoverTile.y * TILE_SIZE + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4
    );
    this._overlay.lineStyle(2, color, 0.7);
    this._overlay.strokeRect(
      this._hoverTile.x * TILE_SIZE + 3,
      this._hoverTile.y * TILE_SIZE + 3,
      TILE_SIZE - 6,
      TILE_SIZE - 6
    );
    this._range(x, y, stat.color, stat.range, canBuild ? 0.3 : 0.1);
  }

  private _playEvent(event: GameEvent): void {
    if (this._map === null) {
      return;
    }

    if (event.type === "shot") {
      this._playShot(event);
      return;
    }

    if (event.type === "kill") {
      this._playKill(event);
      return;
    }

    if (event.type === "leak") {
      this._smoke(event.x * TILE_SIZE, event.y * TILE_SIZE, 0.92);
      return;
    }

    if (event.type === "placed" || event.type === "upgraded") {
      this._smoke(event.x * TILE_SIZE + TILE_SIZE / 2, event.y * TILE_SIZE + TILE_SIZE / 2, 0.6);
    }
  }

  private _playShot(event: Extract<GameEvent, { type: "shot" }>): void {
    const stat = TOWER_STATS[event.kind] ?? TOWER_STATS.rifle;
    const startX = event.x * TILE_SIZE;
    const startY = event.y * TILE_SIZE;
    const endX = event.tx * TILE_SIZE;
    const endY = event.ty * TILE_SIZE;
    const angle = Phaser.Math.Angle.Between(startX, startY, endX, endY);
    const tipX = startX + Math.cos(angle) * BARREL_TIP;
    const tipY = startY + Math.sin(angle) * BARREL_TIP;
    const distance = Phaser.Math.Distance.Between(tipX, tipY, endX, endY);
    const shotOffset = Math.min(stat.projectileRadius, distance);
    const shotX = endX - Math.cos(angle) * shotOffset;
    const shotY = endY - Math.sin(angle) * shotOffset;
    this._flash(tipX, tipY, angle, stat.color);
    this._shoot(tipX, tipY, shotX, shotY, endX, endY, angle, stat);
  }

  private _playKill(event: Extract<GameEvent, { type: "kill" }>): void {
    const key = event.kind === "boss" ? "fx_explosion_big" : "fx_explosion";
    const scale = event.kind === "boss" ? ASSET_SCALE * 0.9 : ASSET_SCALE * 0.78;
    const x = event.x * TILE_SIZE;
    const y = event.y * TILE_SIZE;
    const explosion = this._createEffectSprite(key, x, y, 13, scale);
    explosion.play(key);
    explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this._destroy(explosion));
    this.time.delayedCall(520, () => this._smoke(x, y, 0.68));
    this.time.delayedCall(700, () => this._destroy(explosion));
  }

  private _flash(x: number, y: number, angle: number, color: number): void {
    const flash = this._createEffectSprite("fx_muzzle", x, y, 11, ASSET_SCALE * 0.72);
    flash.setRotation(angle);
    flash.setTint(color);
    flash.play("fx_muzzle");
    flash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this._destroy(flash));
    this.time.delayedCall(220, () => this._destroy(flash));
  }

  private _impact(x: number, y: number, angle: number, color: number): void {
    const impact = this._createEffectSprite("fx_impact", x, y, 12, ASSET_SCALE * 0.82);
    impact.setRotation(angle);
    impact.setTint(color);
    impact.play("fx_impact");
    impact.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this._destroy(impact));
    this.time.delayedCall(300, () => this._destroy(impact));
  }

  private _smoke(x: number, y: number, scale: number): void {
    const smoke = this._createEffectSprite("fx_smoke", x, y, 12, ASSET_SCALE * scale);
    smoke.play("fx_smoke");
    smoke.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => this._destroy(smoke));
    this.time.delayedCall(560, () => this._destroy(smoke));
  }

  private _range(x: number, y: number, color: number, range: number, alpha: number): void {
    const scale = (range * TILE_SIZE * 2) / RANGE_ASSET_SIZE;
    const marker = this._create("ui_range", x, y, 18, scale);
    marker.setAlpha(alpha);
    marker.setTint(color);
  }

  private _shoot(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    impactX: number,
    impactY: number,
    angle: number,
    stat: TowerStat
  ): void {
    const shot = this._createEffect(stat.projectile, startX, startY, 10, ASSET_SCALE * 0.78);
    const trail = this._createTrail(9);
    const state = { progress: 0 };
    const distance = Phaser.Math.Distance.Between(startX, startY, endX, endY);
    const duration = Phaser.Math.Clamp(distance * 1.05, 90, stat.projectileMs);
    shot.setRotation(angle);
    shot.setTint(stat.color);

    this.tweens.add({
      duration,
      ease: "Quad.easeOut",
      onComplete: () => {
        this._destroy(trail);
        this._destroy(shot);
        this._impact(impactX, impactY, angle, stat.color);
      },
      onUpdate: () => {
        const x = Phaser.Math.Linear(startX, endX, state.progress);
        const y = Phaser.Math.Linear(startY, endY, state.progress);
        const tail = Phaser.Math.Clamp(state.progress - 0.22, 0, 1);
        const tailX = Phaser.Math.Linear(startX, endX, tail);
        const tailY = Phaser.Math.Linear(startY, endY, tail);
        trail.clear();
        trail.lineStyle(4, stat.color, 0.28);
        trail.lineBetween(tailX, tailY, x, y);
        trail.lineStyle(1, 0xffffff, 0.65);
        trail.lineBetween(tailX, tailY, x, y);
      },
      targets: shot,
      x: endX,
      y: endY
    });

    this.tweens.add({
      duration,
      ease: "Quad.easeOut",
      progress: 1,
      targets: state
    });
  }

  private _getAngle(distance: number, map: GameMap): number {
    let remaining = distance;

    for (let index = 0; index < map.path.length - 1; index += 1) {
      const start = map.path[index];
      const end = map.path[index + 1];
      const length = Phaser.Math.Distance.Between(start.x, start.y, end.x, end.y);

      if (remaining <= length) {
        return Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
      }

      remaining -= length;
    }

    const start = map.path[map.path.length - 2];
    const end = map.path[map.path.length - 1];
    return Phaser.Math.Angle.Between(start.x, start.y, end.x, end.y);
  }

  private _getTarget(x: number, y: number, range: number) {
    if (this._snapshot === null) {
      return undefined;
    }

    const targets = this._snapshot.enemies.filter((enemy) => {
      const enemyX = enemy.position.x * TILE_SIZE;
      const enemyY = enemy.position.y * TILE_SIZE;
      return Phaser.Math.Distance.Between(x, y, enemyX, enemyY) <= range * TILE_SIZE;
    });

    if (targets.length === 0) {
      return undefined;
    }

    return targets.reduce((lead, enemy) => (enemy.distance > lead.distance ? enemy : lead));
  }

  private _getTargetAngle(x: number, y: number, range: number): number {
    const target = this._getTarget(x, y, range);

    if (target === undefined) {
      return -0.2;
    }

    return Phaser.Math.Angle.Between(x, y, target.position.x * TILE_SIZE, target.position.y * TILE_SIZE);
  }

  private _getTeam(playerId: string): string {
    if (this._snapshot === null) {
      return "p1";
    }

    const index = this._snapshot.players.findIndex((player) => player.id === playerId);

    if (index < 0) {
      return "p1";
    }

    return `p${Phaser.Math.Clamp(index + 1, 1, 4)}`;
  }

  private _getTower(x: number, y: number) {
    if (this._snapshot === null) {
      return undefined;
    }

    return this._snapshot.towers.find((tower) => tower.x === x && tower.y === y);
  }

  private _getGround(x: number, y: number): string {
    if ((x + y) % 7 === 0) {
      return "tile_grass2";
    }

    if ((x * 3 + y) % 11 === 0) {
      return "tile_build";
    }

    return "tile_grass";
  }

  private _createEffect(
    key: string,
    x: number,
    y: number,
    depth: number,
    scale = ASSET_SCALE
  ): Phaser.GameObjects.Image {
    const image = this.add.image(x, y, key);
    image.setDepth(depth);
    image.setScale(scale);
    this._effects.push(image);
    return image;
  }

  private _createEffectSprite(
    key: string,
    x: number,
    y: number,
    depth: number,
    scale = ASSET_SCALE
  ): Phaser.GameObjects.Sprite {
    const sprite = this.add.sprite(x, y, key, 0);
    sprite.setDepth(depth);
    sprite.setScale(scale);
    this._effects.push(sprite);
    return sprite;
  }

  private _createTrail(depth: number): Phaser.GameObjects.Graphics {
    const trail = this.add.graphics();
    trail.setDepth(depth);
    this._effects.push(trail);
    return trail;
  }

  private _destroy(effect: Phaser.GameObjects.GameObject): void {
    if (!effect.active) {
      return;
    }

    this._effects = this._effects.filter((item) => item !== effect);
    effect.destroy();
  }

  private _getTile(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: Math.floor(pointer.x / TILE_SIZE),
      y: Math.floor(pointer.y / TILE_SIZE)
    };
  }
}
