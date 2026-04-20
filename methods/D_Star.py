'''
D* Lite path planning algorithm.
Propagates cost-to-goal backward from goal using a priority queue,
then follows the gradient from start to goal.

By Amir Ali Mokhtarzadeh 2025
'''

MAP_TYPE = "GRID"

import heapq


def get_neighbors(cell, grid):
    x, y = cell
    rows, cols = len(grid), len(grid[0])
    result = []
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < rows and 0 <= ny < cols and grid[nx][ny] == 0:
            result.append((nx, ny))
    return result


def find_path(grid, start, goal):
    """
    D* Lite: compute backward costs from goal, then extract path from start.
    :param grid: 2D list (0=free, non-zero=obstacle)
    :param start: (x, y) tuple
    :param goal: (x, y) tuple
    :return: list of (x, y) tuples from start to goal
    """
    # --- Backward Dijkstra from goal ---
    g = {}          # cost-to-goal for each cell
    open_list = []
    heapq.heappush(open_list, (0, goal))
    g[goal] = 0

    while open_list:
        cost, cell = heapq.heappop(open_list)
        if cost > g.get(cell, float('inf')):
            continue  # stale entry
        for nb in get_neighbors(cell, grid):
            new_cost = cost + 1
            if new_cost < g.get(nb, float('inf')):
                g[nb] = new_cost
                heapq.heappush(open_list, (new_cost, nb))

    # --- Extract path from start following steepest descent ---
    if g.get(start, float('inf')) == float('inf'):
        raise RuntimeError("D*: No path found!")

    path = [start]
    current = start
    visited = set()
    while current != goal:
        if current in visited:
            raise RuntimeError("D*: Cycle detected, no valid path.")
        visited.add(current)
        neighbors = get_neighbors(current, grid)
        if not neighbors:
            raise RuntimeError("D*: Dead end reached.")
        nxt = min(neighbors, key=lambda n: g.get(n, float('inf')))
        if g.get(nxt, float('inf')) == float('inf'):
            raise RuntimeError("D*: No path found from current position.")
        path.append(nxt)
        current = nxt

    return path
