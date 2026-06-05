"""Domain services for game workflows."""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any

from backend.app.domain.catalogs import (
    BASE_HEALTH,
    DEFAULT_ENEMIES,
    DEFAULT_MAP_ID,
    DEFAULT_MAPS,
    DEFAULT_TOWERS,
    DEFAULT_WAVES,
    MAX_PLAYERS,
    STARTING_MONEY,
    EnemyCatalog,
    MapCatalog,
    TowerCatalog,
    WaveCatalog,
)
from backend.app.domain.models import (
    GameStatus,
    JoinCommand,
    PlaceCommand,
    Player,
    Tile,
    Tower,
    UpgradeCommand,
)
from backend.app.domain.snapshots import SnapshotMapper
from backend.app.domain.stores import GameStore
from backend.app.domain.systems import CombatSystem, EnemyMover, Targeter, WaveSpawner
from backend.app.domain.validators import (
    JoinValidator,
    PlaceValidator,
    ReadyValidator,
    UpgradeValidator,
)


@dataclass(frozen=True)
class GameValidators:
    join: JoinValidator
    ready: ReadyValidator
    place: PlaceValidator
    upgrade: UpgradeValidator


@dataclass(frozen=True)
class GameSystems:
    spawner: WaveSpawner
    mover: EnemyMover
    combat: CombatSystem


class GameService:
    def __init__(
        self,
        store: GameStore,
        towers: TowerCatalog,
        waves: WaveCatalog,
        validators: GameValidators,
        systems: GameSystems,
        mapper: SnapshotMapper,
    ) -> None:
        self._store = store
        self._towers = towers
        self._waves = waves
        self._validators = validators
        self._systems = systems
        self._mapper = mapper

    def join(self, name: str) -> Player:
        command = JoinCommand(name=name.strip())
        self._validators.join.validate(self._store, command)
        player = Player(
            id=self._store.create_player_id(),
            name=command.name,
            money=STARTING_MONEY,
            token=secrets.token_urlsafe(16),
        )
        self._store.players.add(player)
        return player

    def find_by_token(self, token: str) -> Player | None:
        return self._store.players.get_by_token(token)

    def set_connected(self, player_id: str, connected: bool) -> None:
        self._store.players.set_connected(player_id, connected)

    def leave(self, player_id: str) -> None:
        if not self._store.players.has(player_id):
            return

        # During the lobby a vanished player should free their slot so the
        # remaining players can start; once running, their towers stay in play
        # and they can resume with their token.
        if self._store.get_status() != GameStatus.WAITING:
            self._store.players.set_connected(player_id, False)
            return

        self._store.players.remove(player_id)

        if self._should_start():
            self._start()

    def place(self, player_id: str, tower_type: str, x: int, y: int) -> Tower:
        command = PlaceCommand(
            player_id=player_id,
            tower_type=tower_type,
            tile=Tile(x=x, y=y),
        )
        definition = self._towers.get(command.tower_type)
        self._validators.place.validate(self._store, command)
        tower = Tower(
            id=self._store.create_tower_id(),
            owner_id=command.player_id,
            kind=command.tower_type,
            tile=command.tile,
        )
        self._store.players.pay(command.player_id, definition.cost)
        self._store.towers.add(tower)
        self._store.add_event(
            {
                "type": "placed",
                "tower_id": tower.id,
                "kind": tower.kind,
                "x": tower.tile.x,
                "y": tower.tile.y,
            }
        )
        return tower

    def ready(self, player_id: str) -> None:
        self._validators.ready.validate(self._store, player_id)
        self._store.players.ready(player_id)

        if self._should_start():
            self._start()

    def snapshot(self) -> dict[str, Any]:
        return self._mapper.map(self._store)

    def state(self) -> dict[str, Any]:
        return self._mapper.state(self._store)

    def drain_events(self) -> list[dict[str, Any]]:
        return self._store.drain_events()

    def tick(self, seconds: float) -> dict[str, Any]:
        if self._store.get_status() != GameStatus.RUNNING:
            return self.snapshot()

        self._systems.spawner.update(self._store, seconds)
        self._systems.combat.update(self._store, seconds)
        self._systems.mover.update(self._store, seconds)
        self._settle()
        return self.snapshot()

    def upgrade(self, player_id: str, tower_id: str) -> Tower:
        command = UpgradeCommand(player_id=player_id, tower_id=tower_id)
        self._validators.upgrade.validate(self._store, command)
        tower = self._store.towers.get(command.tower_id)
        definition = self._towers.get(tower.kind)
        cost = definition.get_upgrade_cost(tower.level)
        self._store.players.pay(command.player_id, cost)
        tower.upgrade()
        self._store.add_event(
            {
                "type": "upgraded",
                "tower_id": tower.id,
                "kind": tower.kind,
                "level": tower.level,
                "x": tower.tile.x,
                "y": tower.tile.y,
            }
        )
        return tower

    def _settle(self) -> None:
        if self._store.get_health() <= 0:
            self._store.set_status(GameStatus.DEFEAT)
            return

        if self._store.wave.is_active():
            return

        if self._store.enemies.list():
            return

        next_wave = self._store.wave.get_index() + 1

        if self._waves.has(next_wave):
            self._store.wave.next()
            self._store.wave.start()
            return

        self._store.set_status(GameStatus.VICTORY)

    def _should_start(self) -> bool:
        players = self._store.players.list()
        return bool(players) and all(player.ready for player in players)

    def _start(self) -> None:
        self._store.set_status(GameStatus.RUNNING)
        self._store.wave.start()


class GameFactory:
    def __init__(
        self,
        maps: MapCatalog | None = None,
        towers: TowerCatalog | None = None,
        enemies: EnemyCatalog | None = None,
        waves: WaveCatalog | None = None,
    ) -> None:
        self._maps = maps or MapCatalog(DEFAULT_MAPS)
        self._towers = towers or TowerCatalog(DEFAULT_TOWERS)
        self._enemies = enemies or EnemyCatalog(DEFAULT_ENEMIES)
        self._waves = waves or WaveCatalog(DEFAULT_WAVES)

    def create(self, room_id: str, map_id: str = DEFAULT_MAP_ID) -> GameService:
        store = GameStore(
            room_id=room_id,
            map_definition=self._maps.get(map_id),
            max_players=MAX_PLAYERS,
            base_health=BASE_HEALTH,
        )
        validators = GameValidators(
            join=JoinValidator(),
            ready=ReadyValidator(),
            place=PlaceValidator(self._towers),
            upgrade=UpgradeValidator(self._towers),
        )
        systems = GameSystems(
            spawner=WaveSpawner(self._enemies, self._waves),
            mover=EnemyMover(self._enemies),
            combat=CombatSystem(
                towers=self._towers,
                enemies=self._enemies,
                targeter=Targeter(),
            ),
        )
        return GameService(
            store=store,
            towers=self._towers,
            waves=self._waves,
            validators=validators,
            systems=systems,
            mapper=SnapshotMapper(),
        )
