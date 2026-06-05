"""API schemas and message validation."""

from __future__ import annotations

from typing import Literal, Union

from pydantic import BaseModel, Field, ValidationError as PydanticValidationError

from backend.app.domain.errors import ValidationError


class CreateRoomResponse(BaseModel):
    room_id: str


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
