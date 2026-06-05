"""FastAPI application entrypoint."""

from __future__ import annotations

import os

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.schemas import CreateRoomResponse, HealthResponse, MessageValidator
from backend.app.api.sockets import SocketHandler
from backend.app.domain.services import GameFactory
from backend.app.server.rooms import RoomService, RoomStore


DEFAULT_ORIGINS = (
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
)


def _allowed_origins() -> list[str]:
    configured = os.getenv("WARZONE_ALLOWED_ORIGINS")

    if not configured:
        return list(DEFAULT_ORIGINS)

    return [origin.strip() for origin in configured.split(",") if origin.strip()]


def build() -> FastAPI:
    app = FastAPI(title="Warzone Tower Defense Multiplayer API", version="0.1.0")
    rooms = RoomService(store=RoomStore(), factory=GameFactory())
    sockets = SocketHandler(rooms=rooms, validator=MessageValidator())

    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins(),
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", response_model=HealthResponse)
    def get_health() -> HealthResponse:
        return HealthResponse(status="ok")

    @app.post("/api/v1/rooms", response_model=CreateRoomResponse)
    async def create() -> CreateRoomResponse:
        room = rooms.create()
        return CreateRoomResponse(room_id=room.get_id())

    @app.websocket("/api/v1/rooms/{room_id}/ws")
    async def connect(room_id: str, socket: WebSocket) -> None:
        await sockets.handle(room_id, socket)

    return app


app = build()
