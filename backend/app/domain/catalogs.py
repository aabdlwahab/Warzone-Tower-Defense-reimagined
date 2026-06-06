"""Static game definition catalogs and map loading."""

from __future__ import annotations

import json
from pathlib import Path

from backend.app.domain.errors import MissingError
from backend.app.domain.models import (
    Base,
    Deco,
    EnemyDefinition,
    MapDefinition,
    Spawn,
    Tile,
    TowerDefinition,
    WaveDefinition,
    WaveEntry,
)


STARTING_MONEY = 320
PVP_STARTING_MONEY = 420
BASE_HEALTH = 100
MAX_TOWER_LEVEL = 3
TILE_PIXELS = 48
DEFAULT_MAP_ID = "twin_fronts"
MAPS_DIR = Path(__file__).resolve().parent.parent / "maps"

# Single-player auto-wave timing (seconds).
INITIAL_BUILD_SECONDS = 8.0   # build phase before the first wave
INTER_WAVE_SECONDS    = 8.0   # build phase between waves

# Cadence used by income-generating towers (HQ Bunker).
INCOME_INTERVAL = 3.0


def _range(pixels: float) -> float:
    return round(pixels / TILE_PIXELS, 3)


def _rate(cooldown_ms: float) -> float:
    return round(1000.0 / cooldown_ms, 4) if cooldown_ms > 0 else 0.0


def _speed(pixels: float) -> float:
    return round(pixels / TILE_PIXELS, 3)


def _radius(pixels: float) -> float:
    return round(pixels / TILE_PIXELS, 3)


# Roster shared with the client's config.js (pixel-space units → tiles/second).
DEFAULT_TOWERS = {
    "obstacle": TowerDefinition("obstacle", cost=25, range=0.0, damage=0, fire_rate=0.0, upgradeable=False),
    "rifle": TowerDefinition("rifle", cost=50, range=_range(150), damage=8, fire_rate=_rate(700)),
    "mg": TowerDefinition("mg", cost=100, range=_range(165), damage=5, fire_rate=_rate(160)),
    "mortar": TowerDefinition("mortar", cost=140, range=_range(230), damage=26, fire_rate=_rate(1500), splash_radius=_range(56)),
    "cannon": TowerDefinition("cannon", cost=160, range=_range(210), damage=34, fire_rate=_rate(1100)),
    "at": TowerDefinition("at", cost=200, range=_range(250), damage=70, fire_rate=_rate(1400)),
    "flak": TowerDefinition("flak", cost=180, range=_range(190), damage=12, fire_rate=_rate(280), splash_radius=_range(24)),
    "howitzer": TowerDefinition("howitzer", cost=260, range=_range(300), damage=70, fire_rate=_rate(2200), splash_radius=_range(70)),
    "sniper": TowerDefinition("sniper", cost=210, range=_range(360), damage=90, fire_rate=_rate(1900)),
    "flame": TowerDefinition("flame", cost=220, range=_range(110), damage=4, fire_rate=_rate(90), splash_radius=_range(40), slow=0.25, slow_seconds=0.6),
    "rocket": TowerDefinition("rocket", cost=240, range=_range(260), damage=38, fire_rate=_rate(1300), splash_radius=_range(60)),
    "bazooka": TowerDefinition("bazooka", cost=190, range=_range(220), damage=60, fire_rate=_rate(1600), splash_radius=_range(30)),
    "command": TowerDefinition("command", cost=300, range=0.0, damage=0, fire_rate=0.0, income=18),
}

DEFAULT_ENEMIES = {
    "infantry": EnemyDefinition("infantry", health=40, speed=_speed(70), reward=12, cost=35, radius=_radius(18), damage=1, kind="inf"),
    "officer": EnemyDefinition("officer", health=60, speed=_speed(75), reward=20, cost=65, radius=_radius(18), damage=2, kind="inf"),
    "medic": EnemyDefinition("medic", health=55, speed=_speed(72), reward=18, cost=50, radius=_radius(18), damage=1, kind="inf"),
    "engineer": EnemyDefinition("engineer", health=70, speed=_speed(65), reward=20, cost=60, radius=_radius(18), damage=1, kind="inf"),
    "scout": EnemyDefinition("scout", health=30, speed=_speed(130), reward=14, cost=45, radius=_radius(16), damage=1, kind="inf"),
    "heavy": EnemyDefinition("heavy", health=120, speed=_speed(55), reward=28, cost=105, radius=_radius(20), damage=3, kind="inf"),
    "grenadier": EnemyDefinition("grenadier", health=80, speed=_speed(68), reward=24, cost=75, radius=_radius(18), damage=2, kind="inf"),
    "motorcycle": EnemyDefinition("motorcycle", health=70, speed=_speed(150), reward=24, cost=95, radius=_radius(20), damage=2, kind="veh"),
    "armoredcar": EnemyDefinition("armoredcar", health=160, speed=_speed(95), reward=36, cost=145, radius=_radius(24), damage=3, kind="veh"),
    "halftrack": EnemyDefinition("halftrack", health=220, speed=_speed(80), reward=44, cost=185, radius=_radius(26), damage=4, kind="veh"),
    "lighttank": EnemyDefinition("lighttank", health=300, speed=_speed(70), reward=52, cost=240, radius=_radius(24), damage=5, kind="veh"),
    "arttruck": EnemyDefinition("arttruck", health=260, speed=_speed(75), reward=48, cost=230, radius=_radius(28), damage=4, kind="veh"),
    "mediumtank": EnemyDefinition("mediumtank", health=520, speed=_speed(58), reward=80, cost=390, radius=_radius(30), damage=8, kind="veh"),
    "heavytank": EnemyDefinition("heavytank", health=900, speed=_speed(46), reward=130, cost=680, radius=_radius(32), damage=12, kind="veh"),
    "boss": EnemyDefinition("boss", health=5000, speed=_speed(38), reward=800, cost=2200, radius=_radius(44), damage=50, kind="veh", boss=True),
}


def _wave(*entries: tuple[str, int, float]) -> WaveDefinition:
    return WaveDefinition(entries=tuple(WaveEntry(enemy_id=e, count=c, interval=i) for e, c, i in entries))


DEFAULT_WAVES = (
    _wave(("infantry", 8, 0.7)),
    _wave(("infantry", 10, 0.6), ("scout", 3, 0.5)),
    _wave(("infantry", 8, 0.5), ("motorcycle", 4, 0.7)),
    _wave(("grenadier", 8, 0.55), ("armoredcar", 3, 0.9)),
    _wave(("heavy", 6, 0.7), ("halftrack", 3, 1.0)),
    _wave(("lighttank", 5, 1.1), ("infantry", 12, 0.3)),
    _wave(("arttruck", 4, 1.0), ("medic", 4, 0.6), ("heavy", 6, 0.5)),
    _wave(("mediumtank", 5, 1.2), ("scout", 8, 0.3)),
    _wave(("heavytank", 4, 1.5), ("lighttank", 4, 0.9)),
    _wave(("boss", 1, 0.0), ("heavytank", 3, 1.4)),
)


def load_map(data: dict) -> MapDefinition:
    cols = int(data["cols"])
    rows = int(data["rows"])
    water = frozenset(Tile(int(w["x"]), int(w["y"])) for w in data["water"])
    deco = tuple(Deco(d["key"], Tile(int(d["x"]), int(d["y"]))) for d in data["deco"])
    bases = tuple(Base(b["team"], Tile(int(b["x"]), int(b["y"]))) for b in data["bases"])
    spawns = tuple(
        Spawn(
            Tile(int(s["x"]), int(s["y"])),
            s.get("target") or bases[0].team,
            s.get("team"),
        )
        for s in data["spawns"]
    )

    deco_tiles = {entry.tile for entry in deco}
    base_tiles = {base.tile for base in bases}
    spawn_tiles = {spawn.tile for spawn in spawns}
    static_blocked = frozenset(water | deco_tiles | base_tiles)

    buildable = frozenset(
        Tile(x, y)
        for x in range(cols)
        for y in range(rows)
        if Tile(x, y) not in static_blocked and Tile(x, y) not in spawn_tiles
    )

    return MapDefinition(
        id=data["id"],
        name=data.get("name", data["id"]),
        mode=data.get("mode", "single"),
        players=int(data.get("players", len(bases))),
        cols=cols,
        rows=rows,
        tile=int(data.get("tile", TILE_PIXELS)),
        bases=bases,
        spawns=spawns,
        water=water,
        deco=deco,
        static_blocked=static_blocked,
        buildable=buildable,
    )


def load_maps(directory: Path = MAPS_DIR) -> dict[str, MapDefinition]:
    maps: dict[str, MapDefinition] = {}

    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text())
        definition = load_map(data)
        maps[definition.id] = definition

    if not maps:
        raise MissingError("No maps found")

    return maps


DEFAULT_MAPS = load_maps()


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

    def reload(self, items: dict[str, MapDefinition]) -> None:
        self._items = items

    def get(self, key: str) -> MapDefinition:
        if key not in self._items:
            raise MissingError("Map does not exist")

        return self._items[key]

    def has(self, key: str) -> bool:
        return key in self._items

    def list(self) -> list[MapDefinition]:
        return list(self._items.values())
