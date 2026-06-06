"""Behavior tests for the game service."""

from __future__ import annotations

import unittest

from backend.app.domain.catalogs import (
    BASE_HEALTH,
    DEFAULT_ENEMIES,
    DEFAULT_MAPS,
    DEFAULT_TOWERS,
    EnemyCatalog,
    TowerCatalog,
    WaveCatalog,
)
from backend.app.domain.errors import ValidationError
from backend.app.domain.models import Enemy, Player, Tile, WaveDefinition, WaveEntry
from backend.app.domain.services import GameFactory
from backend.app.domain.stores import GameStore
from backend.app.domain.systems import EnemyMover, SEPARATION, WaveSpawner


class GameServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.game = GameFactory().create("test-room")

    def test_ready_starts_pvp_without_automatic_wave(self) -> None:
        first = self.game.join("Ahmed")
        second = self.game.join("Sara")

        self.game.ready(first.id)
        self.game.ready(second.id)

        snapshot = self.game.snapshot()
        self.assertEqual(snapshot["status"], "running")
        self.assertEqual(snapshot["wave"], 1)
        self.assertFalse(snapshot["wave_active"])

    def test_pvp_does_not_start_until_every_base_has_a_ready_player(self) -> None:
        first = self.game.join("Ahmed")

        self.game.ready(first.id)

        # A lone player cannot start a PvP match — it waits for the opponent.
        self.assertEqual(self.game.snapshot()["status"], "waiting")

        second = self.game.join("Sara")
        self.game.ready(second.id)

        # The match starts automatically once the second player is ready.
        self.assertEqual(self.game.snapshot()["status"], "running")

    def test_place_spends_money_and_blocks_duplicate_tile(self) -> None:
        player = self.game.join("Ahmed")

        tower = self.game.place(player.id, "rifle", 10, 7)
        snapshot = self.game.snapshot()

        self.assertEqual(tower.kind, "rifle")
        self.assertEqual(snapshot["players"][0]["money"], 370)

        with self.assertRaises(ValidationError):
            self.game.place(player.id, "rifle", 10, 7)

    def test_tick_spawns_enemy_after_wave_starts(self) -> None:
        game = GameFactory().create("single-room", map_id="bocage_run")
        game.join("Ahmed")

        for _ in range(100):
            snapshot = game.tick(0.1)

        self.assertEqual(snapshot["status"], "running")
        self.assertGreaterEqual(len(snapshot["enemies"]), 1)
        self.assertEqual(snapshot["enemies"][0]["kind"], "infantry")

    def test_tower_rewards_owner_for_kill(self) -> None:
        defender = self.game.join("Ahmed")
        attacker = self.game.join("Sara")
        self.game.place(defender.id, "sniper", 19, 9)
        self.game.ready(defender.id)
        self.game.ready(attacker.id)
        self.game.dispatch(attacker.id, "infantry", "p1")

        for _ in range(90):
            self.game.tick(0.25)

        snapshot = self.game.snapshot()
        self.assertGreater(snapshot["players"][0]["money"], 170)

    def test_dispatch_spends_money_and_spawns_unit(self) -> None:
        sender = self.game.join("Ahmed")
        target = self.game.join("Sara")
        self.game.ready(sender.id)
        self.game.ready(target.id)

        enemy = self.game.dispatch(sender.id, "infantry", target.team)
        snapshot = self.game.snapshot()

        self.assertEqual(enemy.kind, "infantry")
        self.assertEqual(enemy.target, target.team)
        self.assertEqual(snapshot["players"][0]["money"], 385)
        self.assertEqual(snapshot["enemies"][0]["target"], target.team)

    def test_personnel_dispatch_sends_five_units_for_one_price(self) -> None:
        sender = self.game.join("Ahmed")
        target = self.game.join("Sara")
        self.game.ready(sender.id)
        self.game.ready(target.id)
        before = self.game.snapshot()["players"][0]["money"]

        self.game.dispatch(sender.id, "infantry", target.team)

        for _ in range(20):
            self.game.tick(0.2)

        snapshot = self.game.snapshot()
        self.assertGreaterEqual(snapshot["players"][0]["money"], before - 35)
        self.assertLess(snapshot["players"][0]["money"], before)
        self.assertEqual(len(snapshot["enemies"]), 5)
        self.assertTrue(all(enemy["kind"] == "infantry" for enemy in snapshot["enemies"]))

    def test_vehicle_dispatch_sends_three_units_for_one_price(self) -> None:
        sender = self.game.join("Ahmed")
        target = self.game.join("Sara")
        self.game.ready(sender.id)
        self.game.ready(target.id)
        before = self.game.snapshot()["players"][0]["money"]

        self.game.dispatch(sender.id, "motorcycle", target.team)

        for _ in range(20):
            self.game.tick(0.25)

        snapshot = self.game.snapshot()
        self.assertGreaterEqual(snapshot["players"][0]["money"], before - 85)
        self.assertLess(snapshot["players"][0]["money"], before)
        self.assertEqual(len(snapshot["enemies"]), 3)
        self.assertTrue(all(enemy["kind"] == "motorcycle" for enemy in snapshot["enemies"]))

    def test_dispatching_two_personnel_squads_upgrades_that_unit_type(self) -> None:
        sender = self.game.join("Ahmed")
        target = self.game.join("Sara")
        self.game.ready(sender.id)
        self.game.ready(target.id)
        events = []

        self.game.dispatch(sender.id, "infantry", target.team)
        events.extend(self.game.drain_events())
        self.game.tick(0.7)
        events.extend(self.game.drain_events())
        self.game.dispatch(sender.id, "infantry", target.team)
        events.extend(self.game.drain_events())

        for _ in range(80):
            self.game.tick(0.2)
            events.extend(self.game.drain_events())

        upgrades = [event for event in events if event["type"] == "unit_upgraded"]
        self.assertEqual(len(upgrades), 1)
        self.assertEqual(upgrades[0]["player_id"], sender.id)
        self.assertEqual(upgrades[0]["team"], sender.team)
        self.assertEqual(upgrades[0]["kind"], "infantry")
        self.assertEqual(upgrades[0]["count"], 10)
        self.assertEqual(upgrades[0]["level"], 2)
        self.assertEqual(upgrades[0]["health_bonus_pct"], 10)
        self.assertEqual(upgrades[0]["damage_bonus_pct"], 10)

        snapshot = self.game.snapshot()
        boosted = [
            enemy
            for enemy in snapshot["enemies"]
            if enemy["kind"] == "infantry" and enemy["base_damage"] > 1
        ]
        self.assertGreaterEqual(len(boosted), 1)

    def test_dispatch_rejects_units_the_player_cannot_afford(self) -> None:
        sender = self.game.join("Ahmed")
        target = self.game.join("Sara")
        self.game.ready(sender.id)
        self.game.ready(target.id)

        with self.assertRaises(ValidationError):
            self.game.dispatch(sender.id, "heavytank", target.team)

        snapshot = self.game.snapshot()
        self.assertEqual(snapshot["players"][0]["money"], 420)
        self.assertEqual(snapshot["enemies"], [])

    def test_pvp_passive_income_ticks_while_running(self) -> None:
        first = self.game.join("Ahmed")
        second = self.game.join("Sara")
        self.game.ready(first.id)
        self.game.ready(second.id)

        before = self.game.snapshot()["players"][0]["money"]

        for _ in range(30):
            self.game.tick(0.1)

        after = self.game.snapshot()["players"][0]["money"]
        self.assertEqual(after - before, 12)

    def test_pvp_dispatch_does_not_refund_owner_when_unit_is_killed(self) -> None:
        defender = self.game.join("Ahmed")
        attacker = self.game.join("Sara")
        self.game.place(defender.id, "sniper", 19, 9)
        self.game.ready(defender.id)
        self.game.ready(attacker.id)

        before = self.game.snapshot()["players"][1]["money"]
        self.game.dispatch(attacker.id, "infantry", defender.team)
        self.game.drain_events()

        killed = False
        for _ in range(12):
            self.game.tick(0.25)
            events = self.game.drain_events()
            if any(event["type"] == "kill" for event in events):
                killed = True
                break

        self.assertTrue(killed)

        attacker_money = next(
            player["money"]
            for player in self.game.snapshot()["players"]
            if player["id"] == attacker.id
        )
        self.assertEqual(attacker_money, before - 35)

    def test_upgrade_spends_money_and_increases_level(self) -> None:
        player = self.game.join("Ahmed")
        tower = self.game.place(player.id, "rifle", 10, 7)

        upgraded = self.game.upgrade(player.id, tower.id)
        events = self.game.drain_events()
        snapshot = self.game.snapshot()

        self.assertEqual(upgraded.level, 2)
        self.assertEqual(snapshot["players"][0]["money"], 315)
        self.assertEqual(events[-1]["type"], "upgraded")
        self.assertEqual(events[-1]["player_id"], player.id)
        self.assertEqual(events[-1]["level"], 2)
        self.assertEqual(events[-1]["cost"], 55)
        self.assertAlmostEqual(events[-1]["damage"], 10.8)
        self.assertAlmostEqual(events[-1]["range"], 3.4375)

    def test_join_issues_resume_token(self) -> None:
        player = self.game.join("Ahmed")

        self.assertTrue(player.token)
        self.assertIs(self.game.find_by_token(player.token), player)
        self.assertIsNone(self.game.find_by_token("nope"))

    def test_state_snapshot_omits_static_map(self) -> None:
        self.game.join("Ahmed")

        self.assertIn("map", self.game.snapshot())
        self.assertNotIn("map", self.game.state())

    def test_leave_during_pvp_lobby_keeps_waiting_for_a_lone_player(self) -> None:
        first = self.game.join("Ahmed")
        second = self.game.join("Sara")
        self.game.ready(first.id)

        self.assertEqual(self.game.snapshot()["status"], "waiting")

        self.game.leave(second.id)

        # The remaining lone player must not start a PvP match by themselves.
        snapshot = self.game.snapshot()
        self.assertEqual(snapshot["status"], "waiting")
        self.assertEqual(len(snapshot["players"]), 1)

    def test_leave_while_running_keeps_player_but_marks_disconnected(self) -> None:
        first = self.game.join("Ahmed")
        second = self.game.join("Sara")
        self.game.ready(first.id)
        self.game.ready(second.id)

        self.assertEqual(self.game.snapshot()["status"], "running")

        self.game.leave(first.id)

        snapshot = self.game.snapshot()
        self.assertEqual(len(snapshot["players"]), 2)
        target = next(p for p in snapshot["players"] if p["id"] == first.id)
        self.assertFalse(target["connected"])

    def test_place_emits_event_and_combat_emits_shot_and_kill(self) -> None:
        defender = self.game.join("Ahmed")
        attacker = self.game.join("Sara")
        self.game.place(defender.id, "sniper", 19, 9)

        placed = self.game.drain_events()
        self.assertEqual([event["type"] for event in placed], ["placed"])

        self.game.ready(defender.id)
        self.game.ready(attacker.id)
        self.game.dispatch(attacker.id, "infantry", "p1")
        kinds: set[str] = set()

        for _ in range(200):
            self.game.tick(0.1)
            kinds.update(event["type"] for event in self.game.drain_events())

        self.assertIn("shot", kinds)
        self.assertIn("kill", kinds)


class SinglePlayerTest(unittest.TestCase):
    """Tests for single-player maps (mode=single, no ready button)."""

    def setUp(self) -> None:
        self.game = GameFactory().create("sp-room", map_id="bocage_run")

    def test_join_starts_game_automatically(self) -> None:
        player = self.game.join("Ahmed")

        snapshot = self.game.snapshot()
        # Game is running immediately — no ready required.
        self.assertEqual(snapshot["status"], "running")
        self.assertFalse(snapshot["wave_active"])
        # Build-phase countdown should be active.
        self.assertGreater(snapshot["prep_remaining"], 0)
        # Player is never marked ready explicitly in single-player.
        self.assertFalse(snapshot["players"][0]["ready"])

    def test_first_wave_starts_after_build_phase(self) -> None:
        self.game.join("Ahmed")

        # Advance past the initial 8-second build phase.
        for _ in range(100):
            self.game.tick(0.1)

        snapshot = self.game.snapshot()
        self.assertTrue(snapshot["wave_active"])
        self.assertGreater(len(snapshot["enemies"]), 0)

    def test_inter_wave_build_phase_follows_each_wave(self) -> None:
        self.game.join("Ahmed")

        # Skip past initial build phase.
        for _ in range(100):
            self.game.tick(0.1)

        self.assertTrue(self.game.snapshot()["wave_active"])

        for _ in range(1200):
            self.game.tick(0.1)
            snapshot = self.game.snapshot()

            if not snapshot["wave_active"] and snapshot["prep_remaining"] > 0:
                break
        else:
            self.fail("Wave did not enter an inter-wave build phase")

        # Between waves: build phase should be active, wave not yet spawning.
        self.assertFalse(snapshot["wave_active"])
        self.assertGreater(snapshot["prep_remaining"], 0)

    def test_prep_remaining_in_snapshot(self) -> None:
        self.game.join("Ahmed")
        snapshot = self.game.snapshot()
        self.assertIn("prep_remaining", snapshot)
        self.assertIsInstance(snapshot["prep_remaining"], float)


class EnemySpacingTest(unittest.TestCase):
    def setUp(self) -> None:
        self.map = DEFAULT_MAPS["bocage_run"]
        self.store = GameStore(
            room_id="spacing-room",
            map_definition=self.map,
            base_health=BASE_HEALTH,
        )
        self.store.claim_base("p1", "player-1")
        self.store.rebuild_navigation(TowerCatalog(DEFAULT_TOWERS))

    def test_spawn_waits_when_spawn_point_is_occupied(self) -> None:
        spawn = self.map.spawns[0]
        blocker = Enemy(
            id="enemy-blocker",
            kind="infantry",
            target="p1",
            health=40,
            position=self.map.center(spawn.tile),
            path=[Tile(spawn.tile.x + 1, spawn.tile.y)],
        )
        self.store.enemies.add(blocker)
        self.store.wave.start()
        spawner = WaveSpawner(
            enemies=EnemyCatalog(DEFAULT_ENEMIES),
            waves=WaveCatalog((WaveDefinition(entries=(WaveEntry("infantry", 1, 0.1),)),)),
        )

        spawner.update(self.store, 0.2)

        self.assertEqual(len(self.store.enemies.list()), 1)
        self.assertEqual(self.store.wave.get_spawned(), 0)

    def test_fast_enemy_queues_behind_slow_enemy(self) -> None:
        leader = Enemy(
            id="enemy-leader",
            kind="boss",
            target="p1",
            health=5000,
            position=self.map.center(Tile(6, 11)),
            path=[Tile(7, 11)],
        )
        follower = Enemy(
            id="enemy-follower",
            kind="scout",
            target="p1",
            health=30,
            position=self.map.center(Tile(5, 11)),
            path=[Tile(6, 11)],
        )
        self.store.enemies.add(leader)
        self.store.enemies.add(follower)
        mover = EnemyMover(EnemyCatalog(DEFAULT_ENEMIES))

        mover.update(self.store, 0.5)

        self.assertGreaterEqual(
            leader.position.get_distance(follower.position),
            SEPARATION - 1e-5,
        )
        self.assertLess(follower.position.x, leader.position.x)

    def test_enemy_leaks_when_radius_touches_base_edge(self) -> None:
        base = self.map.base_tile("p1")
        self.assertIsNotNone(base)
        enemy = Enemy(
            id="enemy-contact",
            kind="infantry",
            target="p1",
            health=40,
            position=self.map.center(Tile(base.x - 1, base.y)),
            path=[base],
            base_damage=1,
        )
        self.store.enemies.add(enemy)
        mover = EnemyMover(EnemyCatalog(DEFAULT_ENEMIES))

        mover.update(self.store, 0.1)
        events = self.store.drain_events()

        self.assertEqual(self.store.enemies.list(), [])
        self.assertEqual(self.store.base_health("p1"), BASE_HEALTH - 1)
        self.assertEqual(events[-1]["type"], "leak")
        self.assertLess(events[-1]["x"], base.x)
        self.assertAlmostEqual(events[-1]["x"], base.x - DEFAULT_ENEMIES["infantry"].radius, places=3)

    def test_dispatched_enemy_refunds_owner_when_it_reaches_base(self) -> None:
        base = self.map.base_tile("p1")
        self.assertIsNotNone(base)
        owner = "attacker"
        self.store.players.add(
            Player(
                id=owner,
                name="Attacker",
                team="p2",
                money=0,
            )
        )
        enemy = Enemy(
            id="enemy-dispatched-contact",
            kind="infantry",
            target="p1",
            health=40,
            position=self.map.center(Tile(base.x - 1, base.y)),
            path=[base],
            owner_id=owner,
            base_damage=1,
        )
        self.store.enemies.add(enemy)
        mover = EnemyMover(EnemyCatalog(DEFAULT_ENEMIES))

        mover.update(self.store, 0.1)

        self.assertEqual(self.store.players.get(owner).money, 23)


if __name__ == "__main__":
    unittest.main()
