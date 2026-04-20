#include "GridMap.h"

GridMap::GridMap(int rows, int cols) {
    resize(rows, cols);
}

void GridMap::resize(int rows, int cols) {
    rows_ = rows;
    cols_ = cols;
    grid_.assign(rows, std::vector<int>(cols, 0));
}

void GridMap::set_cell(int x, int y, int value) {
    check_bounds(x, y);
    grid_[x][y] = value;
}

int GridMap::get_cell(int x, int y) const {
    check_bounds(x, y);
    return grid_[x][y];
}

void GridMap::check_bounds(int x, int y) const {
    if (x < 0 || x >= rows_ || y < 0 || y >= cols_)
        throw std::out_of_range("GridMap: cell (" + std::to_string(x) + "," +
                                std::to_string(y) + ") out of bounds (" +
                                std::to_string(rows_) + "×" +
                                std::to_string(cols_) + ")");
}
