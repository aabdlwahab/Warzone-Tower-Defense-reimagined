"""Snapshot mapping for client-safe game state.

A ``map`` snapshot carries the static board (sent once on join/resume); a
``state`` snapshot omits it so per-tick broadcasts stay small.
"""

from __future__ import annotations

from typing import Any

from backend.app.domain.stores import GameStore


class SnapshotMapper:
    def map(self, store: GameStore) -> dict[str, Any]:
        map_definition = store.get_map()
        snapshot = self.state(store)
        snapshot["map"] = {
            "id": map_definition.id,
            "width": map_definition.width,
            "height": map_definition.height,
            "path": [
                {"x": point.x, "y": point.y}
                for point in map_definition.path
            ],
            "buildable": [
                {"x": tile.x, "y": tile.y}
                for tile in sorted(
                    map_definition.buildable,
                    key=lambda tile: (tile.y, tile.x),
                )
            ],
        }
        return snapshot

    def state(self, store: GameStore) -> dict[str, Any]:
        map_definition = store.get_map()

        return {
            "room_id": store.get_room(),
            "status": store.get_status().value,
            "base_health": store.get_health(),
            "wave": store.wave.get_index() + 1,
            "wave_active": store.wave.is_active(),
            "players": [
                {
                    "id": player.id,
                    "name": player.name,
                    "money": player.money,
                    "ready": player.ready,
                    "connected": player.connected,
                }
                for player in store.players.list()
            ],
            "towers": [
                {
                    "id": tower.id,
                    "owner_id": tower.owner_id,
                    "kind": tower.kind,
                    "level": tower.level,
                    "x": tower.tile.x,
                    "y": tower.tile.y,
                }
                for tower in store.towers.list()
            ],
            "enemies": [
                {
                    "id": enemy.id,
                    "kind": enemy.kind,
                    "health": enemy.health,
                    "distance": enemy.distance,
                    "position": {
                        "x": map_definition.get_position(enemy.distance).x,
                        "y": map_definition.get_position(enemy.distance).y,
                    },
                }
                for enemy in store.enemies.list()
            ],
        }
