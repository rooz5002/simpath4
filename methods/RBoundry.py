MAP_TYPE = "GRID"


class BoundaryFollower:
    def __init__(self, follow_right=True):
        """
        Initialize the boundary follower.
        :param follow_right: If True, follow the right boundary. If False, follow the left boundary.
        """
        self.follow_right = follow_right

    def find_path(self, grid, start, goal):
        """
        Find a path from start to goal by following the boundary.
        :param grid: 2D list representing the environment (0 = free, 1 = obstacle).
        :param start: Tuple (x, y) representing the start position.
        :param goal: Tuple (x, y) representing the goal position.
        :return: List of tuples representing the path from start to goal.
        """
        if not self.is_valid(grid, start) or not self.is_valid(grid, goal):
            print("Error: Start or goal position is invalid.")
            return None

        path = [start]
        current = start
        visited = set()

        # Define the initial direction based on the boundary-following rule
        if self.follow_right:
            # Start by moving right (+x direction)
            dx, dy = 1, 0
        else:
            # Start by moving left (-x direction)
            dx, dy = -1, 0

        while current != goal:
            visited.add(current)
            next_move = self.get_next_move(grid, current, dx, dy, visited)
            if next_move is None:
                # Dead end detected: backtrack to the previous position
                if len(path) <= 1:
                    print("Error: No valid path found. Robot is stuck.")
                    return None  # No path found
                else:
                    # Backtrack
                    path.pop()
                    current = path[-1]
                    dx, dy = self.update_direction(grid, current, dx, dy)
                    continue

            path.append(next_move)
            current = next_move

            # Update the direction based on the boundary-following rule
            dx, dy = self.update_direction(grid, current, dx, dy)

            # Stop if stuck in a loop
            if len(path) > len(grid) * len(grid[0]):
                print("Error: Robot is stuck in a loop.")
                return None

        return path

    def get_next_move(self, grid, current, dx, dy, visited):
        """
        Get the next move based on the current direction and boundary-following rule.
        :param grid: 2D list representing the environment.
        :param current: Tuple (x, y) representing the current position.
        :param dx: Current x-direction.
        :param dy: Current y-direction.
        :param visited: Set of visited positions.
        :return: Tuple (x, y) representing the next move.
        """
        x, y = current
        nx, ny = x + dx, y + dy

        if self.is_valid(grid, (nx, ny)) and (nx, ny) not in visited:
            return (nx, ny)
        else:
            # If the front is blocked, check neighboring cells
            return self.check_neighbors(grid, current, dx, dy, visited)

    def check_neighbors(self, grid, current, dx, dy, visited):
        """
        Check neighboring cells to the right or left based on the boundary-following rule.
        :param grid: 2D list representing the environment.
        :param current: Tuple (x, y) representing the current position.
        :param dx: Current x-direction.
        :param dy: Current y-direction.
        :param visited: Set of visited positions.
        :return: Tuple (x, y) representing the next move.
        """
        x, y = current

        if self.follow_right:
            # Right-hand rule: Check right, then forward, then left, then backward
            directions = [(dy, -dx), (dx, dy), (-dy, dx), (-dx, -dy)]
        else:
            # Left-hand rule: Check left, then forward, then right, then backward
            directions = [(-dy, dx), (dx, dy), (dy, -dx), (-dx, -dy)]

        for ddx, ddy in directions:
            nx, ny = x + ddx, y + ddy
            if self.is_valid(grid, (nx, ny)) and (nx, ny) not in visited:
                return (nx, ny)

        return None  # No valid move found

    def update_direction(self, grid, current, dx, dy):
        """
        Update the direction based on the boundary-following rule.
        :param grid: 2D list representing the environment.
        :param current: Tuple (x, y) representing the current position.
        :param dx: Current x-direction.
        :param dy: Current y-direction.
        :return: Updated direction (dx, dy).
        """
        x, y = current

        if self.follow_right:
            # Right-hand rule: Turn right if possible
            directions = [(1, 0), (0, 1), (-1, 0), (0, -1)]
        else:
            # Left-hand rule: Turn left if possible
            directions = [(-1, 0), (0, 1), (1, 0), (0, -1)]

        # Find the current direction index
        idx = directions.index((dx, dy))

        # Try turning right (for right-hand rule) or left (for left-hand rule)
        for i in range(4):
            new_dx, new_dy = directions[(idx + i) % 4]
            nx, ny = x + new_dx, y + new_dy
            if self.is_valid(grid, (nx, ny)):
                return new_dx, new_dy

        return dx, dy  # Keep the current direction if no turn is possible

    def is_valid(self, grid, pos):
        """
        Check if a position is valid (within bounds and not an obstacle).
        :param grid: 2D list representing the environment.
        :param pos: Tuple (x, y) representing the position.
        :return: True if the position is valid, False otherwise.
        """
        x, y = pos
        if x < 0 or y < 0 or x >= len(grid) or y >= len(grid[0]):
            return False
        return grid[x][y] == 0  # grid[x][y] matches main program convention

# Example usage
if __name__ == "__main__":
    grid = [
        [0, 0, 1, 0, 0],
        [0, 0, 1, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
    ]
    start = (0, 0)
    goal = (4, 4)

    # Follow the right boundary
    follower = BoundaryFollower(follow_right=True)
    path = follower.find_path(grid, start, goal)

    if path:
        print("Path found (right boundary):", path)
    else:
        print("No path found (right boundary).")

    # Follow the left boundary
    follower = BoundaryFollower(follow_right=False)
    path = follower.find_path(grid, start, goal)

    if path:
        print("Path found (left boundary):", path)
    else:
        print("No path found (left boundary).")


def find_path(grid, start, goal):
    follower = BoundaryFollower(follow_right=True)
    path = follower.find_path(grid, start, goal)
    if path:
        return path
    raise RuntimeError("RBoundry: No path found.")
