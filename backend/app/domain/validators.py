"""Domain validators for player commands."""

from __future__ import annotations

import math

from backend.app.domain.catalogs import EnemyCatalog, MAX_TOWER_LEVEL, TowerCatalog
from backend.app.domain.errors import ValidationError
from backend.app.domain.models import (
    GameStatus,
    DispatchCommand,
    JoinCommand,
    MapDefinition,
    PlaceCommand,
    Tile,
    UpgradeCommand,
)
from backend.app.domain.stores import GameStore


FINISHED_STATES = {GameStatus.VICTORY, GameStatus.DEFEAT, GameStatus.FINISHED}


def nearest_team(map_definition: MapDefinition, tile: Tile) -> str | None:
    """Team whose base is closest to a cell, or None when it is contested."""
    point = map_definition.center(tile)
    best_team: str | None = None
    best_distance = math.inf
    tied = False

    for base in map_definition.bases:
        distance = point.get_distance(map_definition.center(base.tile))

        if distance < best_distance - 1e-9:
            best_distance = distance
            best_team = base.team
            tied = False
        elif abs(distance - best_distance) <= 1e-9:
            tied = True

    return None if tied else best_team


class JoinValidator:
    def validate(self, store: GameStore, command: JoinCommand) -> None:
        if store.get_status() != GameStatus.WAITING:
            raise ValidationError("Game already started")

        if not command.name.strip():
            raise ValidationError("Name is required")

        if len(command.name.strip()) > 24:
            raise ValidationError("Name is too long")


class ReadyValidator:
    def validate(self, store: GameStore, player_id: str) -> None:
        if not store.players.has(player_id):
            raise ValidationError("Player must join first")

        if store.get_status() != GameStatus.WAITING:
            raise ValidationError("Game is not waiting")


class PlaceValidator:
    def __init__(self, towers: TowerCatalog) -> None:
        self._towers = towers

    def validate(self, store: GameStore, command: PlaceCommand) -> None:
        tower = self._towers.get(command.tower_type)
        player = store.players.get(command.player_id)
        map_definition = store.get_map()

        if store.get_status() in FINISHED_STATES:
            raise ValidationError("Game is finished")

        if not map_definition.can_build(command.tile):
            raise ValidationError("Tile is not buildable")

        if store.towers.has_at(command.tile):
            raise ValidationError("Tile already has a tower")

        if nearest_team(map_definition, command.tile) != player.team:
            raise ValidationError("Tile is outside your territory")

        if player.money < tower.cost:
            raise ValidationError("Not enough money")

        occupied = store.occupied() | {command.tile}

        if not store.navigator.is_reachable(occupied, store.active_targets()):
            raise ValidationError("Tower would block the path")


class DispatchValidator:
    def __init__(self, enemies: EnemyCatalog) -> None:
        self._enemies = enemies

    def validate(self, store: GameStore, command: DispatchCommand) -> None:
        unit = self._enemies.get(command.unit_type)
        player = store.players.get(command.player_id)
        map_definition = store.get_map()

        if map_definition.mode != "pvp":
            raise ValidationError("Units can only be dispatched in PvP")

        if store.get_status() != GameStatus.RUNNING:
            raise ValidationError("Game is not running")

        if not player.alive:
            raise ValidationError("Eliminated players cannot dispatch units")

        if command.target_team is None:
            raise ValidationError("Target team is required")

        if command.target_team == player.team:
            raise ValidationError("Cannot target your own base")

        if command.target_team not in store.active_targets():
            raise ValidationError("Target team is not active")

        if player.money < unit.cost:
            raise ValidationError("Not enough money")


class UpgradeValidator:
    def __init__(self, towers: TowerCatalog) -> None:
        self._towers = towers

    def validate(self, store: GameStore, command: UpgradeCommand) -> None:
        tower = store.towers.get(command.tower_id)
        player = store.players.get(command.player_id)
        definition = self._towers.get(tower.kind)
        cost = definition.get_upgrade_cost(tower.level)

        if tower.owner_id != player.id:
            raise ValidationError("Only the owner can upgrade this tower")

        if tower.level >= MAX_TOWER_LEVEL:
            raise ValidationError("Tower is already max level")

        if player.money < cost:
            raise ValidationError("Not enough money")
