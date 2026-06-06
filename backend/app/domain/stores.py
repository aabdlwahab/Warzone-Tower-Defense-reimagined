"""State stores for the game simulation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from backend.app.domain.errors import MissingError, ValidationError
from backend.app.domain.models import Enemy, GameStatus, MapDefinition, Player, Tile, Tower
from backend.app.domain.pathing import Navigator


# Per-dispatch HP/damage upgrade earned every UNIT_UPGRADE_INTERVAL units sent.
UNIT_UPGRADE_INTERVAL = 10
UNIT_UPGRADE_BONUS = 0.10

# PvP passive cashflow paid to every alive player at a fixed cadence.
PVP_PASSIVE_INCOME = 12
PVP_INCOME_INTERVAL = 3.0


@dataclass
class QueuedDispatch:
    player_id: str
    team: str
    unit_type: str
    target: str
    health_multiplier: float
    damage_multiplier: float
    cost: int
    count: int
    level: int
    bonus_pct: int
    interval: float


class PlayerStore:
    def __init__(self, limit: int) -> None:
        self._limit = limit
        self._items: dict[str, Player] = {}

    def has(self, player_id: str) -> bool:
        return player_id in self._items

    def get(self, player_id: str) -> Player:
        if player_id not in self._items:
            raise MissingError("Player does not exist")

        return self._items[player_id]

    def list(self) -> list[Player]:
        return list(self._items.values())

    def count(self) -> int:
        return len(self._items)

    def add(self, player: Player) -> None:
        if len(self._items) >= self._limit:
            raise ValidationError("Room is full")

        if player.id in self._items:
            raise ValidationError("Player already exists")

        self._items[player.id] = player

    def pay(self, player_id: str, amount: int) -> None:
        player = self.get(player_id)

        if player.money < amount:
            raise ValidationError("Not enough money")

        player.money -= amount

    def ready(self, player_id: str) -> None:
        self.get(player_id).ready = True

    def reward(self, player_id: str, amount: int) -> None:
        if player_id in self._items:
            self._items[player_id].money += amount

    def set_alive(self, player_id: str, alive: bool) -> None:
        if player_id in self._items:
            self._items[player_id].alive = alive

    def remove(self, player_id: str) -> None:
        self._items.pop(player_id, None)

    def set_connected(self, player_id: str, connected: bool) -> None:
        if player_id in self._items:
            self._items[player_id].connected = connected

    def get_by_token(self, token: str) -> Player | None:
        if not token:
            return None

        for player in self._items.values():
            if player.token == token:
                return player

        return None


class TowerStore:
    def __init__(self) -> None:
        self._items: dict[str, Tower] = {}

    def get(self, tower_id: str) -> Tower:
        if tower_id not in self._items:
            raise MissingError("Tower does not exist")

        return self._items[tower_id]

    def get_at(self, tile: Tile) -> Tower | None:
        for tower in self._items.values():
            if tower.tile == tile:
                return tower

        return None

    def has_at(self, tile: Tile) -> bool:
        return self.get_at(tile) is not None

    def list(self) -> list[Tower]:
        return list(self._items.values())

    def tiles(self) -> frozenset[Tile]:
        return frozenset(tower.tile for tower in self._items.values())

    def add(self, tower: Tower) -> None:
        if tower.id in self._items:
            raise ValidationError("Tower already exists")

        if self.has_at(tower.tile):
            raise ValidationError("Tile already has a tower")

        self._items[tower.id] = tower


class EnemyStore:
    def __init__(self) -> None:
        self._items: dict[str, Enemy] = {}

    def get(self, enemy_id: str) -> Enemy:
        if enemy_id not in self._items:
            raise MissingError("Enemy does not exist")

        return self._items[enemy_id]

    def list(self) -> list[Enemy]:
        return list(self._items.values())

    def add(self, enemy: Enemy) -> None:
        if enemy.id in self._items:
            raise ValidationError("Enemy already exists")

        self._items[enemy.id] = enemy

    def remove(self, enemy_id: str) -> None:
        if enemy_id in self._items:
            del self._items[enemy_id]


class UnitProgressStore:
    """Tracks how many of each unit type a player has dispatched so we can
    award a permanent +10% HP/damage bonus every UNIT_UPGRADE_INTERVAL units."""

    def __init__(self) -> None:
        self._counts: dict[tuple[str, str], int] = {}

    def get_count(self, player_id: str, unit_type: str) -> int:
        return self._counts.get((player_id, unit_type), 0)

    def get_level_for_count(self, count: int) -> int:
        return 1 + max(0, count // UNIT_UPGRADE_INTERVAL)

    def get_multiplier_for_level(self, level: int) -> float:
        return 1.0 + UNIT_UPGRADE_BONUS * max(0, level - 1)

    def record_dispatch(self, player_id: str, unit_type: str) -> dict[str, object]:
        count = self.get_count(player_id, unit_type) + 1
        self._counts[(player_id, unit_type)] = count
        level = self.get_level_for_count(count)
        return {
            "count": count,
            "level": level,
            "upgraded": count % UNIT_UPGRADE_INTERVAL == 0,
        }


class DispatchQueueStore:
    def __init__(self) -> None:
        self._items: list[QueuedDispatch] = []
        self._elapsed = 0.0

    def add_many(self, items: list[QueuedDispatch]) -> None:
        self._items.extend(items)

    def tick(self, seconds: float) -> None:
        if self._items:
            self._elapsed += seconds

    def peek_ready(self) -> QueuedDispatch | None:
        if not self._items:
            return None

        item = self._items[0]
        if self._elapsed < item.interval:
            return None

        return item

    def pop_ready(self) -> QueuedDispatch:
        item = self._items.pop(0)
        self._elapsed = 0.0
        return item


class WaveStore:
    def __init__(self) -> None:
        self._index = 0
        self._entry = 0
        self._spawned = 0
        self._elapsed = 0.0
        self._active = False
        self._ever_started = False
        self._prep_remaining = 0.0

    def can_spawn(self, interval: float) -> bool:
        return self._active and self._elapsed >= interval

    def get_entry(self) -> int:
        return self._entry

    def get_index(self) -> int:
        return self._index

    def get_spawned(self) -> int:
        return self._spawned

    def is_active(self) -> bool:
        return self._active

    def ever_started(self) -> bool:
        return self._ever_started

    # --- build-phase prep timer ---

    def start_prep(self, seconds: float) -> None:
        self._prep_remaining = max(0.0, seconds)

    def tick_prep(self, seconds: float) -> bool:
        """Advance the build-phase countdown. Returns True the tick it expires."""
        if self._prep_remaining <= 0.0:
            return False
        self._prep_remaining = max(0.0, self._prep_remaining - seconds)
        return self._prep_remaining == 0.0

    def prep_remaining(self) -> float:
        return self._prep_remaining

    def in_prep(self) -> bool:
        return self._prep_remaining > 0.0

    # --- wave lifecycle ---

    def advance(self) -> None:
        self._entry += 1
        self._spawned = 0
        self._elapsed = 0.0

    def complete(self) -> None:
        self._active = False
        self._elapsed = 0.0

    def next(self) -> None:
        self._index += 1
        self._entry = 0
        self._spawned = 0
        self._elapsed = 0.0
        self._active = False

    def spawn(self) -> None:
        self._spawned += 1
        self._elapsed = 0.0

    def start(self) -> None:
        self._entry = 0
        self._spawned = 0
        self._elapsed = 0.0
        self._active = True
        self._ever_started = True
        self._prep_remaining = 0.0

    def tick(self, seconds: float) -> None:
        self._elapsed += seconds


class GameStore:
    def __init__(
        self,
        room_id: str,
        map_definition: MapDefinition,
        base_health: int,
    ) -> None:
        self.players = PlayerStore(min(map_definition.players, len(map_definition.bases)))
        self.towers = TowerStore()
        self.enemies = EnemyStore()
        self.unit_progress = UnitProgressStore()
        self.dispatches = DispatchQueueStore()
        self.wave = WaveStore()
        self.navigator = Navigator(map_definition)
        self._room_id = room_id
        self._map = map_definition
        self._base_health = base_health
        self._health: dict[str, float] = {base.team: float(base_health) for base in map_definition.bases}
        self._owner: dict[str, str | None] = {base.team: None for base in map_definition.bases}
        self._status = GameStatus.WAITING
        self._winner: str | None = None
        self._events: list[dict[str, Any]] = []
        self._player_index = 0
        self._tower_index = 0
        self._enemy_index = 0
        self._pvp_income_elapsed = 0.0

    def add_event(self, event: dict[str, Any]) -> None:
        self._events.append(event)

    def drain_events(self) -> list[dict[str, Any]]:
        events = self._events
        self._events = []
        return events

    def create_enemy_id(self) -> str:
        self._enemy_index += 1
        return f"enemy-{self._enemy_index}"

    def create_player_id(self) -> str:
        self._player_index += 1
        return f"player-{self._player_index}"

    def create_tower_id(self) -> str:
        self._tower_index += 1
        return f"tower-{self._tower_index}"

    def next_free_team(self) -> str | None:
        for base in self._map.bases:
            if self._owner[base.team] is None:
                return base.team

        return None

    def claim_base(self, team: str, player_id: str) -> None:
        self._owner[team] = player_id

    def release_base(self, team: str) -> None:
        if team in self._owner:
            self._owner[team] = None

    def base_owner(self, team: str) -> str | None:
        return self._owner.get(team)

    def base_health(self, team: str) -> float:
        return self._health.get(team, 0)

    def base_alive(self, team: str) -> bool:
        return self._health.get(team, 0) > 0

    def damage_base(self, team: str, amount: float) -> None:
        if team in self._health:
            self._health[team] = max(0, self._health[team] - amount)

    def active_targets(self) -> set[str]:
        return {team for team, owner in self._owner.items() if owner is not None}

    def occupied(self) -> frozenset[Tile]:
        return self.towers.tiles()

    def rebuild_navigation(self, tower_defs) -> None:
        self.navigator.rebuild(self.towers.list(), tower_defs, self.active_targets())

    def get_health(self) -> int:
        return self._base_health

    def get_map(self) -> MapDefinition:
        return self._map

    def get_room(self) -> str:
        return self._room_id

    def get_status(self) -> GameStatus:
        return self._status

    def set_status(self, status: GameStatus) -> None:
        self._status = status

    def get_winner(self) -> str | None:
        return self._winner

    def set_winner(self, team: str | None) -> None:
        self._winner = team

    def tick_pvp_income(self, seconds: float) -> None:
        if self._map.mode != "pvp":
            return

        self._pvp_income_elapsed += seconds

        while self._pvp_income_elapsed >= PVP_INCOME_INTERVAL:
            self._pvp_income_elapsed -= PVP_INCOME_INTERVAL

            for player in self.players.list():
                if player.alive:
                    player.money += PVP_PASSIVE_INCOME
