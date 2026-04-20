#pragma once
#include <vector>

/**
 * 3-D voxel grid for a hovering robot environment.
 *
 * Indexing: data[x][y][z] — x=width, y=depth, z=height (altitude).
 * Value: 0 = free, 1 = obstacle.
 */
class GridMap3D {
public:
    GridMap3D() : xs_(0), ys_(0), zs_(0) {}

    void resize(int xs, int ys, int zs);

    int  get(int x, int y, int z) const { return data_[idx(x,y,z)]; }
    void set(int x, int y, int z, int v) { data_[idx(x,y,z)] = v; }

    /** Fill random box obstacles; density in [0,1]. Leaves start/goal free. */
    void generate_random(double density, int sx, int sy, int sz,
                                        int gx, int gy, int gz);

    /** Fill random sphere obstacles; density in [0,1], radius in voxels. */
    void generate_spheres(double density, int radius,
                          int sx, int sy, int sz,
                          int gx, int gy, int gz);

    /** Clear all obstacles. */
    void clear() { data_.assign(xs_*ys_*zs_, 0); }

    int xs() const { return xs_; }
    int ys() const { return ys_; }
    int zs() const { return zs_; }

    bool in_bounds(int x, int y, int z) const {
        return x>=0 && x<xs_ && y>=0 && y<ys_ && z>=0 && z<zs_;
    }

private:
    int idx(int x, int y, int z) const { return x*ys_*zs_ + y*zs_ + z; }

    int xs_, ys_, zs_;
    std::vector<int> data_;
};
