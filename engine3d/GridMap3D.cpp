#include "GridMap3D.h"
#include <random>
#include <ctime>
#include <cmath>

void GridMap3D::resize(int xs, int ys, int zs) {
    xs_ = xs; ys_ = ys; zs_ = zs;
    data_.assign(xs * ys * zs, 0);
}

void GridMap3D::generate_spheres(double density, int radius,
                                  int sx, int sy, int sz,
                                  int gx, int gy, int gz) {
    clear();
    std::mt19937 rng(static_cast<unsigned>(std::time(nullptr)));
    std::uniform_int_distribution<int> rx(0, xs_-1);
    std::uniform_int_distribution<int> ry(0, ys_-1);
    std::uniform_int_distribution<int> rz(0, zs_-1);

    double sphere_vol = (4.0/3.0) * 3.14159265 * std::pow(radius, 3);
    double total_vol  = (double)(xs_ * ys_ * zs_);
    int n_spheres = std::max(1, (int)(density * total_vol / std::max(sphere_vol, 1.0)));

    for (int s = 0; s < n_spheres; ++s) {
        int cx = rx(rng), cy = ry(rng), cz = rz(rng);
        for (int x = cx-radius; x <= cx+radius; ++x)
        for (int y = cy-radius; y <= cy+radius; ++y)
        for (int z = cz-radius; z <= cz+radius; ++z) {
            if (!in_bounds(x,y,z)) continue;
            double d2 = (double)((x-cx)*(x-cx)+(y-cy)*(y-cy)+(z-cz)*(z-cz));
            if (d2 > (double)(radius*radius)) continue;
            if (x==sx&&y==sy&&z==sz) continue;
            if (x==gx&&y==gy&&z==gz) continue;
            data_[idx(x,y,z)] = 1;
        }
    }
}

void GridMap3D::generate_random(double density,
                                 int sx, int sy, int sz,
                                 int gx, int gy, int gz) {
    std::mt19937 rng(static_cast<unsigned>(std::time(nullptr)));
    std::uniform_real_distribution<double> dist(0.0, 1.0);

    for (int x = 0; x < xs_; ++x)
        for (int y = 0; y < ys_; ++y)
            for (int z = 0; z < zs_; ++z) {
                // Keep start and goal clear
                if ((x==sx && y==sy && z==sz) || (x==gx && y==gy && z==gz)) {
                    data_[idx(x,y,z)] = 0;
                    continue;
                }
                data_[idx(x,y,z)] = (dist(rng) < density) ? 1 : 0;
            }
}
