"""Nondeterministic grid movement via a backward Dijkstra distance field.

When towers change, the Navigator runs one Dijkstra *per active team* backward
from each team's base, producing a cost-to-goal map for every walkable tile.

At each tile arrival, an enemy calls next_tile() which:
  1. Looks up the distance-to-goal for each walkable neighbour.
  2. Adds the per-cell threat cost so heavily-defended ground is penalised.
  3. Runs softmax over those costs to build a probability distribution.
  4. Samples one neighbour at random.

Because enemies re-decide at every tile they naturally spread across the map,
avoid choke-points under fire, and take genuinely different routes each time.
"""

from __future__ import annotations

import heapq
import math
import random

from backend.app.domain.models import MapDefinition, Tile, TowerDefinition, NEIGHBOR_OFFSETS


# How strongly tower DPS inflates a cell's traversal cost.
THREAT_WEIGHT = 0.04

# Softmax temperature for per-tile step selection.
# At T=0.5: a neighbour 2 tiles worse than optimal gets e^(-4) ≈ 1.8% weight →
# near-zero backtracking; neighbours equidistant to goal share probability evenly
# so vehicles spread naturally at real junctions without wandering in circles.
STEP_TEMPERATURE = 0.5
PROGRESS_EPSILON = 1e-9


class Navigator:
    """Maintains a threat-weighted distance-to-goal field per active team."""

    def __init__(self, map_definition: MapDefinition) -> None:
        self._map = map_definition
        self._threat: dict[Tile, float] = {}
        self._dist: dict[str, dict[Tile, float]] = {}
        self._rng = random.Random()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def rebuild(
        self,
        towers: list,
        tower_defs,
        active_targets: set[str],
    ) -> None:
        """Recompute threat map and distance fields from current tower layout."""
        occupied = frozenset(tower.tile for tower in towers)
        self._threat = self._compute_threat(towers, tower_defs)
        self._dist = {}

        for team in active_targets:
            self._dist[team] = self._backward_dist(team, occupied)

    def next_tile(
        self,
        current: Tile,
        target: str,
        occupied: frozenset[Tile],
    ) -> Tile | None:
        """Probabilistically pick the next tile toward *target*'s base.

        Cheaper (shorter + less-threatened) neighbours receive higher weight;
        the softmax temperature controls how much randomness is injected.
        """
        dist = self._dist.get(target, {})
        current_dist = dist.get(current, math.inf)
        candidates: list[tuple[Tile, float]] = []

        for neighbor in self._map.neighbors(current, target, occupied):
            d = dist.get(neighbor)
            if d is not None:
                if d >= current_dist - PROGRESS_EPSILON:
                    continue

                # Cost: entering neighbour + remaining path from neighbour to goal.
                candidates.append((neighbor, self._cell_cost(neighbor) + d))

        if not candidates:
            return None
        if len(candidates) == 1:
            return candidates[0][0]

        tiles  = [t for t, _ in candidates]
        costs  = [c for _, c in candidates]
        probs  = self._softmax(costs)
        return self._rng.choices(tiles, weights=probs)[0]

    def is_reachable(self, occupied: frozenset[Tile], active_targets: set[str]) -> bool:
        """Return True when every active spawn can reach its target base."""
        for spawn in self._map.spawns:
            if spawn.target not in active_targets:
                continue

            base = self._map.base_tile(spawn.target)
            if base is None:
                continue

            if not self._connected(spawn.tile, base, spawn.target, occupied):
                return False

        return True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _backward_dist(self, target: str, occupied: frozenset[Tile]) -> dict[Tile, float]:
        """Dijkstra from the goal backward: dist[tile] = min cost to reach goal.

        Cost model: entering a tile costs cell_cost(tile).  The start tile is
        not charged, so dist[goal] = 0 and dist[N] = cell_cost(goal) for any
        direct neighbour N of goal.
        """
        goal = self._map.base_tile(target)
        if goal is None:
            return {}

        dist: dict[Tile, float] = {goal: 0.0}
        heap: list[tuple[float, int, Tile]] = [(0.0, 0, goal)]
        counter = 1

        while heap:
            d, _, tile = heapq.heappop(heap)

            if d > dist.get(tile, math.inf):
                continue

            # In the backward direction, for each neighbour N of tile:
            # cost(N → goal) through tile = cell_cost(tile) + dist[tile]
            tile_cost = self._cell_cost(tile)

            for dx, dy in NEIGHBOR_OFFSETS:
                neighbor = Tile(tile.x + dx, tile.y + dy)

                if not self._map.walkable(neighbor, target, occupied):
                    continue

                tentative = d + tile_cost

                if tentative < dist.get(neighbor, math.inf):
                    dist[neighbor] = tentative
                    heapq.heappush(heap, (tentative, counter, neighbor))
                    counter += 1

        return dist

    def _connected(
        self,
        start: Tile,
        goal: Tile,
        target: str,
        occupied: frozenset[Tile],
    ) -> bool:
        frontier = [start]
        visited = {start}

        while frontier:
            current = frontier.pop()
            if current == goal:
                return True
            for neighbor in self._map.neighbors(current, target, occupied):
                if neighbor not in visited:
                    visited.add(neighbor)
                    frontier.append(neighbor)

        return False

    def _cell_cost(self, tile: Tile) -> float:
        return 1.0 + THREAT_WEIGHT * self._threat.get(tile, 0.0)

    def _softmax(self, costs: list[float]) -> list[float]:
        cheapest = min(costs)
        weights = [math.exp(-(c - cheapest) / STEP_TEMPERATURE) for c in costs]
        total = sum(weights)
        return [w / total for w in weights]

    def _compute_threat(self, towers: list, tower_defs) -> dict[Tile, float]:
        threat: dict[Tile, float] = {}

        for tower in towers:
            definition: TowerDefinition = tower_defs.get(tower.kind)
            attack_range = definition.get_range(tower.level)
            dps = definition.get_dps(tower.level)

            if dps <= 0 or attack_range <= 0:
                continue

            center_x = tower.tile.x + 0.5
            center_y = tower.tile.y + 0.5
            span = int(math.ceil(attack_range))

            for dy in range(-span, span + 1):
                for dx in range(-span, span + 1):
                    tile = Tile(tower.tile.x + dx, tower.tile.y + dy)

                    if not self._map.in_bounds(tile):
                        continue

                    distance = math.hypot(
                        (tile.x + 0.5) - center_x,
                        (tile.y + 0.5) - center_y,
                    )

                    if distance <= attack_range:
                        threat[tile] = threat.get(tile, 0.0) + dps

        return threat
