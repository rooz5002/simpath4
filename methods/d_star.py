'''
D* Lite path planning algorithm (simplified).
Uses backward Dijkstra from goal to compute cost-to-goal,
then extracts the path by following the gradient from start.

Supports dynamic replanning via update_obstacle() after initial path is found.

By Amir Ali Mokhtarzadeh 2025
'''

MAP_TYPE = "GRID"

import heapq


class DStarLite:
    def __init__(self, grid, start, goal):
        self.grid = grid
        self.start = start
        self.goal = goal
        self.g = {}       # cost-to-goal from each cell

    def get_neighbors(self, cell, last=None):
        x, y = cell
        result = []
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            nx, ny = x + dx, y + dy
            if (0 <= nx < len(self.grid) and 0 <= ny < len(self.grid[0])
                    and self.grid[nx][ny] == 0):
                if last and (nx, ny) == last:
                    continue
                result.append((nx, ny))
        return result

    def initialize(self):
        """Compute backward costs from goal using Dijkstra."""
        self.g = {}
        open_set = []
        heapq.heappush(open_set, (0, self.goal))
        self.g[self.goal] = 0

        while open_set:
            cost, cell = heapq.heappop(open_set)
            if cost > self.g.get(cell, float('inf')):
                continue  # stale entry
            for nb in self.get_neighbors(cell):
                new_cost = cost + 1
                if new_cost < self.g.get(nb, float('inf')):
                    self.g[nb] = new_cost
                    heapq.heappush(open_set, (new_cost, nb))

    def update_cell(self, x, y, value):
        """Update grid cell and recompute costs."""
        self.grid[x][y] = value
        self.initialize()

    def find_path(self):
        """Extract path from start to goal following cost gradient."""
        if self.g.get(self.start, float('inf')) == float('inf'):
            raise RuntimeError("No valid path found")

        path = [self.start]
        current = self.start
        visited = set()

        while current != self.goal:
            if current in visited:
                raise RuntimeError("No valid path found (cycle detected)")
            visited.add(current)
            neighbors = self.get_neighbors(current)
            if not neighbors:
                raise RuntimeError("No valid path found (dead end)")
            nxt = min(neighbors, key=lambda n: self.g.get(n, float('inf')))
            if self.g.get(nxt, float('inf')) == float('inf'):
                raise RuntimeError("No valid path found")
            path.append(nxt)
            current = nxt

        return path

    def heuristic(self, node):
        x1, y1 = node
        x2, y2 = self.goal
        return abs(x1 - x2) + abs(y1 - y2)


def find_path(grid, start, goal):
    planner = DStarLite(grid, start, goal)
    planner.initialize()
    return planner.find_path()
