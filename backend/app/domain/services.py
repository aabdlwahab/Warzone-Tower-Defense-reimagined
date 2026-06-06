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
    INITIAL_BUILD_SECONDS,
    INTER_WAVE_SECONDS,
    PVP_STARTING_MONEY,
    STARTING_MONEY,
    EnemyCatalog,
    MapCatalog,
    TowerCatalog,
    WaveCatalog,
)
from backend.app.domain.models import (
    DispatchCommand,
    Enemy,
    EnemyDefinition,
    GameStatus,
    JoinCommand,
    PlaceCommand,
    Player,
    Tile,
    Tower,
    UpgradeCommand,
)
from backend.app.domain.snapshots import SnapshotMapper
from backend.app.domain.stores import GameStore, QueuedDispatch
from backend.app.domain.systems import CombatSystem, DispatchSystem, EnemyMover, Targeter, WaveSpawner
from backend.app.domain.validators import (
    DispatchValidator,
    JoinValidator,
    PlaceValidator,
    ReadyValidator,
    UpgradeValidator,
)
from backend.app.domain.errors import ValidationError


PERSONNEL_DISPATCH_COUNT = 5
VEHICLE_DISPATCH_COUNT = 3
PERSONNEL_DISPATCH_INTERVAL = 0.28
VEHICLE_DISPATCH_INTERVAL = 0.42


@dataclass(frozen=True)
class GameValidators:
    join: JoinValidator
    ready: ReadyValidator
    place: PlaceValidator
    dispatch: DispatchValidator
    upgrade: UpgradeValidator


@dataclass(frozen=True)
class GameSystems:
    spawner: WaveSpawner
    dispatcher: DispatchSystem
    mover: EnemyMover
    combat: CombatSystem


class GameService:
    def __init__(
        self,
        store: GameStore,
        towers: TowerCatalog,
        enemies: EnemyCatalog,
        waves: WaveCatalog,
        validators: GameValidators,
        systems: GameSystems,
        mapper: SnapshotMapper,
    ) -> None:
        self._store = store
        self._towers = towers
        self._enemies = enemies
        self._waves = waves
        self._validators = validators
        self._systems = systems
        self._mapper = mapper

    def join(self, name: str) -> Player:
        command = JoinCommand(name=name.strip())
        self._validators.join.validate(self._store, command)
        team = self._store.next_free_team()

        if team is None:
            raise ValidationError("Room is full")

        player = Player(
            id=self._store.create_player_id(),
            name=command.name,
            money=self._starting_money(),
            team=team,
            token=secrets.token_urlsafe(16),
        )
        self._store.players.add(player)
        self._store.claim_base(team, player.id)

        # Single-player maps start automatically: skip the lobby and open with
        # a build phase so the player can place towers before enemies arrive.
        if self._store.get_map().mode == "single":
            self._store.set_status(GameStatus.RUNNING)
            self._store.rebuild_navigation(self._towers)
            self._store.wave.start_prep(INITIAL_BUILD_SECONDS)

        return player

    def find_by_token(self, token: str) -> Player | None:
        return self._store.players.get_by_token(token)

    def set_connected(self, player_id: str, connected: bool) -> None:
        self._store.players.set_connected(player_id, connected)

    def leave(self, player_id: str) -> None:
        if not self._store.players.has(player_id):
            return

        player = self._store.players.get(player_id)

        if self._store.get_status() != GameStatus.WAITING:
            self._store.players.set_connected(player_id, False)
            return

        self._store.release_base(player.team)
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
        player = self._store.players.get(command.player_id)
        self._validators.place.validate(self._store, command)
        tower = Tower(
            id=self._store.create_tower_id(),
            owner_id=command.player_id,
            team=player.team,
            kind=command.tower_type,
            tile=command.tile,
        )
        self._store.players.pay(command.player_id, definition.cost)
        self._store.towers.add(tower)
        self._store.rebuild_navigation(self._towers)
        self._reroute(command.tile)
        self._store.add_event(
            {
                "type": "placed",
                "tower_id": tower.id,
                "kind": tower.kind,
                "team": player.team,
                "x": command.tile.x,
                "y": command.tile.y,
            }
        )
        return tower

    def dispatch(
        self,
        player_id: str,
        unit_type: str,
        target_team: str | None = None,
    ) -> Enemy:
        """Send a squad of `unit_type` (cost paid once) toward `target_team`.

        Personnel ship 5 units; vehicles ship 3.  The first spawns immediately
        and the rest are queued at fixed intervals so the squad arrives in a
        single recognisable wave.  Each dispatched unit also accrues a per-
        player upgrade counter — every 10 units grants +10% HP/damage to that
        type forever after.
        """
        player = self._store.players.get(player_id)
        target = target_team or self._default_target(player.team)
        command = DispatchCommand(
            player_id=player_id,
            unit_type=unit_type,
            target_team=target,
        )
        self._validators.dispatch.validate(self._store, command)

        definition = self._enemies.get(unit_type)
        batch = self._build_dispatch_batch(player, unit_type, target or "", definition)

        first = self._spawn_dispatch(batch[0])
        if first is None:
            raise ValidationError("Spawn is blocked")

        self._store.players.pay(player_id, definition.cost)
        for item in batch:
            self._record_dispatch_progress(item)

        self._emit_dispatch_event(first, batch[0])
        self._store.dispatches.add_many(batch[1:])
        return first

    def _build_dispatch_batch(
        self,
        player: Player,
        unit_type: str,
        target: str,
        definition: EnemyDefinition,
    ) -> list[QueuedDispatch]:
        is_personnel = definition.kind == "inf"
        quantity = PERSONNEL_DISPATCH_COUNT if is_personnel else VEHICLE_DISPATCH_COUNT
        interval = PERSONNEL_DISPATCH_INTERVAL if is_personnel else VEHICLE_DISPATCH_INTERVAL
        base_count = self._store.unit_progress.get_count(player.id, unit_type)
        progress = self._store.unit_progress

        result = []
        for offset in range(1, quantity + 1):
            count = base_count + offset
            level = progress.get_level_for_count(count)
            multiplier = progress.get_multiplier_for_level(level)
            result.append(
                QueuedDispatch(
                    player_id=player.id,
                    team=player.team,
                    unit_type=unit_type,
                    target=target,
                    health_multiplier=multiplier,
                    damage_multiplier=multiplier,
                    cost=definition.cost,
                    count=count,
                    level=level,
                    bonus_pct=int(round((multiplier - 1.0) * 100)),
                    interval=interval,
                )
            )
        return result

    def _drain_dispatch_queue(self) -> None:
        """Spawn every queued unit whose interval has elapsed."""
        while True:
            item = self._store.dispatches.peek_ready()
            if item is None:
                return

            enemy = self._spawn_dispatch(item)
            if enemy is None:
                return  # spawn point is congested — retry next tick

            self._store.dispatches.pop_ready()
            self._emit_dispatch_event(enemy, item)

    def _spawn_dispatch(self, item: QueuedDispatch) -> Enemy | None:
        return self._systems.dispatcher.spawn(
            store=self._store,
            enemy_id=item.unit_type,
            target=item.target,
            team=item.team,
            owner_id=item.player_id,
            health_multiplier=item.health_multiplier,
            damage_multiplier=item.damage_multiplier,
        )

    def _record_dispatch_progress(self, item: QueuedDispatch) -> None:
        progress = self._store.unit_progress.record_dispatch(item.player_id, item.unit_type)
        if not progress["upgraded"]:
            return

        self._store.add_event(
            {
                "type": "unit_upgraded",
                "player_id": item.player_id,
                "team": item.team,
                "kind": item.unit_type,
                "count": progress["count"],
                "level": progress["level"],
                "health_bonus_pct": item.bonus_pct,
                "damage_bonus_pct": item.bonus_pct,
            }
        )

    def _emit_dispatch_event(self, enemy: Enemy, item: QueuedDispatch) -> None:
        self._store.add_event(
            {
                "type": "dispatched",
                "enemy_id": enemy.id,
                "kind": enemy.kind,
                "team": item.team,
                "player_id": item.player_id,
                "target": enemy.target,
                "cost": item.cost,
                "count": item.count,
                "level": item.level,
                "bonus_pct": item.bonus_pct,
                "x": enemy.position.x,
                "y": enemy.position.y,
            }
        )

    def ready(self, player_id: str) -> None:
        self._validators.ready.validate(self._store, player_id)
        self._store.players.ready(player_id)

        if self._should_start():
            self._start()

    def upgrade(self, player_id: str, tower_id: str) -> Tower:
        command = UpgradeCommand(player_id=player_id, tower_id=tower_id)
        self._validators.upgrade.validate(self._store, command)
        tower = self._store.towers.get(command.tower_id)
        definition = self._towers.get(tower.kind)
        cost = definition.get_upgrade_cost(tower.level)
        self._store.players.pay(command.player_id, cost)
        tower.upgrade()
        self._store.rebuild_navigation(self._towers)
        self._store.add_event(
            {
                "type": "upgraded",
                "tower_id": tower.id,
                "player_id": player_id,
                "kind": tower.kind,
                "level": tower.level,
                "cost": cost,
                "damage": definition.get_damage(tower.level),
                "range": definition.get_range(tower.level),
                "x": tower.tile.x,
                "y": tower.tile.y,
            }
        )
        return tower

    def snapshot(self) -> dict[str, Any]:
        return self._mapper.map(self._store)

    def state(self) -> dict[str, Any]:
        return self._mapper.state(self._store)

    def drain_events(self) -> list[dict[str, Any]]:
        return self._store.drain_events()

    def tick(self, seconds: float) -> dict[str, Any]:
        if self._store.get_status() != GameStatus.RUNNING:
            return self.snapshot()

        # Advance the inter-wave build countdown; start the next wave on expiry.
        if self._store.wave.in_prep():
            if self._store.wave.tick_prep(seconds):
                if self._store.wave.ever_started():
                    self._store.wave.next()
                self._store.wave.start()

        self._systems.spawner.update(self._store, seconds)
        self._store.dispatches.tick(seconds)
        self._drain_dispatch_queue()
        self._systems.combat.update(self._store, seconds)
        self._systems.mover.update(self._store, seconds)
        self._store.tick_pvp_income(seconds)
        self._settle()
        return self.snapshot()

    def _starting_money(self) -> int:
        if self._store.get_map().mode == "pvp":
            return PVP_STARTING_MONEY

        return STARTING_MONEY

    def _default_target(self, team: str) -> str | None:
        for target in self._store.active_targets():
            if target != team:
                return target

        return None

    def _reroute(self, tile: Tile) -> None:
        occupied = self._store.occupied()

        for enemy in self._store.enemies.list():
            if not enemy.path or enemy.path[0] != tile:
                continue

            # The enemy's next step was just blocked; re-sample from current cell.
            cell = Tile(int(enemy.position.x), int(enemy.position.y))
            next_t = self._store.navigator.next_tile(cell, enemy.target, occupied)
            enemy.path = [next_t] if next_t else []

    def _settle(self) -> None:
        self._eliminate()

        if self._concluded():
            return

        if self._store.get_map().mode == "pvp":
            return

        if self._store.wave.is_active():
            return

        # Don't act while a build-phase countdown is running.
        if self._store.wave.in_prep():
            return

        if self._store.enemies.list():
            return

        next_wave = self._store.wave.get_index() + 1

        if not self._waves.has(next_wave):
            self._resolve_end()
            return

        if self._store.get_map().mode == "single":
            # Give the player build time before the next wave arrives.
            self._store.wave.start_prep(INTER_WAVE_SECONDS)
        else:
            # PvP: advance immediately (ready gate handled before the first wave).
            self._store.wave.next()
            self._store.wave.start()

    def _eliminate(self) -> None:
        changed = False

        for base in self._store.get_map().bases:
            owner = self._store.base_owner(base.team)

            if owner is None or self._store.base_alive(base.team):
                continue

            self._store.players.set_alive(owner, False)
            self._store.release_base(base.team)

            for enemy in self._store.enemies.list():
                if enemy.target == base.team:
                    self._store.enemies.remove(enemy.id)

            self._store.add_event({"type": "eliminated", "team": base.team})
            changed = True

        if changed:
            self._store.rebuild_navigation(self._towers)

    def _concluded(self) -> bool:
        players = self._store.players.list()
        alive = [player for player in players if player.alive]

        if len(players) >= 2:
            if len(alive) <= 1:
                self._store.set_status(GameStatus.FINISHED)
                self._store.set_winner(alive[0].team if alive else None)
                return True

            return False

        if len(players) == 1 and not players[0].alive:
            self._store.set_status(GameStatus.DEFEAT)
            return True

        return False

    def _resolve_end(self) -> None:
        players = self._store.players.list()

        if len(players) < 2:
            self._store.set_status(GameStatus.VICTORY)
            return

        alive = [player for player in players if player.alive]
        self._store.set_status(GameStatus.FINISHED)

        if not alive:
            self._store.set_winner(None)
            return

        leader = max(alive, key=lambda player: self._store.base_health(player.team))
        top = self._store.base_health(leader.team)
        contenders = [p for p in alive if self._store.base_health(p.team) == top]
        self._store.set_winner(leader.team if len(contenders) == 1 else None)

    def _should_start(self) -> bool:
        players = self._store.players.list()

        if not players or not all(player.ready for player in players):
            return False

        # PvP must not begin until every base has a defender: a lone player
        # cannot start. Once all opponents have joined and readied, the match
        # starts automatically.
        if self._store.get_map().mode == "pvp":
            return len(players) >= self._store.get_map().players

        return True

    def _start(self) -> None:
        self._store.set_status(GameStatus.RUNNING)
        self._store.rebuild_navigation(self._towers)

        if self._store.get_map().mode != "pvp":
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

    def maps(self) -> MapCatalog:
        return self._maps

    def create(self, room_id: str, map_id: str = DEFAULT_MAP_ID) -> GameService:
        store = GameStore(
            room_id=room_id,
            map_definition=self._maps.get(map_id),
            base_health=BASE_HEALTH,
        )
        validators = GameValidators(
            join=JoinValidator(),
            ready=ReadyValidator(),
            place=PlaceValidator(self._towers),
            dispatch=DispatchValidator(self._enemies),
            upgrade=UpgradeValidator(self._towers),
        )
        systems = GameSystems(
            spawner=WaveSpawner(self._enemies, self._waves),
            dispatcher=DispatchSystem(self._enemies),
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
            enemies=self._enemies,
            waves=self._waves,
            validators=validators,
            systems=systems,
            mapper=SnapshotMapper(),
        )
