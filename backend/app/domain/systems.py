"""Simulation systems for waves, movement, and combat."""

from __future__ import annotations

from backend.app.domain.catalogs import EnemyCatalog, TowerCatalog, WaveCatalog
from backend.app.domain.models import Enemy, MapDefinition, Point, Tower, TowerDefinition
from backend.app.domain.stores import GameStore


class Targeter:
    def get(
        self,
        tower: Tower,
        definition: TowerDefinition,
        enemies: list[Enemy],
        map_definition: MapDefinition,
    ) -> Enemy | None:
        tower_point = Point(tower.tile.x + 0.5, tower.tile.y + 0.5)
        attack_range = definition.get_range(tower.level)
        candidates = []

        for enemy in enemies:
            enemy_point = map_definition.get_position(enemy.distance)

            if tower_point.get_distance(enemy_point) <= attack_range:
                candidates.append(enemy)

        if not candidates:
            return None

        return max(candidates, key=lambda enemy: enemy.distance)


class WaveSpawner:
    def __init__(self, enemies: EnemyCatalog, waves: WaveCatalog) -> None:
        self._enemies = enemies
        self._waves = waves

    def update(self, store: GameStore, seconds: float) -> None:
        if not store.wave.is_active():
            return

        wave = self._waves.get(store.wave.get_index())
        store.wave.tick(seconds)

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

            definition = self._enemies.get(entry.enemy_id)
            enemy = Enemy(
                id=store.create_enemy_id(),
                kind=definition.id,
                health=definition.health,
            )
            store.enemies.add(enemy)
            store.wave.spawn()


class EnemyMover:
    def __init__(self, enemies: EnemyCatalog) -> None:
        self._enemies = enemies

    def update(self, store: GameStore, seconds: float) -> None:
        length = store.get_map().get_length()

        for enemy in store.enemies.list():
            definition = self._enemies.get(enemy.kind)
            enemy.tick(seconds)
            enemy.move(definition.speed * enemy.get_scale() * seconds)

            if enemy.has_finished(length):
                point = store.get_map().get_position(enemy.distance)
                store.enemies.remove(enemy.id)
                store.damage(1)
                store.add_event(
                    {
                        "type": "leak",
                        "enemy_id": enemy.id,
                        "kind": enemy.kind,
                        "x": point.x,
                        "y": point.y,
                    }
                )


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
            tower.tick(seconds)

            if not tower.can_fire():
                continue

            definition = self._towers.get(tower.kind)
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
            tower_point = Point(tower.tile.x + 0.5, tower.tile.y + 0.5)
            target_point = store.get_map().get_position(target.distance)
            store.add_event(
                {
                    "type": "shot",
                    "tower_id": tower.id,
                    "kind": tower.kind,
                    "x": tower_point.x,
                    "y": tower_point.y,
                    "tx": target_point.x,
                    "ty": target_point.y,
                }
            )
            self._hit(store, tower, definition, target)

    def _damage(self, store: GameStore, tower: Tower, enemy: Enemy, amount: float) -> None:
        definition = self._enemies.get(enemy.kind)
        damage = max(1.0, amount - definition.armor)
        enemy.damage(damage)

        if not enemy.is_dead():
            return

        point = store.get_map().get_position(enemy.distance)
        store.enemies.remove(enemy.id)
        store.players.reward(tower.owner_id, definition.reward)
        store.add_event(
            {
                "type": "kill",
                "enemy_id": enemy.id,
                "kind": enemy.kind,
                "x": point.x,
                "y": point.y,
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

        target_point = store.get_map().get_position(target.distance)

        for enemy in store.enemies.list():
            enemy_point = store.get_map().get_position(enemy.distance)

            if target_point.get_distance(enemy_point) <= definition.splash_radius:
                self._damage(store, tower, enemy, damage)

