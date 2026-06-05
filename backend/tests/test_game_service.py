"""Behavior tests for the game service."""

from __future__ import annotations

import unittest

from backend.app.domain.errors import ValidationError
from backend.app.domain.services import GameFactory


class GameServiceTest(unittest.TestCase):
    def setUp(self) -> None:
        self.game = GameFactory().create("test-room")

    def test_ready_starts_first_wave(self) -> None:
        player = self.game.join("Ahmed")

        self.game.ready(player.id)

        snapshot = self.game.snapshot()
        self.assertEqual(snapshot["status"], "running")
        self.assertEqual(snapshot["wave"], 1)
        self.assertTrue(snapshot["wave_active"])

    def test_place_spends_money_and_blocks_duplicate_tile(self) -> None:
        player = self.game.join("Ahmed")

        tower = self.game.place(player.id, "rifle", 1, 1)
        snapshot = self.game.snapshot()

        self.assertEqual(tower.kind, "rifle")
        self.assertEqual(snapshot["players"][0]["money"], 200)

        with self.assertRaises(ValidationError):
            self.game.place(player.id, "rifle", 1, 1)

    def test_tick_spawns_enemy_after_wave_starts(self) -> None:
        player = self.game.join("Ahmed")
        self.game.ready(player.id)

        snapshot = self.game.tick(0.8)

        self.assertEqual(snapshot["status"], "running")
        self.assertEqual(len(snapshot["enemies"]), 1)
        self.assertEqual(snapshot["enemies"][0]["kind"], "grunt")

    def test_tower_rewards_owner_for_kill(self) -> None:
        player = self.game.join("Ahmed")
        self.game.place(player.id, "rifle", 2, 3)
        self.game.ready(player.id)

        for _ in range(90):
            self.game.tick(0.25)

        snapshot = self.game.snapshot()
        self.assertGreater(snapshot["players"][0]["money"], 200)

    def test_upgrade_spends_money_and_increases_level(self) -> None:
        player = self.game.join("Ahmed")
        tower = self.game.place(player.id, "rifle", 1, 1)

        upgraded = self.game.upgrade(player.id, tower.id)
        snapshot = self.game.snapshot()

        self.assertEqual(upgraded.level, 2)
        self.assertEqual(snapshot["players"][0]["money"], 90)

    def test_join_issues_resume_token(self) -> None:
        player = self.game.join("Ahmed")

        self.assertTrue(player.token)
        self.assertIs(self.game.find_by_token(player.token), player)
        self.assertIsNone(self.game.find_by_token("nope"))

    def test_state_snapshot_omits_static_map(self) -> None:
        self.game.join("Ahmed")

        self.assertIn("map", self.game.snapshot())
        self.assertNotIn("map", self.game.state())

    def test_leave_during_lobby_starts_with_remaining_ready_players(self) -> None:
        first = self.game.join("Ahmed")
        second = self.game.join("Sara")
        self.game.ready(first.id)

        self.assertEqual(self.game.snapshot()["status"], "waiting")

        self.game.leave(second.id)

        snapshot = self.game.snapshot()
        self.assertEqual(snapshot["status"], "running")
        self.assertEqual(len(snapshot["players"]), 1)

    def test_leave_while_running_keeps_player_but_marks_disconnected(self) -> None:
        player = self.game.join("Ahmed")
        self.game.ready(player.id)

        self.game.leave(player.id)

        snapshot = self.game.snapshot()
        self.assertEqual(len(snapshot["players"]), 1)
        self.assertFalse(snapshot["players"][0]["connected"])

    def test_place_emits_event_and_combat_emits_shot_and_kill(self) -> None:
        player = self.game.join("Ahmed")
        self.game.place(player.id, "rifle", 2, 3)

        placed = self.game.drain_events()
        self.assertEqual([event["type"] for event in placed], ["placed"])

        self.game.ready(player.id)
        kinds: set[str] = set()

        for _ in range(120):
            self.game.tick(0.1)
            kinds.update(event["type"] for event in self.game.drain_events())

        self.assertIn("shot", kinds)
        self.assertIn("kill", kinds)


if __name__ == "__main__":
    unittest.main()

