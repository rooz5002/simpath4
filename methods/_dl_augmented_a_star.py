import numpy as np
import heapq
import tensorflow as tf
from tensorflow.keras.models import load_model

class DeepLearningAugmentedAStar:
    def __init__(self, grid, start, goal, model_path):
        """
        Initialize the Augmented A* with Deep Learning.
        :param grid: The navigation grid.
        :param start: Start position (x, y).
        :param goal: Goal position (x, y).
        :param model_path: Path to the trained FCN model.
        """
        self.grid = grid
        self.start = start
        self.goal = goal
        self.model = self.load_fcn_model(model_path)
        self.grid_size = len(grid)

    def load_fcn_model(self, model_path):
        """Loads the trained FCN model."""
        try:
            return load_model(model_path)
        except Exception as e:
            print(f"Error loading model: {e}")
            return None

    def heuristic(self, node):
        """
        Predict cost-to-goal using the FCN model.
        :param node: (x, y) position.
        :return: Predicted cost.
        """
        if self.model is None:
            return abs(node[0] - self.goal[0]) + abs(node[1] - self.goal[1])  # Default heuristic if model fails

        # Normalize grid values
        grid_input = np.array(self.grid, dtype=np.float32)
        grid_input = grid_input / np.max(grid_input) if np.max(grid_input) > 0 else grid_input
        grid_input = np.expand_dims(grid_input, axis=[0, -1])  # Reshape for model input

        predicted_cost = self.model.predict(grid_input, verbose=0)

        # Ensure predicted_cost is a scalar (not an array)
        if isinstance(predicted_cost, np.ndarray) and predicted_cost.shape == (1,):
            return predicted_cost[0]  # Extract scalar value

        return float(predicted_cost)  # Ensure it returns a float


    def find_path(self):
        """
        Run the Augmented A* algorithm with deep learning.
        :return: Path from start to goal as a list of (x, y) tuples.
        """
        open_set = []
        heapq.heappush(open_set, (0, self.start))  # Priority queue with (f_score, node)
        came_from = {}
        g_score = {self.start: 0}
        f_score = {self.start: self.heuristic(self.start)}

        while open_set:
            _, current = heapq.heappop(open_set)

            if current == self.goal:
                return self.reconstruct_path(came_from)

            for neighbor in self.get_neighbors(current):
                tentative_g_score = g_score[current] + 1  # Uniform movement cost
                if neighbor not in g_score or tentative_g_score < g_score[neighbor]:
                    came_from[neighbor] = current
                    g_score[neighbor] = tentative_g_score
                    f_score[neighbor] = g_score[neighbor] + self.heuristic(neighbor)
                    heapq.heappush(open_set, (f_score[neighbor], neighbor))

        return []  # No path found

    def get_neighbors(self, cell):
        """Return walkable neighbors of a cell."""
        x, y = cell
        directions = [(-1, 0), (1, 0), (0, -1), (0, 1)]  # Up, Down, Left, Right
        neighbors = []

        for dx, dy in directions:
            nx, ny = x + dx, y + dy
            if 0 <= nx < self.grid_size and 0 <= ny < self.grid_size and self.grid[nx][ny] == 0:
                neighbors.append((nx, ny))

        return neighbors

    def reconstruct_path(self, came_from):
        """
        Reconstructs the path from the start to the goal.
        :param came_from: Dictionary mapping nodes to their predecessors.
        """
        current = self.goal
        path = [self.start]  # Ensure the start cell is included

        while current in came_from:
            path.append(current)
            current = came_from[current]

        path.reverse()  # Ensure the path order is correct
        return path

def find_path(grid, start, goal):
    planner = DeepLearningAugmentedAStar(grid, start, goal, "DL_augmented_a_star/models")
    return planner.find_path()
