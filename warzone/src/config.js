/* =====================================================================
   WARZONE — game configuration & balance data
   Everything tunable lives here. TEAM_COLORS mirrors the sprite forge
   (tools/forge/00-core.js SF.TEAMS) — keep them in sync if you recolor.
   ===================================================================== */

export const TILE = 48;
export const COLS = 20;
export const ROWS = 13;

/* ---- Players / teams (up to 4) ----------------------------------
   id matches the baked sprite suffix (_p1.._p4); p0 = neutral foe.
   `hex` is the numeric form Phaser uses for tints / UI strokes.       */
export const TEAM_COLORS = {
  p0: { id: 'p0', name: 'Hostile', hex: 0x86922f, css: '#86922f' },
  p1: { id: 'p1', name: 'Blue',    hex: 0x2e74d6, css: '#2e74d6' },
  p2: { id: 'p2', name: 'Red',     hex: 0xe8413a, css: '#e8413a' },
  p3: { id: 'p3', name: 'Green',   hex: 0x25c065, css: '#25c065' },
  p4: { id: 'p4', name: 'Amber',   hex: 0xf5b21e, css: '#f5b21e' },
};

// How many human players this match has, and which team the local
// player builds for. Swap PLAYER_TEAM to 'p2'/'p3'/'p4' to test colors.
export const PLAYER_TEAM = 'p1';
export const PLAYER_COUNT = 4;

/* ---- Defenses (towers) ------------------------------------------
   cost, range(px), dmg, cd(ms cooldown), proj(sprite key | null),
   splash(px, 0 = single target), turn(rad/s gun rotation speed).      */
export const TOWERS = {
  rifle:    { name: 'Rifle Pit',     cost: 50,  range: 150, dmg: 8,   cd: 700,  proj: 'proj_bullet', splash: 0,  turn: 9 },
  mg:       { name: 'MG Nest',       cost: 100, range: 165, dmg: 5,   cd: 160,  proj: 'proj_tracer', splash: 0,  turn: 10 },
  mortar:   { name: 'Mortar Pit',    cost: 140, range: 230, dmg: 26,  cd: 1500, proj: 'proj_mortar', splash: 56, turn: 3 },
  cannon:   { name: 'Field Cannon',  cost: 160, range: 210, dmg: 34,  cd: 1100, proj: 'proj_shell',  splash: 0,  turn: 5 },
  at:       { name: 'Anti-Tank Gun', cost: 200, range: 250, dmg: 70,  cd: 1400, proj: 'proj_shell',  splash: 0,  turn: 5 },
  flak:     { name: 'Flak Cannon',   cost: 180, range: 190, dmg: 12,  cd: 280,  proj: 'proj_bullet', splash: 24, turn: 8 },
  howitzer: { name: 'Howitzer',      cost: 260, range: 300, dmg: 55,  cd: 2200, proj: 'proj_shell',  splash: 70, turn: 2.5 },
  sniper:   { name: 'Sniper Post',   cost: 150, range: 360, dmg: 90,  cd: 1900, proj: 'proj_bullet', splash: 0,  turn: 6 },
  flame:    { name: 'Flame Bunker',  cost: 170, range: 110, dmg: 4,   cd: 90,   proj: 'proj_flame',  splash: 40, turn: 7 },
  rocket:   { name: 'Rocket Battery',cost: 240, range: 260, dmg: 30,  cd: 1300, proj: 'proj_rocket', splash: 60, turn: 4 },
  bazooka:  { name: 'Bazooka Team',  cost: 190, range: 220, dmg: 60,  cd: 1600, proj: 'proj_rocket', splash: 30, turn: 5 },
  command:  { name: 'HQ Bunker',     cost: 300, range: 0,   dmg: 0,   cd: 0,    proj: null,          splash: 0,  turn: 0.6, income: 18 },
};
export const TOWER_ORDER = ['rifle','mg','mortar','cannon','at','flak','howitzer','sniper','flame','rocket','bazooka','command'];

/* ---- Units / vehicles -------------------------------------------
   hp, speed(px/s), reward($), dmg(to base), kind, scale.              */
export const UNITS = {
  infantry:   { name: 'Rifleman',     hp: 40,   speed: 70,  reward: 6,  dmg: 1,  kind: 'inf' },
  officer:    { name: 'Officer',      hp: 60,   speed: 75,  reward: 10, dmg: 2,  kind: 'inf' },
  medic:      { name: 'Medic',        hp: 55,   speed: 72,  reward: 9,  dmg: 1,  kind: 'inf', heals: true },
  engineer:   { name: 'Engineer',     hp: 70,   speed: 65,  reward: 10, dmg: 1,  kind: 'inf' },
  scout:      { name: 'Scout',        hp: 30,   speed: 130, reward: 7,  dmg: 1,  kind: 'inf' },
  heavy:      { name: 'Heavy Gunner', hp: 120,  speed: 55,  reward: 14, dmg: 3,  kind: 'inf' },
  grenadier:  { name: 'Grenadier',    hp: 80,   speed: 68,  reward: 12, dmg: 2,  kind: 'inf' },
  motorcycle: { name: 'Motorcycle',   hp: 70,   speed: 150, reward: 12, dmg: 2,  kind: 'veh' },
  armoredcar: { name: 'Armored Car',  hp: 160,  speed: 95,  reward: 18, dmg: 3,  kind: 'veh' },
  halftrack:  { name: 'Half-track',   hp: 220,  speed: 80,  reward: 22, dmg: 4,  kind: 'veh' },
  lighttank:  { name: 'Light Tank',   hp: 300,  speed: 70,  reward: 26, dmg: 5,  kind: 'veh' },
  arttruck:   { name: 'Arty Truck',   hp: 260,  speed: 75,  reward: 24, dmg: 4,  kind: 'veh' },
  mediumtank: { name: 'Medium Tank',  hp: 520,  speed: 58,  reward: 40, dmg: 8,  kind: 'veh' },
  heavytank:  { name: 'Heavy Tank',   hp: 900,  speed: 46,  reward: 65, dmg: 12, kind: 'veh' },
  boss:       { name: 'King Tiger',   hp: 5000, speed: 38,  reward: 400,dmg: 50, kind: 'veh', boss: true },
};

/* ---- Waves -------------------------------------------------------
   Each wave = list of {unit, count, gap(ms between spawns)}.          */
export const WAVES = [
  [ { unit:'infantry', count:8,  gap:700 } ],
  [ { unit:'infantry', count:10, gap:600 }, { unit:'scout', count:3, gap:500 } ],
  [ { unit:'infantry', count:8,  gap:500 }, { unit:'motorcycle', count:4, gap:700 } ],
  [ { unit:'grenadier',count:8,  gap:550 }, { unit:'armoredcar', count:3, gap:900 } ],
  [ { unit:'heavy',    count:6,  gap:700 }, { unit:'halftrack', count:3, gap:1000 } ],
  [ { unit:'lighttank',count:5,  gap:1100 }, { unit:'infantry', count:12, gap:300 } ],
  [ { unit:'arttruck', count:4,  gap:1000 }, { unit:'medic', count:4, gap:600 }, { unit:'heavy', count:6, gap:500 } ],
  [ { unit:'mediumtank',count:5, gap:1200 }, { unit:'scout', count:8, gap:300 } ],
  [ { unit:'heavytank',count:4,  gap:1500 }, { unit:'lighttank', count:4, gap:900 } ],
  [ { unit:'boss',     count:1,  gap:0 },    { unit:'heavytank', count:3, gap:1400 } ],
];

export const START_MONEY = 320;
export const START_BASE_HP = 100;

/* ---- Map: lane waypoints (grid coords) --------------------------
   Units march along this; the HQ sits at the final point.            */
export const LANE = [
  { x: -1, y: 6 }, { x: 4, y: 6 }, { x: 4, y: 2 }, { x: 9, y: 2 },
  { x: 9, y: 10 }, { x: 14, y: 10 }, { x: 14, y: 5 }, { x: 18, y: 5 },
];
