"""Room lifecycle and realtime broadcasting."""

from __future__ import annotations

import asyncio
import logging
import secrets
from typing import Any, Callable

from fastapi import WebSocket

from backend.app.domain.errors import MissingError, ValidationError
from backend.app.domain.services import GameFactory, GameService


logger = logging.getLogger(__name__)

# The simulation advances on a fixed timestep so play speed never depends on
# event-loop jitter; broadcasts are throttled to a coarser cadence.
SIM_SECONDS = 0.05
BROADCAST_SECONDS = 0.1
MAX_STEPS = 5
GRACE_SECONDS = 30.0
EMPTY_SECONDS = 60.0


class Room:
    def __init__(
        self,
        room_id: str,
        game: GameService,
        *,
        sim_seconds: float = SIM_SECONDS,
        broadcast_seconds: float = BROADCAST_SECONDS,
        max_steps: int = MAX_STEPS,
        grace_seconds: float = GRACE_SECONDS,
        empty_seconds: float = EMPTY_SECONDS,
        on_close: Callable[[], None] | None = None,
    ) -> None:
        self._id = room_id
        self._game = game
        self._sim_seconds = sim_seconds
        self._broadcast_seconds = broadcast_seconds
        self._max_steps = max_steps
        self._max_frame = sim_seconds * max_steps
        self._grace_seconds = grace_seconds
        self._empty_seconds = empty_seconds
        self._on_close = on_close
        self._connections: dict[str, WebSocket] = {}
        self._pending: dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()
        self._task: asyncio.Task[None] | None = None
        self._active = False

    def get_game(self) -> GameService:
        return self._game

    def get_id(self) -> str:
        return self._id

    def is_empty(self) -> bool:
        return not self._connections

    def start(self) -> None:
        if self._active:
            return

        self._active = True
        self._task = asyncio.create_task(self._run())

    async def add_player(
        self, name: str, socket: WebSocket
    ) -> tuple[str, str, dict[str, Any]]:
        async with self._lock:
            player = self._game.join(name)
            full = self._game.snapshot()

        self._connections[player.id] = socket
        return player.id, player.token, full

    async def resume_player(
        self, token: str, socket: WebSocket
    ) -> tuple[str, dict[str, Any]] | None:
        async with self._lock:
            player = self._game.find_by_token(token)

            if player is None:
                return None

            player_id = player.id
            self._game.set_connected(player_id, True)
            full = self._game.snapshot()

        task = self._pending.pop(player_id, None)

        if task is not None:
            task.cancel()

        self._connections[player_id] = socket
        return player_id, full

    async def apply(self, mutate: Callable[[GameService], Any]) -> Any:
        async with self._lock:
            result = mutate(self._game)

        await self.broadcast_state()
        return result

    async def broadcast(self, message: dict[str, Any]) -> None:
        failed: list[str] = []

        for player_id, socket in list(self._connections.items()):
            try:
                await socket.send_json(message)
            except Exception:
                logger.info(
                    "Broadcast failed",
                    extra={"room_id": self._id, "player_id": player_id},
                )
                failed.append(player_id)

        for player_id in failed:
            await self.disconnect(player_id)

    async def broadcast_state(self) -> None:
        async with self._lock:
            events = self._game.drain_events()
            payload = self._game.state()

        await self.broadcast(
            {"type": "snapshot", "payload": payload, "events": events}
        )

    async def disconnect(self, player_id: str) -> None:
        self._connections.pop(player_id, None)
        self._game.set_connected(player_id, False)

        if player_id in self._pending:
            return

        self._pending[player_id] = asyncio.create_task(self._expire(player_id))

    async def send(self, player_id: str, message: dict[str, Any]) -> None:
        if player_id not in self._connections:
            raise MissingError("Socket is not connected")

        await self._connections[player_id].send_json(message)

    async def stop(self) -> None:
        self._active = False

        for task in list(self._pending.values()):
            task.cancel()

        self._pending.clear()

        if self._task is None:
            return

        self._task.cancel()

        try:
            await self._task
        except asyncio.CancelledError:
            logger.info("Room stopped", extra={"room_id": self._id})

    async def _expire(self, player_id: str) -> None:
        try:
            await asyncio.sleep(self._grace_seconds)
        except asyncio.CancelledError:
            return

        self._pending.pop(player_id, None)

        async with self._lock:
            self._game.leave(player_id)

        await self.broadcast_state()

    async def _run(self) -> None:
        loop = asyncio.get_running_loop()
        previous = loop.time()
        accumulator = 0.0
        since_broadcast = 0.0
        empty_since = previous

        while self._active:
            await asyncio.sleep(self._sim_seconds)
            now = loop.time()
            frame = now - previous
            previous = now

            if self._connections:
                empty_since = now
            elif now - empty_since > self._empty_seconds:
                break

            accumulator += min(frame, self._max_frame)

            async with self._lock:
                steps = 0

                while accumulator >= self._sim_seconds and steps < self._max_steps:
                    self._game.tick(self._sim_seconds)
                    accumulator -= self._sim_seconds
                    steps += 1

            since_broadcast += frame

            if since_broadcast >= self._broadcast_seconds:
                since_broadcast = 0.0
                await self.broadcast_state()

        self._active = False

        for task in list(self._pending.values()):
            task.cancel()

        self._pending.clear()

        if self._on_close is not None:
            self._on_close()


class RoomStore:
    def __init__(self) -> None:
        self._items: dict[str, Room] = {}

    def get(self, room_id: str) -> Room:
        if room_id not in self._items:
            raise MissingError("Room does not exist")

        return self._items[room_id]

    def has(self, room_id: str) -> bool:
        return room_id in self._items

    def list(self) -> list[Room]:
        return list(self._items.values())

    def add(self, room: Room) -> None:
        if self.has(room.get_id()):
            raise ValidationError("Room already exists")

        self._items[room.get_id()] = room

    def remove(self, room_id: str) -> None:
        if room_id in self._items:
            del self._items[room_id]


class RoomService:
    def __init__(self, store: RoomStore, factory: GameFactory) -> None:
        self._store = store
        self._factory = factory

    def create(self) -> Room:
        room_id = self._create()
        room = Room(
            room_id=room_id,
            game=self._factory.create(room_id),
            on_close=lambda: self._store.remove(room_id),
        )
        self._store.add(room)
        room.start()
        return room

    def get(self, room_id: str) -> Room:
        return self._store.get(room_id)

    def list(self) -> list[Room]:
        return self._store.list()

    def _create(self) -> str:
        for _ in range(10):
            room_id = secrets.token_hex(3).upper()

            if not self._store.has(room_id):
                return room_id

        raise ValidationError("Could not create a room")
