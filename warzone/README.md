# WARZONE — Tower Defense asset pack + Phaser scaffold

A complete flat-vector, high-contrast **WWII top-down** art set (≈300 PNGs)
plus a runnable **Vite + Phaser 3** scaffold. Built for a up-to-4-player
base-defense game: each player owns an **HQ base**, deploys **defenses**
(towers) that shoot incoming **units/vehicles** marching down a lane.

---

## Run it

**Full project (recommended):**
```bash
npm install
npm run dev          # opens index.html via Vite
```

**No build step:** open `play.html` directly in a browser — it loads Phaser
from a CDN and reads assets from `public/`. Great for a quick look.

**Review the art:** open `Asset Catalog.html` — every sprite, a live team-color
switcher, and playing animations. No build needed.

---

## What's in the box

```
public/assets/
  towers/      12 defenses × {base, gun} × 5 teams   (gun = rotatable turret)
  bases/       player HQ (intact + damaged) + flag × 5 teams
  units/       static vehicles × 5 teams
  fx/          projectiles (bullet, shell, rocket, mortar, flame, tracer)
  tiles/       grass/dirt/sand/water/mud/road + 15 mask-driven lane pieces
  deco/        trees, rocks, sandbags, wire, hedgehogs, crates, craters…
  ui/          panels, cards, buttons (3 states), bars, markers, coin, banner
  icons/       21 HUD glyphs (upgrade, sell, play, pause, target, star…)
  spritesheets/  animations — explosions, muzzle, smoke, flame, dust,
                 + 7 infantry walk cycles × 5 teams
  manifest.json  machine-readable index the game preloads from
```

### Team colors (up to 4 players)
Every defense, base and unit is baked once per team:
`_p0` = neutral hostile foe, `_p1..p4` = the four players
(**Blue / Red / Green / Amber** by default).

- Art colors live in `tools/forge/00-core.js` → `SF.TEAMS`.
- Game colors live in `src/config.js` → `TEAM_COLORS` (keep them in sync).
- Change `PLAYER_TEAM` / `PLAYER_COUNT` in `src/config.js` to test.

To recolor or add sprites, edit the forge files in `tools/forge/` and
re-run the generator (see that folder). Naming convention is
`<group>/<key>_<team>.png`.

---

## Code layout

```
src/
  config.js          tile grid, TEAM_COLORS, TOWERS, UNITS, WAVES, lane path
  main.js            Phaser bootstrap (reads manifest, sets asset base)
  scenes/
    Boot.js          preloads every manifest entry, builds animations
    Game.js          terrain, lane, bases, spawning, towers, combat
    Hud.js           top bar, tower build palette, wave + speed controls
phaser-shim.js       used only by play.html (maps "phaser" → UMD global)
```

### Implemented gameplay (starter logic — tune freely)
- Map render from tiles + lane waypoints, player HQ + rival HQs.
- Wave spawner (10 waves, scaling, boss on wave 10).
- Unit path-following, rotation, per-unit HP bars; infantry play walk anims.
- Build defenses on grass (ghost preview + valid/invalid tint, ESC to cancel).
- Turrets acquire the lead target, rotate to aim, fire on cooldown.
- Projectiles home in; single-target or splash damage; muzzle/impact/explosion FX.
- Economy (kill rewards + wave bonus + HQ-bunker income), base HP, win/lose banners.

It's a scaffold: balance values, multiplayer netcode, upgrades and selling are
left as hooks (stats already live in `config.js`).
