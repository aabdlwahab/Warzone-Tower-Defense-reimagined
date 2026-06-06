"""Map file persistence for built-in and designer-created maps."""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from backend.app.domain.catalogs import MAPS_DIR, TILE_PIXELS, load_map, load_maps
from backend.app.domain.errors import MissingError, ValidationError
from backend.app.domain.models import MapDefinition


SAFE_ID = re.compile(r"^[a-z0-9_]{1,64}$")


class MapFileService:
    def __init__(self, directory: Path = MAPS_DIR) -> None:
        self._directory = directory
        self._directory.mkdir(parents=True, exist_ok=True)

    def list(self) -> dict[str, MapDefinition]:
        return load_maps(self._directory)

    def get(self, map_id: str) -> dict[str, Any]:
        path = self._path(map_id)

        if not path.exists():
            raise MissingError("Map does not exist")

        return json.loads(path.read_text())

    def save(self, data: dict[str, Any]) -> dict[str, Any]:
        map_data = dict(data)
        map_data["id"] = self._unique_id(str(map_data["name"]))
        map_data.setdefault("symmetry", "custom")
        map_data.setdefault("tile", TILE_PIXELS)
        map_data["width"] = int(map_data["cols"]) * int(map_data["tile"])
        map_data["height"] = int(map_data["rows"]) * int(map_data["tile"])

        definition = load_map(map_data)
        map_data["buildableCount"] = len(definition.buildable)

        path = self._path(definition.id)
        path.write_text(json.dumps(map_data, indent=2) + "\n")
        return map_data

    def _path(self, map_id: str) -> Path:
        if not SAFE_ID.fullmatch(map_id):
            raise ValidationError("Map id is invalid")

        return self._directory / f"{map_id}.json"

    def _unique_id(self, name: str) -> str:
        stem = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_") or "custom_map"
        stem = f"custom_{stem}"[:56].rstrip("_")

        for index in range(1, 100):
            suffix = "" if index == 1 else f"_{index}"
            candidate = f"{stem}{suffix}"

            if not self._path(candidate).exists():
                return candidate

        raise ValidationError("Could not create a unique map id")
