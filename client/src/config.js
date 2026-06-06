/* =====================================================================
   WARZONE — client-side game data
   The backend is authoritative for simulation; this file holds purely
   *presentation* metadata: layout constants, palette, and the tooltip-
   facing stats for towers and units. TEAM_COLORS mirrors the sprite-
   forge palette — keep them in sync if you recolor assets.
   ===================================================================== */

export const TILE = 48;
export const TOP_BAR_HEIGHT = 40;
export const HUD_BAR_HEIGHT = 80;

export const MAX_TOWER_LEVEL = 3;

// Sprite-suffix → display info. `p0` is the neutral/hostile color.
export const TEAM_COLORS = {
  p0: { id: 'p0', name: 'Hostile', hex: 0x86922f, css: '#86922f' },
  p1: { id: 'p1', name: 'Blue',    hex: 0x2e74d6, css: '#2e74d6' },
  p2: { id: 'p2', name: 'Red',     hex: 0xe8413a, css: '#e8413a' },
  p3: { id: 'p3', name: 'Green',   hex: 0x25c065, css: '#25c065' },
  p4: { id: 'p4', name: 'Amber',   hex: 0xf5b21e, css: '#f5b21e' },
};

// Server-side equivalents live in backend/app/domain/catalogs.py — keep
// `cost`, `range`, `dmg`, and `cd` in sync if you rebalance.
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

// Tower level scaling — matches backend TowerDefinition.get_*().
export function towerUpgradeCost(towerKey, level) {
  const tower = TOWERS[towerKey];
  if (!tower || level >= MAX_TOWER_LEVEL) return null;
  return Math.trunc(tower.cost * (0.75 + 0.35 * level));
}

export function towerDamageAtLevel(towerKey, level) {
  const tower = TOWERS[towerKey];
  return tower ? tower.dmg * (1 + 0.35 * (level - 1)) : 0;
}

export function towerRangeAtLevel(towerKey, level) {
  const tower = TOWERS[towerKey];
  return tower ? tower.range * (1 + 0.10 * (level - 1)) : 0;
}

// Server-side equivalents live in backend/app/domain/catalogs.py.
export const UNITS = {
  infantry:   { name: 'Rifleman',     hp: 40,   speed: 70,  reward: 12, cost: 35,   dmg: 1,  kind: 'inf' },
  officer:    { name: 'Officer',      hp: 60,   speed: 75,  reward: 20, cost: 55,   dmg: 2,  kind: 'inf' },
  medic:      { name: 'Medic',        hp: 55,   speed: 72,  reward: 18, cost: 50,   dmg: 1,  kind: 'inf', heals: true },
  engineer:   { name: 'Engineer',     hp: 70,   speed: 65,  reward: 20, cost: 60,   dmg: 1,  kind: 'inf' },
  scout:      { name: 'Scout',        hp: 30,   speed: 130, reward: 14, cost: 45,   dmg: 1,  kind: 'inf' },
  heavy:      { name: 'Heavy Gunner', hp: 120,  speed: 55,  reward: 28, cost: 90,   dmg: 3,  kind: 'inf' },
  grenadier:  { name: 'Grenadier',    hp: 80,   speed: 68,  reward: 24, cost: 75,   dmg: 2,  kind: 'inf' },
  motorcycle: { name: 'Motorcycle',   hp: 70,   speed: 150, reward: 24, cost: 85,   dmg: 2,  kind: 'veh' },
  armoredcar: { name: 'Armored Car',  hp: 160,  speed: 95,  reward: 36, cost: 130,  dmg: 3,  kind: 'veh' },
  halftrack:  { name: 'Half-track',   hp: 220,  speed: 80,  reward: 44, cost: 165,  dmg: 4,  kind: 'veh' },
  lighttank:  { name: 'Light Tank',   hp: 300,  speed: 70,  reward: 52, cost: 210,  dmg: 5,  kind: 'veh' },
  arttruck:   { name: 'Arty Truck',   hp: 260,  speed: 75,  reward: 48, cost: 190,  dmg: 4,  kind: 'veh' },
  mediumtank: { name: 'Medium Tank',  hp: 520,  speed: 58,  reward: 80, cost: 320,  dmg: 8,  kind: 'veh' },
  heavytank:  { name: 'Heavy Tank',   hp: 900,  speed: 46,  reward: 130,cost: 520,  dmg: 12, kind: 'veh' },
  boss:       { name: 'King Tiger',   hp: 5000, speed: 38,  reward: 800,cost: 1800, dmg: 50, kind: 'veh', boss: true },
};
export const UNIT_ORDER = ['infantry','scout','grenadier','heavy','motorcycle','armoredcar','halftrack','lighttank','mediumtank','heavytank'];

// Unit kinds that render as walking-animation spritesheets instead of a
// single image. Shared between the Game scene (enemy sprites) and the HUD
// palette (unit cards).
export const INFANTRY_KINDS = new Set([
  'infantry', 'officer', 'medic', 'engineer', 'scout', 'heavy', 'grenadier',
]);
