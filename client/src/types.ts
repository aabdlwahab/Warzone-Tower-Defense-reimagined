export type Tile = {
  x: number;
  y: number;
};

export type Point = {
  x: number;
  y: number;
};

export type Player = {
  id: string;
  name: string;
  money: number;
  ready: boolean;
  connected: boolean;
};

export type Tower = {
  id: string;
  owner_id: string;
  kind: string;
  level: number;
  x: number;
  y: number;
};

export type Enemy = {
  id: string;
  kind: string;
  health: number;
  distance: number;
  position: Point;
};

export type GameMap = {
  id: string;
  width: number;
  height: number;
  path: Point[];
  buildable: Tile[];
};

export type StateSnapshot = {
  room_id: string;
  status: string;
  base_health: number;
  wave: number;
  wave_active: boolean;
  players: Player[];
  towers: Tower[];
  enemies: Enemy[];
};

export type Snapshot = StateSnapshot & {
  map: GameMap;
};

export type GameEvent =
  | { type: "shot"; tower_id: string; kind: string; x: number; y: number; tx: number; ty: number }
  | { type: "kill"; enemy_id: string; kind: string; x: number; y: number }
  | { type: "leak"; enemy_id: string; kind: string; x: number; y: number }
  | { type: "placed"; tower_id: string; kind: string; x: number; y: number }
  | { type: "upgraded"; tower_id: string; kind: string; level: number; x: number; y: number };

export type ServerMessage =
  | { type: "joined"; player_id: string; token: string; payload: Snapshot }
  | { type: "resumed"; player_id: string; payload: Snapshot }
  | { type: "snapshot"; payload: StateSnapshot; events: GameEvent[] }
  | { type: "resume_failed" }
  | { type: "error"; message: string }
  | { type: "pong" };

