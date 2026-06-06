"""Simulation systems for waves, pathfinding movement, and combat."""

from __future__ import annotations

import math

from backend.app.domain.catalogs import (
    INCOME_INTERVAL,
    EnemyCatalog,
    TowerCatalog,
    WaveCatalog,
)
from backend.app.domain.models import (
    Enemy,
    EnemyDefinition,
    MapDefinition,
    Point,
    Tile,
    Tower,
    TowerDefinition,
)
from backend.app.domain.stores import GameStore


EPSILON = 1e-6

# Minimum centre-to-centre distance (in tiles) the simulation keeps between any
# two enemies.  Units always advance along their path; a separation pass then
# nudges the rear unit of any overlapping pair apart so columns queue up instead
# of stacking — without ever blocking forward motion (which would deadlock).
SEPARATION = 0.9


def _heading(origin: Point, destination: Point) -> float:
    return math.atan2(destination.y - origin.y, destination.x - origin.x)


def _lerp(origin: Point, destination: Point, factor: float) -> Point:
    return Point(
        origin.x + (destination.x - origin.x) * factor,
        origin.y + (destination.y - origin.y) * factor,
    )


def _gap(first: float, second: float) -> float:
    return max(SEPARATION, first + second)


def _spawn_has_space(
    point: Point,
    target: str,
    radius: float,
    enemies: list[Enemy],
    reservations: list[tuple[str, Point, float]],
    enemy_catalog: EnemyCatalog,
) -> bool:
    for enemy in enemies:
        other = enemy_catalog.get(enemy.kind)

        if (
            enemy.target == target
            and point.get_distance(enemy.position) < _gap(radius, other.radius) - EPSILON
        ):
            return False

    for reserved_target, reserved, reserved_radius in reservations:
        if (
            reserved_target == target
            and point.get_distance(reserved) < _gap(radius, reserved_radius) - EPSILON
        ):
            return False

    return True


class Targeter:
    """Picks the lead enemy for each tower — whichever is closest to the base."""

    def get(
        self,
        tower: Tower,
        definition: TowerDefinition,
        enemies: list[Enemy],
        map_definition: MapDefinition,
    ) -> Enemy | None:
        tower_point = map_definition.center(tower.tile)
        attack_range = definition.get_range(tower.level)
        candidates = [
            enemy
            for enemy in enemies
            if enemy.target == tower.team
            and tower_point.get_distance(enemy.position) <= attack_range
        ]

        if not candidates:
            return None

        # A tower's team always has a base (towers are gated by ownership).
        base_center = map_definition.center(map_definition.base_tile(tower.team))
        return min(candidates, key=lambda e: e.position.get_distance(base_center))


class WaveSpawner:
    def __init__(self, enemies: EnemyCatalog, waves: WaveCatalog) -> None:
        self._enemies = enemies
        self._waves = waves

    def update(self, store: GameStore, seconds: float) -> None:
        if not store.wave.is_active():
            return

        wave = self._waves.get(store.wave.get_index())
        store.wave.tick(seconds)
        active = store.active_targets()

        while store.wave.is_active():
            entry_index = store.wave.get_entry()

            if entry_index >= len(wave.entries):
                store.wave.complete()
                return

            entry = wave.entries[entry_index]

            if store.wave.get_spawned() >= entry.count:
                store.wave.advance()
                continue

            if not store.wave.can_spawn(entry.interval):
                return

            if not self._spawn(store, entry.enemy_id, active):
                return

            store.wave.spawn()

    def _spawn(self, store: GameStore, enemy_id: str, active: set[str]) -> bool:
        definition = self._enemies.get(enemy_id)
        map_definition = store.get_map()
        occupied = store.occupied()
        enemies = store.enemies.list()
        reservations: list[tuple[str, Point, float]] = []
        spawns = []

        for spawn in map_definition.spawns:
            if spawn.target not in active:
                continue

            position = map_definition.center(spawn.tile)
            first_tile = store.navigator.next_tile(spawn.tile, spawn.target, occupied)

            if first_tile is None:
                continue

            if not _spawn_has_space(
                point=position,
                target=spawn.target,
                radius=definition.radius,
                enemies=enemies,
                reservations=reservations,
                enemy_catalog=self._enemies,
            ):
                return False

            spawns.append((spawn, position, first_tile))
            reservations.append((spawn.target, position, definition.radius))

        for spawn, position, first_tile in spawns:
            enemy = Enemy(
                id=store.create_enemy_id(),
                kind=definition.id,
                target=spawn.target,
                health=definition.health,
                position=position,
                path=[first_tile],
                base_damage=definition.damage,
            )
            enemy.heading = _heading(position, map_definition.center(first_tile))
            store.enemies.add(enemy)

        return bool(spawns)


class DispatchSystem:
    def __init__(self, enemies: EnemyCatalog) -> None:
        self._enemies = enemies

    def spawn(
        self,
        store: GameStore,
        enemy_id: str,
        target: str,
        team: str,
        owner_id: str,
        health_multiplier: float = 1.0,
        damage_multiplier: float = 1.0,
    ) -> Enemy | None:
        definition = self._enemies.get(enemy_id)
        map_definition = store.get_map()
        occupied = store.occupied()
        enemies = store.enemies.list()

        for spawn in map_definition.spawns:
            if spawn.team is not None:
                if spawn.team != team:
                    continue
            elif spawn.target != target:
                continue

            position = map_definition.center(spawn.tile)
            first_tile = store.navigator.next_tile(spawn.tile, target, occupied)

            if first_tile is None:
                continue

            if not _spawn_has_space(
                point=position,
                target=target,
                radius=definition.radius,
                enemies=enemies,
                reservations=[],
                enemy_catalog=self._enemies,
            ):
                continue

            enemy = self._create_enemy(
                store,
                definition,
                target,
                position,
                first_tile,
                owner_id=owner_id,
                health_multiplier=health_multiplier,
                damage_multiplier=damage_multiplier,
            )
            enemy.heading = _heading(position, map_definition.center(first_tile))
            store.enemies.add(enemy)
            return enemy

        return None

    def _create_enemy(
        self,
        store: GameStore,
        definition: EnemyDefinition,
        target: str,
        position: Point,
        first_tile: Tile,
        owner_id: str | None = None,
        health_multiplier: float = 1.0,
        damage_multiplier: float = 1.0,
    ) -> Enemy:
        return Enemy(
            id=store.create_enemy_id(),
            kind=definition.id,
            target=target,
            health=definition.health * health_multiplier,
            position=position,
            path=[first_tile],
            owner_id=owner_id,
            base_damage=definition.damage * damage_multiplier,
        )


class EnemyMover:
    def __init__(self, enemies: EnemyCatalog) -> None:
        self._enemies = enemies

    def update(self, store: GameStore, seconds: float) -> None:
        map_definition = store.get_map()
        occupied = store.occupied()

        for enemy in store.enemies.list():
            definition = self._enemies.get(enemy.kind)
            enemy.tick(seconds)
            step = definition.speed * enemy.get_scale() * seconds
            self._advance(store, enemy, step, map_definition, occupied, definition.radius)

            if enemy.has_arrived():
                store.enemies.remove(enemy.id)
                store.damage_base(enemy.target, enemy.base_damage)
                if enemy.owner_id:
                    definition = self._enemies.get(enemy.kind)
                    refund = max(0, definition.cost - definition.reward)
                    if refund:
                        store.players.reward(enemy.owner_id, refund)
                store.add_event(
                    {
                        "type": "leak",
                        "enemy_id": enemy.id,
                        "kind": enemy.kind,
                        "team": enemy.target,
                        "x": enemy.position.x,
                        "y": enemy.position.y,
                    }
                )

        # Units always move freely above; this pass only nudges crowded units
        # apart so they never overlap, while never stalling forward progress.
        self._separate(store, map_definition, occupied)

    def _advance(
        self,
        store: GameStore,
        enemy: Enemy,
        step: float,
        map_definition: MapDefinition,
        occupied: frozenset[Tile],
        radius: float,
    ) -> None:
        """Move enemy along its single-tile path, re-sampling the next tile on each arrival."""
        remaining = step
        base_tile = map_definition.base_tile(enemy.target)

        if base_tile is not None and self._touches_tile(enemy.position, base_tile, radius):
            enemy.path.clear()
            return

        while remaining > 1e-9 and enemy.path:
            destination = map_definition.center(enemy.path[0])
            distance = enemy.position.get_distance(destination)
            next_tile = enemy.path[0]

            if distance <= remaining:
                if next_tile == base_tile:
                    enemy.position = self._first_tile_contact(
                        start=enemy.position,
                        end=destination,
                        tile=base_tile,
                        radius=radius,
                    )
                    enemy.path.clear()
                    break

                enemy.position = destination
                arrived = enemy.path.pop(0)
                remaining -= distance

                # Nondeterministic: pick the next tile fresh on every arrival.
                next_t = store.navigator.next_tile(arrived, enemy.target, occupied)
                if next_t is not None:
                    enemy.path.append(next_t)
                # If no reachable neighbour exists, path stays empty → leaked.
                continue

            next_position = _lerp(enemy.position, destination, remaining / distance)

            if next_tile == base_tile and self._touches_tile(next_position, base_tile, radius):
                enemy.position = self._first_tile_contact(
                    start=enemy.position,
                    end=next_position,
                    tile=base_tile,
                    radius=radius,
                )
                enemy.path.clear()
                break

            enemy.position = next_position
            enemy.heading = _heading(enemy.position, destination)
            remaining = 0.0

        if enemy.path:
            enemy.heading = _heading(enemy.position, map_definition.center(enemy.path[0]))

    def _first_tile_contact(self, start: Point, end: Point, tile: Tile, radius: float) -> Point:
        if self._touches_tile(start, tile, radius):
            return start

        low = 0.0
        high = 1.0

        for _ in range(16):
            mid = (low + high) / 2.0
            point = _lerp(start, end, mid)

            if self._touches_tile(point, tile, radius):
                high = mid
            else:
                low = mid

        return _lerp(start, end, high)

    def _touches_tile(self, point: Point, tile: Tile, radius: float) -> bool:
        closest_x = min(max(point.x, tile.x), tile.x + 1.0)
        closest_y = min(max(point.y, tile.y), tile.y + 1.0)
        return point.get_distance(Point(closest_x, closest_y)) <= radius + EPSILON

    def _separate(
        self,
        store: GameStore,
        map_definition: MapDefinition,
        occupied: frozenset[Tile],
    ) -> None:
        """Push the rear unit of each overlapping pair apart.

        The unit closer to its base (the column leader) is never moved, so the
        front of every queue always advances at full speed and the system can
        never deadlock — crowding always resolves into a tidy single-file line.
        """
        enemies = store.enemies.list()

        if len(enemies) < 2:
            return

        to_base: dict[str, float] = {}

        for enemy in enemies:
            to_base[enemy.id] = self._base_distance(enemy, map_definition)

        for i in range(len(enemies)):
            for j in range(i + 1, len(enemies)):
                first = enemies[i]
                second = enemies[j]

                if first.target != second.target:
                    continue

                gap = _gap(
                    self._enemies.get(first.kind).radius,
                    self._enemies.get(second.kind).radius,
                )
                distance = first.position.get_distance(second.position)

                if distance >= gap - EPSILON:
                    continue

                # Hold the leader (nearer the base); shove the follower back.
                if to_base[first.id] <= to_base[second.id]:
                    leader, mover = first, second
                else:
                    leader, mover = second, first

                push = gap - distance
                dx = mover.position.x - leader.position.x
                dy = mover.position.y - leader.position.y
                norm = math.hypot(dx, dy)

                if norm < EPSILON:
                    # Exact overlap — break the tie deterministically by id.
                    dx, dy, norm = (1.0, 0.0, 1.0) if mover.id > leader.id else (-1.0, 0.0, 1.0)

                target = Point(
                    mover.position.x + dx / norm * push,
                    mover.position.y + dy / norm * push,
                )
                mover.position = self._slide(mover, target, map_definition, occupied)
                to_base[mover.id] = self._base_distance(mover, map_definition)

    def _base_distance(self, enemy: Enemy, map_definition: MapDefinition) -> float:
        base = map_definition.base_tile(enemy.target)
        if base is None:
            return 0.0
        return enemy.position.get_distance(map_definition.center(base))

    def _slide(
        self,
        enemy: Enemy,
        target: Point,
        map_definition: MapDefinition,
        occupied: frozenset[Tile],
    ) -> Point:
        """Apply a push but keep the unit on walkable ground (slide along walls)."""
        if self._walkable(target, enemy.target, map_definition, occupied):
            return target

        along_x = Point(target.x, enemy.position.y)
        if self._walkable(along_x, enemy.target, map_definition, occupied):
            return along_x

        along_y = Point(enemy.position.x, target.y)
        if self._walkable(along_y, enemy.target, map_definition, occupied):
            return along_y

        return enemy.position

    def _walkable(
        self,
        point: Point,
        target: str,
        map_definition: MapDefinition,
        occupied: frozenset[Tile],
    ) -> bool:
        tile = Tile(int(math.floor(point.x)), int(math.floor(point.y)))
        return map_definition.walkable(tile, target, occupied)


class CombatSystem:
    def __init__(
        self,
        towers: TowerCatalog,
        enemies: EnemyCatalog,
        targeter: Targeter,
    ) -> None:
        self._towers = towers
        self._enemies = enemies
        self._targeter = targeter

    def update(self, store: GameStore, seconds: float) -> None:
        for tower in store.towers.list():
            definition = self._towers.get(tower.kind)
            tower.tick(seconds)

            if definition.income > 0:
                if tower.can_fire():
                    store.players.reward(tower.owner_id, definition.income)
                    tower.fire(INCOME_INTERVAL)
                continue

            if not tower.can_fire():
                continue

            target = self._targeter.get(
                tower=tower,
                definition=definition,
                enemies=store.enemies.list(),
                map_definition=store.get_map(),
            )

            if target is None:
                continue

            cooldown = 1.0 / definition.fire_rate
            tower.fire(cooldown)
            center = store.get_map().center(tower.tile)
            store.add_event(
                {
                    "type": "shot",
                    "tower_id": tower.id,
                    "enemy_id": target.id,
                    "kind": tower.kind,
                    "x": center.x,
                    "y": center.y,
                    "tx": target.position.x,
                    "ty": target.position.y,
                }
            )
            self._hit(store, tower, definition, target)

    def _damage(self, store: GameStore, tower: Tower, enemy: Enemy, amount: float) -> None:
        definition = self._enemies.get(enemy.kind)
        damage = max(1.0, amount - definition.armor)
        enemy.damage(damage)

        if not enemy.is_dead():
            return

        store.enemies.remove(enemy.id)
        store.players.reward(tower.owner_id, definition.reward)

        store.add_event(
            {
                "type": "kill",
                "enemy_id": enemy.id,
                "kind": enemy.kind,
                "x": enemy.position.x,
                "y": enemy.position.y,
            }
        )

    def _hit(
        self,
        store: GameStore,
        tower: Tower,
        definition: TowerDefinition,
        target: Enemy,
    ) -> None:
        damage = definition.get_damage(tower.level)

        if definition.slow > 0:
            target.slow(definition.slow, definition.slow_seconds)

        if definition.splash_radius <= 0:
            self._damage(store, tower, target, damage)
            return

        impact = target.position

        for enemy in store.enemies.list():
            if enemy.target != tower.team:
                continue

            if impact.get_distance(enemy.position) <= definition.splash_radius:
                self._damage(store, tower, enemy, damage)
