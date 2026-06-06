# Using the animations

All animations ship as **horizontal spritesheets** (frames laid left→right) and
are listed in `public/assets/manifest.json`. `src/scenes/Boot.js` loads each
sheet and registers a Phaser animation whose **key equals the sprite key**. So
once Boot has run you just call `sprite.play(key)`.

There are two families:

| Family | Keys | Size | Frames | FPS | Loop? |
|---|---|---|---|---|---|
| Explosion | `fx_explosion` | 64×64 | 7 | 18 | one-shot |
| Big explosion (boss) | `fx_explosion_big` | 96×96 | 8 | 16 | one-shot |
| Muzzle flash | `fx_muzzle` | 32×32 | 4 | 30 | one-shot |
| Smoke puff | `fx_smoke` | 48×48 | 6 | 14 | one-shot |
| Impact spark | `fx_impact` | 24×24 | 4 | 24 | one-shot |
| Flame jet tip | `fx_flame` | 44×32 | 5 | 18 | one-shot/loop |
| Vehicle dust | `fx_dust` | 32×32 | 5 | 14 | one-shot |
| Infantry walk | `unit_<type>_<team>` | 48×48 | 4 | 10 | **loops** |

Infantry walk types: `infantry, officer, medic, engineer, scout, heavy,
grenadier` — each baked per team (`_p0`..`_p4`), e.g. `unit_scout_p2`.

---

## 1. How they get registered (already done in Boot)
For reference — this is the contract. `repeat:0` = play once, `repeat:-1` = loop.
```js
// neutral FX
m.anims.forEach(a => this.anims.create({
  key: a.key,
  frames: this.anims.generateFrameNumbers(a.key, { start: 0, end: a.frames - 1 }),
  frameRate: a.fps,
  repeat: a.repeat,            // 0 for FX
}));
// per-team (infantry walks) — one anim per variant key
m.teamAnims.forEach(a => a.variants.forEach(v => this.anims.create({
  key: v.key,                 // e.g. "unit_infantry_p1"
  frames: this.anims.generateFrameNumbers(v.key, { start: 0, end: a.frames - 1 }),
  frameRate: a.fps,
  repeat: a.repeat,           // -1 (loops)
})));
```
If you restructure the codebase, keep this loop — never hardcode frame counts.

---

## 2. One-shot FX (explosions, muzzle, impact, smoke, dust)
Spawn a sprite, play, destroy on complete. Helper:
```js
spawnFx(scene, key, x, y, opts = {}) {
  const s = scene.add.sprite(x, y, key, 0).setDepth(opts.depth ?? 20);
  if (opts.rotation != null) s.setRotation(opts.rotation);
  if (opts.scale)            s.setScale(opts.scale);
  s.play(key);
  s.once('animationcomplete', () => s.destroy());
  return s;
}
```

**Unit death:**
```js
spawnFx(this, unit.def.boss ? 'fx_explosion_big' : 'fx_explosion', unit.x, unit.y);
```

**Muzzle flash** — the flash art points EAST, so rotate it to the gun's aim
angle and place it at the barrel tip:
```js
const ang  = Math.atan2(target.y - tower.y, target.x - tower.x);
const tipX = tower.x + Math.cos(ang) * 22;
const tipY = tower.y + Math.sin(ang) * 22;
spawnFx(this, 'fx_muzzle', tipX, tipY, { rotation: ang, depth: 8 });
```

**Projectile impact:**
```js
spawnFx(this, 'fx_impact', hitX, hitY);          // small spark
spawnFx(this, 'fx_smoke',  hitX, hitY, { scale: 0.8 }); // optional lingering puff
```

> All of the above is already wired in `src/scenes/Game.js`
> (`spawnFx`, `fire`, `impact`, `damageUnit`). Copy those if you port the code.

---

## 3. Looping animations (infantry walk)
Pick the variant key by unit type **and** team, then `play`. It loops on its own:
```js
const key = `unit_${type}_${teamId}`;     // e.g. "unit_heavy_p3"
const u = this.add.sprite(start.x, start.y, key, 0).play(key);
```
The walk cycle plays continuously while the unit moves. To "stop" walking
(e.g. unit is frozen/stunned) pause it: `u.anims.pause()` / `u.anims.resume()`.

**Facing:** the walk art is drawn facing EAST. Set `u.rotation` to the lane
tangent so the soldier faces travel direction:
```js
const tan = lanePath.getTangent(u.t);
u.rotation = Math.atan2(tan.y, tan.x);
```
(Vehicles are static sprites — no walk anim — but rotate them the same way.)

---

## 4. Flame jet (flamethrower tower)
`fx_flame` is the jet tip pointing EAST. Two ways to use it:
- **Per-shot:** `spawnFx(this, 'fx_flame', tipX, tipY, { rotation: ang })`.
- **Sustained stream:** keep one sprite alive while firing and loop it manually:
```js
this.flame = this.add.sprite(tipX, tipY, 'fx_flame').setRotation(ang);
this.flame.play({ key: 'fx_flame', repeat: -1 });   // override to loop
// reposition each frame to the barrel tip; destroy when the tower stops firing
```

---

## 5. Speed control (1× / 2× / 4×)
The HUD speed toggle should also scale animation playback so walks/FX match
fast-forward. Set the global anims time scale:
```js
this.anims.globalTimeScale = speedMultiplier;   // 1, 2, 4
```
(Movement is scaled separately via `unitTimeScale` in `Game.js`.)

---

## 6. Adding or recoloring animations
1. Add a draw fn in the forge: `SF.anim(key, w, h, frames, group, draw)` for
   neutral FX, or `SF.animTeam(...)` for a per-team anim. `draw(ctx, i, frames,
   w, h, helpers[, team])` renders frame `i`.
2. (Optional) set its FPS in the `fpsMap` of `tools/forge/generate.html`.
3. Open `tools/forge/generate.html` → **Generate & download zip** → unzip into
   `public/`. It appears in `manifest.json` automatically and Boot will pick it
   up — no code changes needed to load/register it.

## Gotchas
- Frames are read by index (`generateFrameNumbers`), so the sheet width must be
  `frameWidth × frames`. The forge guarantees this; keep it true for new art.
- One-shot sprites must be destroyed (`animationcomplete`) or they pile up.
- Anchor/pivot is the sprite center by default — correct for explosions and
  turrets. Muzzle/flame read best when placed at the barrel tip (see §2).
- WebGL canvas may screenshot black in headless tools; it renders fine live.
