# Warzone Tower Defense — Art Pack Design Prompt

> Give this document to Claude (or any design AI) to generate a complete replacement graphics pack for the game.

---

## Game Overview

Warzone Tower Defense is a WWII-themed, top-down multiplayer tower defense game. 1–4 human players each own a fortified **HQ base** on a grid map. Waves of enemy vehicles and infantry march from spawn points toward the players' bases. Players spend money (earned by killing enemies and from income towers) to place and upgrade static gun emplacements that shoot the attackers automatically.

**Modes:**
- **Single-player** — one human, one base, 10 escalating waves of AI enemies, 8-second build phase before each wave
- **PvP co-op** — 2 or 4 humans each defending their own base on the same map against shared enemy waves

**Economy:** every killed unit drops a cash reward; the HQ Bunker tower generates passive income. Starting budget is $320. Towers cost $50–$300.

**Win/lose:** survive all 10 waves = victory. Base HP reaches 0 = defeat. In PvP the last base standing wins.

---

## Technical Constraints (must be respected exactly)

| Parameter | Value |
|-----------|-------|
| Engine | **Phaser 3** (WebGL/Canvas) |
| Tile size | **48 × 48 px** |
| Grid | 40 × 22 tiles (maps vary) |
| Coordinate system | Top-down, y-axis down, north = up |
| Sprite loading | Phaser `load.image` for static PNGs, `load.spritesheet` for animations |
| Animation sheets | Horizontal strip, left-to-right frames, no padding between frames |
| Team colour system | Every player-ownable sprite is baked into 5 variants: `_p0` (neutral/hostile grey-green), `_p1` (Blue `#2e74d6`), `_p2` (Red `#e8413a`), `_p3` (Green `#25c065`), `_p4` (Amber `#f5b21e`) |
| Rendering | `pixelArt: false`, smooth scaling, `roundPixels: true` |

---

## Art Style Direction

**Mood:** High-contrast, slightly stylised WWII military. Think hand-painted watercolour meets crisp vector iconography — readable at tiny sizes, dramatic at full scale. Dark earth tones for terrain, vivid team tints for units and towers, warm muzzle flashes and deep orange-red explosions.

**Camera:** Strict top-down orthographic, no perspective. All sprites are viewed from directly above (90°). Vehicles show their roof/top. Infantry show the crown of their helmet.

**Palette:** Desaturated olive, khaki, mud browns for terrain and neutral elements. Team colours applied as the primary hue of fabric, metal paint, and insignia. Dark outlines (1–2 px) on all sprites for legibility.

**Avoid:** Isometric angles, side-view sprites, excessive detail that disappears at 48 px.

---

## Asset Catalogue

### 1. Terrain Tiles — 48 × 48 px static PNG, tileable

| Key | Description |
|-----|-------------|
| `tile_grass` | Primary grass — mid olive-green, subtle blade texture |
| `tile_grass2` | Darker grass variant for checkerboard variety |
| `tile_dirt` | Packed dirt road, warm tan, tyre tracks |
| `tile_sand` | Sandy scrub, pale ochre |
| `tile_mud` | Dark wet mud, churned |
| `tile_water` | Shallow water/river, dark teal with ripple shimmer |
| `tile_road` | Paved road, dark grey, lane marking fragments |
| `tile_build` | Buildable highlight — subtle green tint overlay |
| `tile_blocked` | Impassable overlay — subtle red-brown tint |

---

### 2. Path Tiles — 48 × 48 px, showing the enemy road surface

Eleven directional variants: `path_h` (horizontal), `path_v` (vertical), four corners (`path_ne`, `path_nw`, `path_se`, `path_sw`), four T-junctions (`path_t_up`, `path_t_down`, `path_t_left`, `path_t_right`), `path_cross`. Four end-caps: `path_end_n`, `path_end_s`, `path_end_e`, `path_end_w`.

Dirt track / cobblestone surface, worn by traffic. Must tile seamlessly with `tile_grass`.

---

### 3. Decorations — 48 × 48 px static PNG (centred, transparent background)

| Key | Description |
|-----|-------------|
| `deco_tree` | Deciduous tree top-down, dark green canopy |
| `deco_bush` | Scrub bush, olive green |
| `deco_rock` | Granite boulder cluster |
| `deco_sandbag` | Sandbag emplacement arc |
| `deco_barbedwire` | Coil of barbed wire |
| `deco_hedgehog` | Steel anti-tank hedgehog |
| `deco_barrel` | Fuel drum, olive drab |
| `deco_crate` | Wooden ammo crate |
| `deco_crater` | Shell crater with scorched earth |

---

### 4. Towers — 48 × 48 px, 2 PNGs per tower per team variant

**Structure:** each tower = `*_base_pX.png` (static foundation — sandbags, concrete) + `*_gun_pX.png` (rotatable weapon, pivot at sprite centre). The gun sprite's **barrel points east (right) at rotation 0**. Only the gun rotates during gameplay; the base never rotates.

Team colour appears in: fabric/uniform colour of crew, painted metal on weapon, painted insignia.

5 variants per file (`_p0` through `_p4`) × 2 parts × 12 towers = **120 files**

| Tower key | Visual concept | Stats |
|-----------|----------------|-------|
| `tower_rifle` | Sandbagged rifle pit, soldier prone with bolt-action rifle | $50 · range 150 px · 8 dmg · 700 ms cd |
| `tower_mg` | Circular MG nest, bipod-mounted machine gun | $100 · range 165 px · 5 dmg · 160 ms cd |
| `tower_mortar` | Mortar pit with crew, short stubby tube (top-down) | $140 · range 230 px · 26 dmg · 1500 ms cd · 56 px splash |
| `tower_cannon` | Field cannon on wheeled carriage, long barrel | $160 · range 210 px · 34 dmg · 1100 ms cd |
| `tower_at` | Anti-tank gun, low profile, long tapered barrel | $200 · range 250 px · 70 dmg · 1400 ms cd |
| `tower_flak` | Quad-barrel flak cannon on rotating platform | $180 · range 190 px · 12 dmg · 280 ms cd · 24 px splash |
| `tower_howitzer` | Heavy howitzer on reinforced emplacement, very large barrel | $260 · range 300 px · 55 dmg · 2200 ms cd · 70 px splash |
| `tower_sniper` | Sniper hide (camouflage netting base), long rifle with scope | $150 · range 360 px · 90 dmg · 1900 ms cd |
| `tower_flame` | Flame thrower bunker slit, hose nozzle | $170 · range 110 px · 4 dmg · 90 ms cd · 40 px splash |
| `tower_rocket` | Rocket battery, 4-tube rocket pod (gun = pod top-down) | $240 · range 260 px · 30 dmg · 1300 ms cd · 60 px splash |
| `tower_bazooka` | Two-man bazooka team, tube on shoulder | $190 · range 220 px · 60 dmg · 1600 ms cd · 30 px splash |
| `tower_command` | HQ bunker blockhouse with radio antenna (gun = antenna / flag, rotates slowly, no shooting) | $300 · no attack · +$18 income every 3 s |

---

### 5. Bases — 96 × 96 px static PNGs, 5 team variants each (15 files)

| Key | Description |
|-----|-------------|
| `base_hq_pX` | Intact HQ — fortified bunker/command post, team-coloured flag, sandbag perimeter |
| `base_hq_damaged_pX` | Damaged HQ — rubble, cracked concrete, smoke damage, flag torn |
| `base_flag_pX` | Small flag/pennant on pole (spawn marker), team colour |

---

### 6. Enemy Units — hostile only, use `_p0` colour (grey-green / khaki)

#### Vehicles — 48 × 48 px static PNG, top-down roof view, facing east at rotation 0

| Key | Description | Stats |
|-----|-------------|-------|
| `unit_motorcycle` | Sidecar motorcycle, small, fast-looking | HP 70 · speed 150 px/s · reward $12 |
| `unit_armoredcar` | 4-wheeled armoured car, turret visible | HP 160 · speed 95 px/s · reward $18 |
| `unit_halftrack` | Half-track troop carrier | HP 220 · speed 80 px/s · reward $22 |
| `unit_lighttank` | Light tank, small turret, thin armour | HP 300 · speed 70 px/s · reward $26 |
| `unit_arttruck` | Artillery truck with towed gun | HP 260 · speed 75 px/s · reward $24 |
| `unit_mediumtank` | Medium tank, prominent turret | HP 520 · speed 58 px/s · reward $40 |
| `unit_heavytank` | Heavy tank, wide thick hull | HP 900 · speed 46 px/s · reward $65 |
| `unit_boss` | King Tiger — massive, imposing (**56 × 56 px**) | HP 5000 · speed 38 px/s · reward $400 |

#### Infantry — animated spritesheet, 4 frames × 48 × 48 px, horizontal strip, 10 fps

Top-down walking cycle facing east, legs cycle. 5 team variants each (`_p0` through `_p4`).

| Key | Description | Stats |
|-----|-------------|-------|
| `unit_infantry` | Rifleman with bolt-action rifle | HP 40 · speed 70 px/s · reward $6 |
| `unit_officer` | Officer with peaked cap and pistol | HP 60 · speed 75 px/s · reward $10 |
| `unit_medic` | Medic with red cross armband | HP 55 · speed 72 px/s · reward $9 |
| `unit_engineer` | Engineer with tool belt | HP 70 · speed 65 px/s · reward $10 |
| `unit_scout` | Lean scout, lighter kit | HP 30 · speed 130 px/s · reward $7 |
| `unit_heavy` | Heavy gunner carrying LMG | HP 120 · speed 55 px/s · reward $14 |
| `unit_grenadier` | Soldier with grenade bandolier | HP 80 · speed 68 px/s · reward $12 |

---

### 7. Projectiles — small static PNGs, transparent background, pointing east

| Key | Size | Description |
|-----|------|-------------|
| `proj_bullet` | 12 × 4 px | Elongated tracer/bullet, bright yellow-white core |
| `proj_tracer` | 16 × 3 px | Thin tracer line with glowing orange tail |
| `proj_shell` | 18 × 8 px | Artillery shell, tapered, brass/steel |
| `proj_mortar` | 14 × 14 px | Round mortar bomb, fin-stabilised |
| `proj_rocket` | 22 × 8 px | Rocket with exhaust plume, pointed nose |
| `proj_flame` | 24 × 12 px | Flame tongue, orange-red gradient, irregular edge |

---

### 8. Effects — animated spritesheets (horizontal strip, no padding)

| Key | Frame size | Frames | FPS | Description |
|-----|-----------|--------|-----|-------------|
| `fx_explosion` | 64 × 64 px | 7 | 18 | Standard explosion: fireball expanding then dissipating |
| `fx_explosion_big` | 96 × 96 px | 8 | 16 | Large explosion for boss kills and base destruction |
| `fx_muzzle` | 32 × 32 px | 4 | 30 | Muzzle flash, bright white-yellow starburst |
| `fx_smoke` | 48 × 48 px | 6 | 14 | Rising smoke cloud, dark grey fading to transparent |
| `fx_impact` | 24 × 24 px | 4 | 24 | Bullet impact spark / ricochet flash |
| `fx_flame` | 44 × 32 px | 5 | 18 | Continuous flame loop for flame thrower hit |
| `fx_dust` | 32 × 32 px | 5 | 14 | Dust puff when units move on dirt |

---

### 9. UI Elements

#### Buttons — 3 states each (normal / hover / press), opaque dark background

| Key set | Colour | Size |
|---------|--------|------|
| `ui_button`, `ui_button_hover`, `ui_button_press` | Neutral grey | 180 × 36 px |
| `ui_button_green`, `ui_button_green_hover`, `ui_button_green_press` | Green border | 180 × 36 px |
| `ui_button_red`, `ui_button_red_hover`, `ui_button_red_press` | Red border | 180 × 36 px |

#### Panels & bars

| Key | Size | Description |
|-----|------|-------------|
| `ui_panel` | 200 × 200 px | Dark panel background tile (repeatable) |
| `ui_card` | 66 × 80 px | Tower palette card, dark with subtle border |
| `ui_bar_frame` | 200 × 16 px | HP bar outer frame |
| `ui_bar_green` | 200 × 16 px | HP bar fill — healthy |
| `ui_bar_yellow` | 200 × 16 px | HP bar fill — damaged |
| `ui_bar_red` | 200 × 16 px | HP bar fill — critical |

#### Markers & HUD

| Key | Size | Description |
|-----|------|-------------|
| `ui_range` | 200 × 200 px | Circular range indicator, soft glow ring, transparent fill |
| `ui_place_ok` | 48 × 48 px | Green placement checkmark tile overlay |
| `ui_place_no` | 48 × 48 px | Red placement X tile overlay |
| `ui_coin` | 20 × 20 px | Gold coin icon |
| `ui_wave_banner` | 460 × 90 px | Wide dark banner for wave announcements |

#### Icons — 24 × 24 px each, monochrome line art on transparent background

`icon_upgrade` `icon_sell` `icon_pause` `icon_play` `icon_fast` `icon_target` `icon_damage` `icon_settings` `icon_star` `icon_heart` `icon_skull` `icon_ammo` `icon_shield` `icon_fire` `icon_lock` `icon_plus` `icon_close` `icon_menu` `icon_sound_on` `icon_sound_off` `icon_speed` `icon_flag`

---

## File Naming & Folder Structure

```
assets/
  tiles/          tile_grass.png, tile_grass2.png, tile_dirt.png … path_h.png …
  deco/           deco_tree.png, deco_bush.png …
  towers/         tower_rifle_base_p0.png … tower_command_gun_p4.png
  bases/          base_hq_p0.png … base_flag_p4.png
  units/          unit_motorcycle_p0.png … unit_boss_p0.png
                  unit_infantry_p0.png … unit_grenadier_p4.png  (spritesheets)
  fx/             proj_bullet.png … proj_flame.png
                  fx_explosion.png … fx_dust.png  (spritesheets)
  ui/             ui_panel.png … ui_wave_banner.png, all button states
  icons/          icon_upgrade.png … icon_flag.png
  manifest.json   machine-readable index (provided separately — do not generate)
```

---

## Key Gameplay Rules That Inform the Art

1. **Towers do not move.** The gun sprite rotates to face the nearest enemy within range. The barrel tip fires a projectile that travels to the target. Design guns with a clear barrel direction (pointing east).

2. **Enemies navigate via A* pathfinding with probabilistic route selection** — they do not follow a fixed lane. Multiple enemies spread across the map simultaneously. Terrain must clearly distinguish passable (grass, dirt) from impassable (water, deco objects) tiles.

3. **Team territories are visually distinct.** Blue (p1) and Red (p2) bases sit at opposite ends of the map. Their towers carry their team colour so players instantly know who built what.

4. **HP bars are rendered in code** — not a sprite concern. Explosions and muzzle flashes are time-critical and must read clearly at small sizes even without anti-aliasing.

5. **Build phase** — during the 8-second prep window between waves the map is quiet. Towers should have clean silhouettes amenable to a subtle colour tint applied in code to indicate readiness.

6. **Upgrades** — towers have 3 levels handled in code (damage/range scaling). No upgrade sprite variants are needed.

---

## Deliverables Checklist

| Category | Count |
|----------|-------|
| Terrain tiles | 9 |
| Path tiles | 15 |
| Decoration sprites | 9 |
| Tower sprites (12 towers × 2 parts × 5 teams) | 120 |
| Base sprites (3 types × 5 teams) | 15 |
| Vehicle sprites (8 types × 5 teams) | 40 |
| Infantry spritesheets (7 types × 5 teams) | 35 |
| Projectile sprites | 6 |
| Effect spritesheets | 7 |
| UI panels / buttons / bars / markers | 21 |
| Icon sprites | 22 |
| **Total** | **~299 files** |
