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
            "name": map_definition.name,
            "mode": map_definition.mode,
            "players": map_definition.players,
            "tile": map_definition.tile,
            "cols": map_definition.cols,
            "rows": map_definition.rows,
            "bases": [
                {"team": base.team, "x": base.tile.x, "y": base.tile.y}
                for base in map_definition.bases
            ],
            "spawns": [
                {
                    "x": spawn.tile.x,
                    "y": spawn.tile.y,
                    "target": spawn.target,
                    **({"team": spawn.team} if spawn.team else {}),
                }
                for spawn in map_definition.spawns
            ],
            "water": [
                {"x": tile.x, "y": tile.y}
                for tile in sorted(map_definition.water, key=lambda t: (t.y, t.x))
            ],
            "deco": [
                {"key": entry.key, "x": entry.tile.x, "y": entry.tile.y}
                for entry in map_definition.deco
            ],
            "buildable": [
                {"x": tile.x, "y": tile.y}
                for tile in sorted(map_definition.buildable, key=lambda t: (t.y, t.x))
            ],
        }
        return snapshot

    def state(self, store: GameStore) -> dict[str, Any]:
        return {
            "room_id": store.get_room(),
            "status": store.get_status().value,
            "winner": store.get_winner(),
            "wave": store.wave.get_index() + 1,
            "wave_active": store.wave.is_active(),
            "prep_remaining": round(store.wave.prep_remaining(), 2),
            "players": [
                {
                    "id": player.id,
                    "name": player.name,
                    "money": player.money,
                    "ready": player.ready,
                    "connected": player.connected,
                    "team": player.team,
                    "alive": player.alive,
                }
                for player in store.players.list()
            ],
            "bases": [
                {
                    "team": base.team,
                    "x": base.tile.x,
                    "y": base.tile.y,
                    "health": store.base_health(base.team),
                    "max_health": store.get_health(),
                    "owner_id": store.base_owner(base.team),
                    "alive": store.base_alive(base.team),
                }
                for base in store.get_map().bases
            ],
            "towers": [
                {
                    "id": tower.id,
                    "owner_id": tower.owner_id,
                    "team": tower.team,
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
                    "target": enemy.target,
                    "health": enemy.health,
                    "base_damage": enemy.base_damage,
                    "heading": enemy.heading,
                    "remaining": enemy.remaining(),
                    "position": {"x": enemy.position.x, "y": enemy.position.y},
                }
                for enemy in store.enemies.list()
            ],
        }
