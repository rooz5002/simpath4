'''
Wall-hugging path planner (boundary follower).

Uses Dijkstra with a wall-preference cost: cells that touch an obstacle
wall are preferred, so the resulting path naturally hugs boundaries.
Guaranteed to find a path whenever one exists.

By Amir Ali Mokhtarzadeh 2025
'''

MAP_TYPE = "GRID"

import heapq

DIRS = [(-1, 0), (0, 1), (1, 0), (0, -1)]   # up, right, down, left


def _is_free(grid, x, y):
    rows, cols = len(grid), len(grid[0])
    return 0 <= x < rows and 0 <= y < cols and grid[x][y] == 0


def _is_wall_adjacent(grid, x, y):
    """True if any of the 4 neighbours is an obstacle or out of bounds."""
    rows, cols = len(grid), len(grid[0])
    for dx, dy in DIRS:
        nx, ny = x + dx, y + dy
        if not (0 <= nx < rows and 0 <= ny < cols) or grid[nx][ny] != 0:
            return True
    return False


def find_path(grid, start, goal):
    if not _is_free(grid, *start):
        raise RuntimeError("Boundary: start position is blocked.")
    if not _is_free(grid, *goal):
        raise RuntimeError("Boundary: goal position is blocked.")

    # Dijkstra with wall-preference cost:
    #   wall-adjacent cells cost 1, open cells cost 3
    # This makes the path hug walls while remaining complete.
    INF = float('inf')
    dist = {start: 0}
    came_from = {start: None}
    pq = [(0, start)]

    while pq:
        d, (x, y) = heapq.heappop(pq)

        if (x, y) == goal:
            path = []
            cur = goal
            while cur is not None:
                path.append(cur)
                cur = came_from[cur]
            return path[::-1]

        if d > dist.get((x, y), INF):
            continue   # stale entry

        for dx, dy in DIRS:
            nx, ny = x + dx, y + dy
            if not _is_free(grid, nx, ny):
                continue
            step = 1 if _is_wall_adjacent(grid, nx, ny) else 3
            nd = d + step
            if nd < dist.get((nx, ny), INF):
                dist[(nx, ny)] = nd
                came_from[(nx, ny)] = (x, y)
                heapq.heappush(pq, (nd, (nx, ny)))

    raise RuntimeError(
        "Boundary: goal is not reachable from start. "
        "Check that start and goal are not isolated by obstacles."
    )
