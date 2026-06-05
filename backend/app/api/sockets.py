"""WebSocket handler for multiplayer rooms."""

from __future__ import annotations

import asyncio
import logging

from fastapi import WebSocket, WebSocketDisconnect

from backend.app.api.schemas import (
    ClientMessage,
    JoinMessage,
    MessageValidator,
    PingMessage,
    PlaceMessage,
    ReadyMessage,
    ResumeMessage,
    UpgradeMessage,
)
from backend.app.domain.errors import GameError, ValidationError
from backend.app.server.rooms import Room, RoomService


logger = logging.getLogger(__name__)

# Per-connection flood protection: a leaky token bucket sized for brisk human
# play (placing/upgrading) but far below what a script would push.
RATE_LIMIT_CAPACITY = 20
RATE_LIMIT_PER_SECOND = 10.0


class RateLimiter:
    def __init__(self, capacity: int, per_second: float) -> None:
        self._capacity = capacity
        self._per_second = per_second
        self._tokens = float(capacity)
        self._updated: float | None = None

    def allow(self, now: float) -> bool:
        if self._updated is None:
            self._updated = now

        self._tokens = min(
            self._capacity,
            self._tokens + (now - self._updated) * self._per_second,
        )
        self._updated = now

        if self._tokens < 1.0:
            return False

        self._tokens -= 1.0
        return True


class SocketHandler:
    def __init__(self, rooms: RoomService, validator: MessageValidator) -> None:
        self._rooms = rooms
        self._validator = validator

    async def handle(self, room_id: str, socket: WebSocket) -> None:
        await socket.accept()
        player_id: str | None = None
        room: Room | None = None
        limiter = RateLimiter(RATE_LIMIT_CAPACITY, RATE_LIMIT_PER_SECOND)
        loop = asyncio.get_running_loop()

        try:
            room = self._rooms.get(room_id)

            while True:
                data = await socket.receive_json()

                if not limiter.allow(loop.time()):
                    await socket.send_json(
                        {"type": "error", "message": "Slow down"}
                    )
                    continue

                try:
                    message = self._validator.validate(data)
                    player_id = await self._execute(room, player_id, message, socket)
                except GameError as error:
                    await socket.send_json({"type": "error", "message": str(error)})

        except WebSocketDisconnect:
            if player_id is not None and room is not None:
                await room.disconnect(player_id)
        except GameError as error:
            await socket.send_json({"type": "error", "message": str(error)})
            await socket.close()
        except Exception:
            logger.exception(
                "Socket handler failed",
                extra={"room_id": room_id, "player_id": player_id},
            )
            if player_id is not None and room is not None:
                await room.disconnect(player_id)
            raise

    async def _execute(
        self,
        room: Room,
        player_id: str | None,
        message: ClientMessage,
        socket: WebSocket,
    ) -> str | None:
        if isinstance(message, JoinMessage):
            return await self._join(room, player_id, message, socket)

        if isinstance(message, ResumeMessage):
            return await self._resume(room, player_id, message, socket)

        if player_id is None:
            raise ValidationError("Join before sending commands")

        if isinstance(message, ReadyMessage):
            await room.apply(lambda game: game.ready(player_id))
            return player_id

        if isinstance(message, PlaceMessage):
            await room.apply(
                lambda game: game.place(
                    player_id=player_id,
                    tower_type=message.tower_type,
                    x=message.x,
                    y=message.y,
                )
            )
            return player_id

        if isinstance(message, UpgradeMessage):
            await room.apply(
                lambda game: game.upgrade(
                    player_id=player_id,
                    tower_id=message.tower_id,
                )
            )
            return player_id

        if isinstance(message, PingMessage):
            await socket.send_json({"type": "pong"})
            return player_id

        raise ValidationError("Message type is not supported")

    async def _join(
        self,
        room: Room,
        player_id: str | None,
        message: JoinMessage,
        socket: WebSocket,
    ) -> str:
        if player_id is not None:
            raise ValidationError("Player already joined")

        new_id, token, snapshot = await room.add_player(message.name, socket)
        await room.send(
            new_id,
            {
                "type": "joined",
                "player_id": new_id,
                "token": token,
                "payload": snapshot,
            },
        )
        await room.broadcast_state()
        return new_id

    async def _resume(
        self,
        room: Room,
        player_id: str | None,
        message: ResumeMessage,
        socket: WebSocket,
    ) -> str | None:
        if player_id is not None:
            raise ValidationError("Player already joined")

        resumed = await room.resume_player(message.token, socket)

        if resumed is None:
            await socket.send_json({"type": "resume_failed"})
            return None

        new_id, snapshot = resumed
        await room.send(
            new_id,
            {
                "type": "resumed",
                "player_id": new_id,
                "payload": snapshot,
            },
        )
        await room.broadcast_state()
        return new_id
