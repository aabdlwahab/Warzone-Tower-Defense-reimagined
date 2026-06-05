"""Domain validators for player commands."""

from __future__ import annotations

from backend.app.domain.catalogs import MAX_TOWER_LEVEL, TowerCatalog
from backend.app.domain.errors import ValidationError
from backend.app.domain.models import GameStatus, JoinCommand, PlaceCommand, UpgradeCommand
from backend.app.domain.stores import GameStore


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

        if store.get_status() in {GameStatus.VICTORY, GameStatus.DEFEAT}:
            raise ValidationError("Game is finished")

        if not store.get_map().can_build(command.tile):
            raise ValidationError("Tile is not buildable")

        if store.towers.has_at(command.tile):
            raise ValidationError("Tile already has a tower")

        if player.money < tower.cost:
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

