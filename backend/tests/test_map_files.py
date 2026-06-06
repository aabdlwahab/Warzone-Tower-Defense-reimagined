"""Behavior tests for saved map file persistence."""

from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.app.server.maps import MapFileService


def _map_data(name: str = "Custom Test") -> dict:
    return {
        "name": name,
        "mode": "single",
        "players": 1,
        "cols": 40,
        "rows": 20,
        "tile": 48,
        "bases": [{"team": "p1", "x": 37, "y": 11}],
        "spawns": [{"x": 0, "y": 11, "target": "p1", "lane": 0}],
        "water": [],
        "deco": [],
        "pathTiles": [{"x": 1, "y": 11, "key": "h"}],
        "lanes": [[{"x": 0, "y": 11}, {"x": 37, "y": 11}]],
        "blocked": [],
    }


class MapFileServiceTest(unittest.TestCase):
    def test_save_persists_map_and_loads_it_in_catalog(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            service = MapFileService(Path(directory))

            saved = service.save(_map_data())

            self.assertEqual(saved["id"], "custom_custom_test")
            self.assertEqual(saved["width"], 1920)
            self.assertEqual(saved["height"], 960)
            self.assertIn("buildableCount", saved)
            self.assertTrue((Path(directory) / "custom_custom_test.json").exists())
            self.assertIn("custom_custom_test", service.list())

    def test_save_uses_unique_ids_for_duplicate_names(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            service = MapFileService(Path(directory))

            first = service.save(_map_data("Custom Test"))
            second = service.save(_map_data("Custom Test"))

            self.assertEqual(first["id"], "custom_custom_test")
            self.assertEqual(second["id"], "custom_custom_test_2")


if __name__ == "__main__":
    unittest.main()
