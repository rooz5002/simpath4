# path_algorithms.py
MAP_TYPE = "GRID"

def heuristic(a, b):
    """Calculate the Manhattan distance between two points."""
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


def get_neighbors(cell, grid_size):
    """Get neighboring cells for the current cell."""
    x, y = cell
    neighbors = []
    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
        nx, ny = x + dx, y + dy
        if 0 <= nx < grid_size and 0 <= ny < grid_size:
            neighbors.append((nx, ny))
    return neighbors


def find_path(grid, start, goal):
    """
    A* Pathfinding Algorithm.
    :param grid: 2D list representing the grid (0 = free, 1 = obstacle).
    :param start: Tuple (x, y) of start position.
    :param goal: Tuple (x, y) of goal position.
    :return: List of tuples representing the path from start to goal.
    """
    import heapq
    open_set = []
    heapq.heappush(open_set, (0, start))
    came_from = {}
    g_score = {start: 0}
    f_score = {start: heuristic(start, goal)}

    while open_set:
        _, current = heapq.heappop(open_set)

        if current == goal:
            path = [current]  # Start from goal
            while current in came_from:
                current = came_from[current]
                path.append(current)
            path.reverse()  # Reverse to get path from start to goal
            return path

        for neighbor in get_neighbors(current, len(grid)):
            if grid[neighbor[0]][neighbor[1]] != 0:  # Skip static and moving obstacles
                continue

            tentative_g_score = g_score[current] + 1  # Assuming uniform cost
            if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                came_from[neighbor] = current
                g_score[neighbor] = tentative_g_score
                f_score[neighbor] = tentative_g_score + heuristic(neighbor, goal)
                heapq.heappush(open_set, (f_score[neighbor], neighbor))

    raise RuntimeError("No path found!")
