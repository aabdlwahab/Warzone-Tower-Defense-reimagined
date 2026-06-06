"""FastAPI application entrypoint."""

from __future__ import annotations

import os

from fastapi import FastAPI, HTTPException, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.schemas import (
    CreateRoomRequest,
    CreateRoomResponse,
    DesignerMapRequest,
    HealthResponse,
    MapInfo,
    MessageValidator,
    SaveMapResponse,
)
from backend.app.domain.catalogs import DEFAULT_MAP_ID
from backend.app.domain.errors import MissingError, ValidationError
from backend.app.api.sockets import SocketHandler
from backend.app.domain.services import GameFactory
from backend.app.server.maps import MapFileService
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
    maps = MapFileService()
    factory = GameFactory()
    factory.maps().reload(maps.list())
    rooms = RoomService(store=RoomStore(), factory=factory)
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

    @app.get("/api/v1/maps", response_model=list[MapInfo])
    def list_maps() -> list[MapInfo]:
        factory.maps().reload(maps.list())
        return [
            MapInfo(
                id=m.id,
                name=m.name,
                mode=m.mode,
                players=m.players,
                cols=m.cols,
                rows=m.rows,
            )
            for m in factory.maps().list()
        ]

    @app.get("/api/v1/maps/{map_id}")
    def get_map(map_id: str) -> dict:
        try:
            return maps.get(map_id)
        except (MissingError, ValidationError) as error:
            raise HTTPException(status_code=404, detail=str(error)) from error

    @app.post("/api/v1/maps", response_model=SaveMapResponse)
    def save_map(body: DesignerMapRequest) -> SaveMapResponse:
        try:
            map_data = maps.save(body.to_map_data())
            factory.maps().reload(maps.list())
        except ValidationError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        return SaveMapResponse(
            map=MapInfo(
                id=map_data["id"],
                name=map_data["name"],
                mode=map_data["mode"],
                players=map_data["players"],
                cols=map_data["cols"],
                rows=map_data["rows"],
            )
        )

    @app.post("/api/v1/rooms", response_model=CreateRoomResponse)
    async def create(body: CreateRoomRequest = CreateRoomRequest()) -> CreateRoomResponse:
        factory.maps().reload(maps.list())
        map_id = body.map_id.strip() or DEFAULT_MAP_ID
        room = rooms.create(map_id=map_id)
        return CreateRoomResponse(room_id=room.get_id())

    @app.websocket("/api/v1/rooms/{room_id}/ws")
    async def connect(room_id: str, socket: WebSocket) -> None:
        await sockets.handle(room_id, socket)

    return app


app = build()
