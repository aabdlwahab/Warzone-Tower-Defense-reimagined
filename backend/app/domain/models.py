"""Domain models for the multiplayer tower defense simulation."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from math import hypot


class GameStatus(str, Enum):
    WAITING = "waiting"
    RUNNING = "running"
    VICTORY = "victory"
    DEFEAT = "defeat"
    FINISHED = "finished"


@dataclass(frozen=True)
class Tile:
    x: int
    y: int


@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def get_distance(self, point: "Point") -> float:
        return hypot(self.x - point.x, self.y - point.y)


@dataclass(frozen=True)
class Base:
    team: str
    tile: Tile


@dataclass(frozen=True)
class Spawn:
    tile: Tile
    target: str
    team: str | None = None


@dataclass(frozen=True)
class Deco:
    key: str
    tile: Tile


# 4-connected grid movement.
NEIGHBOR_OFFSETS = ((1, 0), (-1, 0), (0, 1), (0, -1))


@dataclass(frozen=True)
class MapDefinition:
    id: str
    name: str
    mode: str
    players: int
    cols: int
    rows: int
    tile: int
    bases: tuple[Base, ...]
    spawns: tuple[Spawn, ...]
    water: frozenset[Tile]
    deco: tuple[Deco, ...]
    static_blocked: frozenset[Tile]
    buildable: frozenset[Tile]

    def in_bounds(self, tile: Tile) -> bool:
        return 0 <= tile.x < self.cols and 0 <= tile.y < self.rows

    def can_build(self, tile: Tile) -> bool:
        return tile in self.buildable

    def base_tile(self, team: str) -> Tile | None:
        for base in self.bases:
            if base.team == team:
                return base.tile

        return None

    def center(self, tile: Tile) -> Point:
        return Point(tile.x + 0.5, tile.y + 0.5)

    def walkable(self, tile: Tile, target: str, occupied: frozenset[Tile]) -> bool:
        if not self.in_bounds(tile):
            return False

        if tile in occupied:
            return False

        if tile not in self.static_blocked:
            return True

        # The target's own base cell is the goal, so it must be enterable even
        # though every base tile is otherwise blocked.
        return tile == self.base_tile(target)

    def neighbors(self, tile: Tile, target: str, occupied: frozenset[Tile]) -> list[Tile]:
        result = []

        for dx, dy in NEIGHBOR_OFFSETS:
            candidate = Tile(tile.x + dx, tile.y + dy)

            if self.walkable(candidate, target, occupied):
                result.append(candidate)

        return result


@dataclass(frozen=True)
class TowerDefinition:
    id: str
    cost: int
    range: float
    damage: float
    fire_rate: float
    splash_radius: float = 0.0
    slow: float = 0.0
    slow_seconds: float = 0.0
    income: int = 0
    upgradeable: bool = True

    def get_damage(self, level: int) -> float:
        return self.damage * (1.0 + 0.35 * (level - 1))

    def get_range(self, level: int) -> float:
        return self.range * (1.0 + 0.10 * (level - 1))

    def get_dps(self, level: int) -> float:
        return self.get_damage(level) * self.fire_rate

    def get_upgrade_cost(self, level: int) -> int:
        return int(self.cost * (0.75 + 0.35 * level))


@dataclass(frozen=True)
class EnemyDefinition:
    id: str
    health: float
    speed: float
    reward: int
    cost: int
    radius: float = 0.45
    damage: int = 1
    armor: float = 0.0
    kind: str = "veh"
    boss: bool = False


@dataclass(frozen=True)
class WaveEntry:
    enemy_id: str
    count: int
    interval: float


@dataclass(frozen=True)
class WaveDefinition:
    entries: tuple[WaveEntry, ...]


@dataclass(frozen=True)
class JoinCommand:
    name: str


@dataclass(frozen=True)
class PlaceCommand:
    player_id: str
    tower_type: str
    tile: Tile


@dataclass(frozen=True)
class DispatchCommand:
    player_id: str
    unit_type: str
    target_team: str | None = None


@dataclass(frozen=True)
class UpgradeCommand:
    player_id: str
    tower_id: str


@dataclass
class Player:
    id: str
    name: str
    money: int
    team: str = ""
    ready: bool = False
    token: str = ""
    connected: bool = True
    alive: bool = True


@dataclass
class Tower:
    id: str
    owner_id: str
    team: str
    kind: str
    tile: Tile
    level: int = 1
    cooldown: float = 0.0

    def can_fire(self) -> bool:
        return self.cooldown <= 0

    def fire(self, cooldown: float) -> None:
        self.cooldown = cooldown

    def tick(self, seconds: float) -> None:
        self.cooldown = max(0.0, self.cooldown - seconds)

    def upgrade(self) -> None:
        self.level += 1


@dataclass
class Enemy:
    id: str
    kind: str
    target: str
    health: float
    position: Point
    path: list[Tile] = field(default_factory=list)
    heading: float = 0.0
    speed_scale: float = 1.0
    slow_seconds: float = 0.0
    owner_id: str | None = None
    base_damage: float = 1.0

    def damage(self, amount: float) -> None:
        self.health -= amount

    def get_scale(self) -> float:
        if self.slow_seconds <= 0:
            return 1.0

        return self.speed_scale

    def remaining(self) -> int:
        return len(self.path)

    def has_arrived(self) -> bool:
        return not self.path

    def is_dead(self) -> bool:
        return self.health <= 0

    def slow(self, amount: float, seconds: float) -> None:
        self.speed_scale = min(self.speed_scale, max(0.1, 1.0 - amount))
        self.slow_seconds = max(self.slow_seconds, seconds)

    def tick(self, seconds: float) -> None:
        self.slow_seconds = max(0.0, self.slow_seconds - seconds)

        if self.slow_seconds == 0:
            self.speed_scale = 1.0
