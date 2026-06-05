"""Domain models for the multiplayer tower defense simulation."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from math import hypot


class GameStatus(str, Enum):
    WAITING = "waiting"
    RUNNING = "running"
    VICTORY = "victory"
    DEFEAT = "defeat"


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
class MapDefinition:
    id: str
    width: int
    height: int
    path: tuple[Point, ...]
    buildable: frozenset[Tile]

    def can_build(self, tile: Tile) -> bool:
        return tile in self.buildable

    def get_length(self) -> float:
        length = 0.0

        for index in range(len(self.path) - 1):
            length += self.path[index].get_distance(self.path[index + 1])

        return length

    def get_position(self, distance: float) -> Point:
        remaining = max(0.0, distance)

        for index in range(len(self.path) - 1):
            start = self.path[index]
            end = self.path[index + 1]
            length = start.get_distance(end)

            if remaining <= length:
                return self._get_position(start, end, remaining, length)

            remaining -= length

        return self.path[-1]

    def _get_position(
        self,
        start: Point,
        end: Point,
        distance: float,
        length: float,
    ) -> Point:
        if length == 0:
            return start

        ratio = distance / length
        return Point(
            x=start.x + (end.x - start.x) * ratio,
            y=start.y + (end.y - start.y) * ratio,
        )


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

    def get_damage(self, level: int) -> float:
        return self.damage * (1.0 + 0.35 * (level - 1))

    def get_range(self, level: int) -> float:
        return self.range * (1.0 + 0.10 * (level - 1))

    def get_upgrade_cost(self, level: int) -> int:
        return int(self.cost * (0.75 + 0.35 * level))


@dataclass(frozen=True)
class EnemyDefinition:
    id: str
    health: float
    speed: float
    reward: int
    armor: float = 0.0


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
class UpgradeCommand:
    player_id: str
    tower_id: str


@dataclass
class Player:
    id: str
    name: str
    money: int
    ready: bool = False
    token: str = ""
    connected: bool = True


@dataclass
class Tower:
    id: str
    owner_id: str
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
    health: float
    distance: float = 0.0
    speed_scale: float = 1.0
    slow_seconds: float = 0.0

    def damage(self, amount: float) -> None:
        self.health -= amount

    def get_scale(self) -> float:
        if self.slow_seconds <= 0:
            return 1.0

        return self.speed_scale

    def has_finished(self, length: float) -> bool:
        return self.distance >= length

    def is_dead(self) -> bool:
        return self.health <= 0

    def move(self, amount: float) -> None:
        self.distance += amount

    def slow(self, amount: float, seconds: float) -> None:
        self.speed_scale = min(self.speed_scale, max(0.1, 1.0 - amount))
        self.slow_seconds = max(self.slow_seconds, seconds)

    def tick(self, seconds: float) -> None:
        self.slow_seconds = max(0.0, self.slow_seconds - seconds)

        if self.slow_seconds == 0:
            self.speed_scale = 1.0

