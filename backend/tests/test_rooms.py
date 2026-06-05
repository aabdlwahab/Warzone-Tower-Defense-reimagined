"""Behavior tests for room lifecycle: reconnection and reaping."""

from __future__ import annotations

import asyncio
import unittest
from typing import Any

from backend.app.domain.services import GameFactory
from backend.app.server.rooms import Room


class FakeSocket:
    def __init__(self) -> None:
        self.sent: list[dict[str, Any]] = []

    async def send_json(self, message: dict[str, Any]) -> None:
        self.sent.append(message)


def _room(**kwargs: Any) -> Room:
    return Room("ROOM", GameFactory().create("ROOM"), **kwargs)


class RoomLifecycleTest(unittest.IsolatedAsyncioTestCase):
    async def test_disconnect_during_lobby_frees_slot_after_grace(self) -> None:
        room = _room(grace_seconds=0.02, empty_seconds=100.0)
        player_id, _, _ = await room.add_player("Ahmed", FakeSocket())

        await room.disconnect(player_id)
        await asyncio.sleep(0.06)

        self.assertEqual(len(room.get_game().snapshot()["players"]), 0)

    async def test_resume_cancels_pending_removal(self) -> None:
        room = _room(grace_seconds=0.02, empty_seconds=100.0)
        player_id, token, _ = await room.add_player("Ahmed", FakeSocket())

        await room.disconnect(player_id)
        resumed = await room.resume_player(token, FakeSocket())
        await asyncio.sleep(0.06)

        self.assertIsNotNone(resumed)
        players = room.get_game().snapshot()["players"]
        self.assertEqual(len(players), 1)
        self.assertTrue(players[0]["connected"])

    async def test_resume_with_unknown_token_returns_none(self) -> None:
        room = _room()

        self.assertIsNone(await room.resume_player("missing", FakeSocket()))

    async def test_empty_room_self_closes_and_reports(self) -> None:
        closed: list[str] = []
        room = Room(
            "ROOM",
            GameFactory().create("ROOM"),
            sim_seconds=0.01,
            broadcast_seconds=0.02,
            empty_seconds=0.05,
            on_close=lambda: closed.append("ROOM"),
        )
        room.start()

        await asyncio.sleep(0.25)
        await room.stop()

        self.assertEqual(closed, ["ROOM"])

    async def test_populated_room_keeps_running(self) -> None:
        room = _room(sim_seconds=0.01, broadcast_seconds=0.02, empty_seconds=0.05)
        socket = FakeSocket()
        player_id, _, _ = await room.add_player("Ahmed", socket)
        room.get_game().ready(player_id)
        room.start()

        await asyncio.sleep(0.15)
        self.assertFalse(room.is_empty())
        self.assertTrue(any(message["type"] == "snapshot" for message in socket.sent))

        await room.disconnect(player_id)
        await room.stop()


if __name__ == "__main__":
    unittest.main()
