#pragma once

#include <vector>
#include <stdexcept>

/**
 * 2-D grid map.
 *
 * Convention: grid[x][y]  where x is the column (horizontal) and y is the row.
 * This matches the existing Python methods/ convention used by simpath3.
 *
 * Cell values:
 *   0  — free
 *   1  — static obstacle
 *   2  — moving obstacle / human
 */
class GridMap {
public:
    GridMap() = default;
    GridMap(int rows, int cols);

    void resize(int rows, int cols);
    void set_cell(int x, int y, int value);
    int  get_cell(int x, int y) const;

    int rows() const { return rows_; }
    int cols() const { return cols_; }

    /** Raw grid as a 2-D vector grid[x][y]. Passed directly to Python. */
    const std::vector<std::vector<int>>& data() const { return grid_; }
    std::vector<std::vector<int>>&       data()       { return grid_; }

private:
    void check_bounds(int x, int y) const;

    int rows_{0};
    int cols_{0};
    std::vector<std::vector<int>> grid_;   // grid_[x][y]
};
