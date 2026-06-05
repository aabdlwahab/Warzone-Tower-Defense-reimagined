"""State stores for the game simulation."""

from __future__ import annotations

from typing import Any

from backend.app.domain.errors import MissingError, ValidationError
from backend.app.domain.models import Enemy, GameStatus, MapDefinition, Player, Tile, Tower


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
        self.get(player_id).money += amount

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


class WaveStore:
    def __init__(self) -> None:
        self._index = 0
        self._entry = 0
        self._spawned = 0
        self._elapsed = 0.0
        self._active = False

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

    def tick(self, seconds: float) -> None:
        self._elapsed += seconds


class GameStore:
    def __init__(
        self,
        room_id: str,
        map_definition: MapDefinition,
        max_players: int,
        base_health: int,
    ) -> None:
        self.players = PlayerStore(max_players)
        self.towers = TowerStore()
        self.enemies = EnemyStore()
        self.wave = WaveStore()
        self._room_id = room_id
        self._map = map_definition
        self._health = base_health
        self._status = GameStatus.WAITING
        self._player_index = 0
        self._tower_index = 0
        self._enemy_index = 0
        self._events: list[dict[str, Any]] = []

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

    def get_health(self) -> int:
        return self._health

    def get_map(self) -> MapDefinition:
        return self._map

    def get_room(self) -> str:
        return self._room_id

    def get_status(self) -> GameStatus:
        return self._status

    def set_status(self, status: GameStatus) -> None:
        self._status = status

    def damage(self, amount: int) -> None:
        self._health = max(0, self._health - amount)

