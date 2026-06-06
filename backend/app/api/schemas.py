"""API schemas and message validation."""

from __future__ import annotations

from typing import Any, Literal, Optional, Union

from pydantic import BaseModel, Field, ValidationError as PydanticValidationError, model_validator

from backend.app.domain.errors import ValidationError


class MapInfo(BaseModel):
    id: str
    name: str
    mode: str
    players: int
    cols: int
    rows: int


class CreateRoomRequest(BaseModel):
    map_id: str = ""


class CreateRoomResponse(BaseModel):
    room_id: str


class MapPoint(BaseModel):
    x: int = Field(ge=0, le=64)
    y: int = Field(ge=0, le=36)


class MapLanePoint(BaseModel):
    x: int = Field(ge=-1, le=64)
    y: int = Field(ge=0, le=36)


class MapPathTile(BaseModel):
    x: int = Field(ge=0, le=64)
    y: int = Field(ge=0, le=36)
    key: str = Field(min_length=1, max_length=16)


class MapDeco(BaseModel):
    key: str = Field(min_length=1, max_length=24)
    x: int = Field(ge=0, le=64)
    y: int = Field(ge=0, le=36)


class MapBase(BaseModel):
    team: Literal["p1", "p2", "p3", "p4"]
    x: int = Field(ge=0, le=64)
    y: int = Field(ge=0, le=36)


class MapSpawn(BaseModel):
    x: int = Field(ge=-1, le=64)
    y: int = Field(ge=0, le=36)
    target: Literal["p1", "p2", "p3", "p4"]
    team: Optional[Literal["p1", "p2", "p3", "p4"]] = None
    lane: int = Field(default=0, ge=0, le=16)


class DesignerMapRequest(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    mode: Literal["single", "pvp"] = "single"
    players: int = Field(ge=1, le=4)
    cols: int = Field(default=40, ge=16, le=64)
    rows: int = Field(default=22, ge=12, le=36)
    tile: int = Field(default=48, ge=24, le=96)
    bases: list[MapBase] = Field(min_length=1, max_length=4)
    spawns: list[MapSpawn] = Field(min_length=1, max_length=8)
    water: list[MapPoint] = Field(default_factory=list, max_length=512)
    deco: list[MapDeco] = Field(default_factory=list, max_length=512)
    pathTiles: list[MapPathTile] = Field(default_factory=list, max_length=512)
    lanes: list[list[MapLanePoint]] = Field(default_factory=list, max_length=8)
    blocked: list[MapPoint] = Field(default_factory=list, max_length=2048)

    @model_validator(mode="after")
    def validate_map(self) -> "DesignerMapRequest":
        expected_players = 1 if self.mode == "single" else self.players

        if self.mode == "single" and self.players != 1:
            raise ValueError("Single-player maps must have one player")

        if self.mode == "pvp" and self.players not in {2, 4}:
            raise ValueError("PvP maps must have two or four players")

        teams = {f"p{i}" for i in range(1, expected_players + 1)}
        base_teams = [base.team for base in self.bases]

        if set(base_teams) != teams or len(base_teams) != len(set(base_teams)):
            raise ValueError("Each player team needs exactly one HQ")

        spawn_targets = {spawn.target for spawn in self.spawns}
        spawn_teams = {spawn.team for spawn in self.spawns if spawn.team is not None}

        if spawn_teams:
            if spawn_teams != teams:
                raise ValueError("Each player team needs exactly one spawn")
            for spawn in self.spawns:
                if spawn.team and spawn.target == spawn.team:
                    raise ValueError("Team spawn must target an enemy base")
        elif not teams.issubset(spawn_targets):
            raise ValueError("Each player team needs at least one spawn")

        for item in self._all_points():
            if item.x >= self.cols or item.y >= self.rows:
                raise ValueError("Map coordinates must be inside the grid")

        return self

    def to_map_data(self) -> dict[str, Any]:
        return self.model_dump()

    def _all_points(self) -> list[Any]:
        points: list[Any] = []
        points.extend(self.bases)
        points.extend(self.water)
        points.extend(self.deco)
        points.extend(self.pathTiles)
        points.extend(self.blocked)

        for spawn in self.spawns:
            if spawn.x >= 0:
                points.append(spawn)

        for lane in self.lanes:
            points.extend(point for point in lane if point.x >= 0)

        return points


class SaveMapResponse(BaseModel):
    map: MapInfo


class HealthResponse(BaseModel):
    status: str


class JoinMessage(BaseModel):
    type: Literal["join"]
    name: str = Field(min_length=1, max_length=24)


class ResumeMessage(BaseModel):
    type: Literal["resume"]
    token: str = Field(min_length=1, max_length=128)


class ReadyMessage(BaseModel):
    type: Literal["ready"]


class PlaceMessage(BaseModel):
    type: Literal["place"]
    tower_type: str = Field(min_length=1, max_length=24)
    x: int = Field(ge=0)
    y: int = Field(ge=0)


class DispatchMessage(BaseModel):
    type: Literal["dispatch"]
    unit_type: str = Field(min_length=1, max_length=24)
    target_team: Optional[str] = Field(default=None, max_length=8)


class UpgradeMessage(BaseModel):
    type: Literal["upgrade"]
    tower_id: str = Field(min_length=1, max_length=64)


class PingMessage(BaseModel):
    type: Literal["ping"]


ClientMessage = Union[
    JoinMessage,
    ResumeMessage,
    ReadyMessage,
    PlaceMessage,
    DispatchMessage,
    UpgradeMessage,
    PingMessage,
]


class MessageValidator:
    def __init__(self) -> None:
        self._schemas = {
            "join": JoinMessage,
            "resume": ResumeMessage,
            "ready": ReadyMessage,
            "place": PlaceMessage,
            "dispatch": DispatchMessage,
            "upgrade": UpgradeMessage,
            "ping": PingMessage,
        }

    def validate(self, data: object) -> ClientMessage:
        if not isinstance(data, dict):
            raise ValidationError("Message must be an object")

        message_type = data.get("type")

        if message_type not in self._schemas:
            raise ValidationError("Message type is not supported")

        schema = self._schemas[message_type]

        try:
            return schema.model_validate(data)
        except PydanticValidationError as error:
            raise ValidationError("Message is invalid") from error
