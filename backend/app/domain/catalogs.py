"""Static game definition catalogs."""

from __future__ import annotations

from backend.app.domain.errors import MissingError
from backend.app.domain.models import (
    EnemyDefinition,
    MapDefinition,
    Point,
    Tile,
    TowerDefinition,
    WaveDefinition,
    WaveEntry,
)


STARTING_MONEY = 300
MAX_PLAYERS = 4
BASE_HEALTH = 20
MAX_TOWER_LEVEL = 3
DEFAULT_MAP_ID = "crossfire"

DEFAULT_TOWERS = {
    "rifle": TowerDefinition(
        id="rifle",
        cost=100,
        range=3.0,
        damage=16,
        fire_rate=1.4,
    ),
    "cannon": TowerDefinition(
        id="cannon",
        cost=160,
        range=2.5,
        damage=28,
        fire_rate=0.75,
        splash_radius=1.0,
    ),
    "frost": TowerDefinition(
        id="frost",
        cost=140,
        range=2.75,
        damage=6,
        fire_rate=1.0,
        slow=0.45,
        slow_seconds=1.4,
    ),
}

DEFAULT_ENEMIES = {
    "grunt": EnemyDefinition(
        id="grunt",
        health=55,
        speed=1.1,
        reward=12,
    ),
    "runner": EnemyDefinition(
        id="runner",
        health=38,
        speed=1.7,
        reward=10,
    ),
    "armored": EnemyDefinition(
        id="armored",
        health=95,
        speed=0.8,
        reward=18,
        armor=4,
    ),
    "boss": EnemyDefinition(
        id="boss",
        health=340,
        speed=0.55,
        reward=75,
        armor=8,
    ),
}

DEFAULT_WAVES = (
    WaveDefinition(entries=(WaveEntry(enemy_id="grunt", count=8, interval=0.7),)),
    WaveDefinition(
        entries=(
            WaveEntry(enemy_id="grunt", count=8, interval=0.55),
            WaveEntry(enemy_id="runner", count=4, interval=0.75),
        ),
    ),
    WaveDefinition(
        entries=(
            WaveEntry(enemy_id="runner", count=8, interval=0.55),
            WaveEntry(enemy_id="armored", count=5, interval=1.0),
        ),
    ),
    WaveDefinition(
        entries=(
            WaveEntry(enemy_id="armored", count=8, interval=0.85),
            WaveEntry(enemy_id="boss", count=1, interval=1.5),
        ),
    ),
)

DEFAULT_MAPS = {
    DEFAULT_MAP_ID: MapDefinition(
        id=DEFAULT_MAP_ID,
        width=14,
        height=9,
        path=(
            Point(0.0, 4.5),
            Point(3.0, 4.5),
            Point(3.0, 1.5),
            Point(8.0, 1.5),
            Point(8.0, 6.5),
            Point(13.5, 6.5),
        ),
        buildable=frozenset(
            Tile(x, y)
            for x in range(14)
            for y in range(9)
            if (x, y)
            not in {
                (0, 4),
                (1, 4),
                (2, 4),
                (3, 4),
                (3, 3),
                (3, 2),
                (3, 1),
                (4, 1),
                (5, 1),
                (6, 1),
                (7, 1),
                (8, 1),
                (8, 2),
                (8, 3),
                (8, 4),
                (8, 5),
                (8, 6),
                (9, 6),
                (10, 6),
                (11, 6),
                (12, 6),
                (13, 6),
            }
        ),
    )
}


class TowerCatalog:
    def __init__(self, items: dict[str, TowerDefinition]) -> None:
        self._items = items

    def get(self, key: str) -> TowerDefinition:
        if key not in self._items:
            raise MissingError("Tower type does not exist")

        return self._items[key]

    def list(self) -> list[TowerDefinition]:
        return list(self._items.values())


class EnemyCatalog:
    def __init__(self, items: dict[str, EnemyDefinition]) -> None:
        self._items = items

    def get(self, key: str) -> EnemyDefinition:
        if key not in self._items:
            raise MissingError("Enemy type does not exist")

        return self._items[key]

    def list(self) -> list[EnemyDefinition]:
        return list(self._items.values())


class WaveCatalog:
    def __init__(self, items: tuple[WaveDefinition, ...]) -> None:
        self._items = items

    def get(self, index: int) -> WaveDefinition:
        if not self.has(index):
            raise MissingError("Wave does not exist")

        return self._items[index]

    def has(self, index: int) -> bool:
        return 0 <= index < len(self._items)

    def list(self) -> list[WaveDefinition]:
        return list(self._items)


class MapCatalog:
    def __init__(self, items: dict[str, MapDefinition]) -> None:
        self._items = items

    def get(self, key: str) -> MapDefinition:
        if key not in self._items:
            raise MissingError("Map does not exist")

        return self._items[key]

    def list(self) -> list[MapDefinition]:
        return list(self._items.values())

