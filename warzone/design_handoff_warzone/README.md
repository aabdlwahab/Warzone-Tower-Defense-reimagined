# Handoff: Warzone — Tower Defense (asset pack + Phaser scaffold)

## Overview
This bundle is a complete **art asset pack** and a **runnable Vite + Phaser 3
scaffold** for *Warzone*, an up-to-4-player base-defense (tower-defense) game.
Each player owns an **HQ base**; players deploy **defenses** (turrets) that
shoot **units/vehicles** marching down a lane toward the bases. Theme is
**WWII, top-down**, art style is **flat-vector / high-contrast arcade**.

Your job: take the scaffold from "core loop works" to a full game, using the
provided assets and the balance/config hooks already in place.

## About the files
- `public/assets/**` — the deliverable art (≈300 PNGs + spritesheets) and
  `manifest.json`. **These are final game-ready assets, not throwaway mocks.**
  Use them directly.
- `src/**` — a working Phaser 3 scaffold (ES modules). It is **reference-grade
  starter code**, not a finished game. Keep it, refactor it, or port it to your
  preferred structure — but the asset-loading + manifest contract should be
  preserved (or re-implemented faithfully) because all art is keyed to it.
- `tools/forge/**` — the procedural generator that *produced* the art. Only
  needed if you want to recolor/add/regenerate sprites.
- `Asset Catalog.html`, `play.html` — review/preview tools (no build needed).

## Fidelity
**High fidelity.** Colors, sizes and the visual system are final. The art is
generated from code so it is internally consistent (one palette, one outline
weight, 48px grid). Do not redraw assets; consume the PNGs/spritesheets as-is.

---

## How to run
```bash
npm install
npm run dev        # Vite serves index.html
```
No-build sanity check: open `play.html` (loads Phaser from CDN, reads `public/`).
Review every sprite: open `Asset Catalog.html` (live team-color switcher).

---

## Asset system (read this first)

### Grid & geometry
- Base tile / sprite unit = **48×48 px**. Vehicles and bases are larger
  multiples (tanks 56–64, boss 88, HQ base 96).
- Top-down. **Everything "forward-facing" points EAST (+x)** so Phaser can
  rotate it by setting `rotation` to the aim/movement angle.
- Towers are split into **`_base`** (static footprint) + **`_gun`** (rotatable
  turret, pivot at sprite center). Stack them at the same x,y and rotate only
  the gun.

### Team colors (the 4-player requirement)
Every **defense, base, and unit** is baked once per team:
- `_p0` = **neutral / hostile** (the AI wave foe)
- `_p1.._p4` = the four players — default **Blue / Red / Green / Amber**

Naming: `<group>/<key>_<team>.png` (e.g. `towers/tower_mg_gun_p2.png`,
`units/unit_heavytank_p0.png`, `bases/base_hq_p1.png`).

Spritesheets follow the same rule: `spritesheets/unit_infantry_p3.png`.

Source-of-truth for the color values (keep these two in sync):
- Art: `tools/forge/00-core.js` → `SF.TEAMS`
- Runtime: `src/config.js` → `TEAM_COLORS` (`hex` for Phaser, `css` for DOM)

To pick a sprite at runtime: `` `tower_${key}_gun_${teamId}` ``.

### Manifest schema (`public/assets/manifest.json`)
Preload everything by iterating this file — never hardcode keys.
```jsonc
{
  "meta":  { "project":"warzone", "tile":48, "generated":"YYYY-MM-DD" },
  "teams": [ { "id":"p1","name":"Blue","hex":"...","css":"..." }, ... ],

  // neutral single-frame images
  "statics": [ { "key":"tile_grass", "group":"tiles",
                 "path":"assets/tiles/tile_grass.png", "w":48,"h":48 }, ... ],

  // per-team single-frame images
  "teamStatics": [ { "key":"tower_mg_gun","group":"towers","w":48,"h":48,
      "variants":[ { "team":"p0","key":"tower_mg_gun_p0",
                     "path":"assets/towers/tower_mg_gun_p0.png" }, ... ] }, ... ],

  // neutral spritesheets (frames laid horizontally)
  "anims": [ { "key":"fx_explosion","group":"fx",
               "path":"assets/spritesheets/fx_explosion.png",
               "frameWidth":64,"frameHeight":64,"frames":7,"fps":18,"repeat":0 }, ... ],

  // per-team spritesheets (infantry walk cycles, looping)
  "teamAnims": [ { "key":"unit_infantry","group":"units",
      "frameWidth":48,"frameHeight":48,"frames":4,"fps":10,"repeat":-1,
      "variants":[ { "team":"p0","key":"unit_infantry_p0",
                     "path":"assets/spritesheets/unit_infantry_p0.png" }, ... ] }, ... ]
}
```
`src/scenes/Boot.js` already turns this into `load.image` / `load.spritesheet`
calls and builds the Phaser animations — copy that logic if you restructure.
**See `ANIMATIONS.md` (in this folder) for full instructions on playing,
looping, rotating and recoloring every animation.**

### Asset inventory
| Group | Keys | Notes |
|---|---|---|
| `towers` | `tower_<key>_base` + `tower_<key>_gun` ×12 | rifle, mg, mortar, cannon, at, flak, howitzer, sniper, flame, rocket, bazooka, command. Teamed. |
| `bases` | `base_hq`, `base_hq_damaged`, `base_flag` | Player HQ. Teamed. 96×96. |
| `units` (vehicles) | `unit_lighttank/mediumtank/heavytank/halftrack/armoredcar/motorcycle/arttruck/boss` | Static, teamed. |
| `units` (infantry) | `unit_infantry/officer/medic/engineer/scout/heavy/grenadier` | 4-frame walk spritesheets, teamed. |
| `fx` | `proj_bullet/tracer/shell/mortar/rocket/flame` (static) + `fx_explosion/explosion_big/muzzle/smoke/impact/flame/dust` (anim) | Neutral. |
| `tiles` | `tile_grass/grass2/dirt/sand/mud/water/road/build/blocked` + `path_*` (15 mask pieces: h, v, ne/nw/se/sw, t_up/down/left/right, cross, end_n/s/e/w) | Neutral, seamless. |
| `deco` | `deco_tree/bush/rock/sandbag/barbedwire/hedgehog/barrel/crate/crater` | Transparent props. |
| `ui` | `ui_panel/card/button(+_hover/_press)(+_green/_red)/bar_frame/bar_green/yellow/red/range/place_ok/place_no/coin/wave_banner` | Neutral HUD. |
| `icons` | `icon_upgrade/sell/pause/play/fast/target/damage/settings/star/heart/skull/ammo/shield/fire/lock/plus/close/menu/sound_on/sound_off/speed/flag` | 32×32 glyphs, tintable. |

---

## Gameplay spec

### Current state (implemented in the scaffold)
- Map render from tiles + lane waypoints; player HQ + decorative rival HQs.
- Wave spawner: `WAVES` in `config.js` (10 waves, scaling, boss on wave 10).
- Units follow a `Phaser.Curves.Path`, rotate to tangent; infantry play walk
  anims; each unit has an HP bar that recolors with health.
- Build defenses on grass: ghost preview, valid/invalid tint, `ESC` cancels.
- Turrets pick the **lead target** (furthest along the lane) in range, rotate
  the gun to aim, fire on cooldown.
- Projectiles home to target; single-target or splash; spawn muzzle/impact/
  explosion FX. Boss uses the big explosion.
- Economy: kill rewards + per-wave bonus + `command` (HQ Bunker) passive income;
  base HP; win/lose banners; speed toggle (1×/2×/4×).

### To build (left as hooks; data already exists)
1. **Real multiplayer** — 4 players each with their own base + lane + economy.
   The scaffold runs one local player (`PLAYER_TEAM`). Decide co-op (shared
   waves) vs. versus (players send units at each other — units are already
   teamed for this). Add netcode/transport.
2. **Tower selection + upgrade + sell** UI (icons `upgrade`/`sell` exist; add
   tiers to `TOWERS`, e.g. `levels: [...]`).
3. **Range/target indicators** on selected tower (`ui_range` provided).
4. **Pathing per lane** if multiple lanes; current `LANE` is a single polyline.
5. **Medic heal behavior** (`UNITS.medic.heals` flag present, not yet wired).
6. **Audio**, pause/menu, save/restore, balance pass.

### Balance / data tables — all in `src/config.js`
- `TOWERS` — `{ cost, range(px), dmg, cd(ms), proj, splash(px), turn(rad/s), income? }`
- `UNITS` — `{ hp, speed(px/s), reward, dmg(to base), kind('inf'|'veh'), boss?, heals? }`
- `WAVES` — array of waves; each wave is `[{ unit, count, gap(ms) }, ...]`
- `LANE` — grid-coord waypoints (units march this; HQ at the last point)
- `START_MONEY`, `START_BASE_HP`, `TILE`, `COLS`, `ROWS`, `PLAYER_TEAM`, `PLAYER_COUNT`

---

## Code map
```
index.html              Vite entry (sets window.ASSET_BASE='')
play.html               no-build demo (CDN Phaser via phaser-shim.js)
phaser-shim.js          maps bare "phaser" import to UMD global (play.html only)
vite.config.js, package.json
src/
  config.js             tile grid, TEAM_COLORS, TOWERS, UNITS, WAVES, LANE  ← tune here
  main.js               Phaser.Game bootstrap; fetches manifest; sets assetBase
  scenes/
    Boot.js             preloads every manifest entry, builds animations
    Game.js             terrain, lane, bases, spawning, placement, combat, economy
    Hud.js              top bar, tower build palette, wave + speed controls, banners
tools/forge/            sprite generator (00-core palette+helpers, 10..50 draw fns,
                        generate.html = in-browser re-bake → downloadable zip)
public/assets/          the art + manifest.json
```

## Recoloring / regenerating art
1. Edit `SF.TEAMS` in `tools/forge/00-core.js` (and mirror in `TEAM_COLORS`).
2. Open `tools/forge/generate.html` in a browser → **Generate & download zip**.
3. Unzip into `public/` (overwrites `public/assets/`).
To add a sprite: register it in the relevant forge file (`SF.reg` / `SF.regTeam`
/ `SF.anim` / `SF.animTeam` / `SF.tower`), regenerate, and it appears in the
manifest automatically.

## Conventions to preserve
- Forward = EAST; rotate via `rotation`.
- Sprite keys are `<key>_<team>` for anything teamed; iterate the manifest.
- 48px grid; keep new art on-grid and on-palette (palette in `00-core.js`).
- Phaser uses WebGL — fine in real browsers; headless screenshot tools may
  capture the canvas black (not a bug).
