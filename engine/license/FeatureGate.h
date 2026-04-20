#pragma once
#include "LicenseManager.h"
#include <string>
#include <stdexcept>

namespace license {

/**
 * Maps features to the minimum tier required.
 * All engine code checks the gate before executing.
 *
 * Tier requirements (Phase 2):
 *   TRIAL    — core planning (A*, D*), grid ≤ 50×50
 *   BASIC    — all current algorithms, unlimited grid
 *   RESEARCH — data export, path comparison, multi-run stats
 *   ML       — ML-based planners (dl_augmented_a_star)
 *   ROS2     — ROS2 bridge, real-time navigation
 *   FULL     — everything
 */
class FeatureGate {
public:
    explicit FeatureGate(const LicenseResult& license);

    /** Update the active license (e.g. after user activates a key). */
    void set_license(const LicenseResult& license);

    const LicenseResult& current() const { return license_; }

    /**
     * Check if a feature is available.
     * Throws std::runtime_error with a user-readable message if not.
     */
    void require(Tier min_tier, const std::string& feature_name) const;

    /** Silent check — returns false instead of throwing. */
    bool allows(Tier min_tier) const;

    // ── Named feature checks ─────────────────────────────────────────────────
    void require_planning()     const;  // TRIAL
    void require_full_grid(int rows, int cols) const;  // BASIC for >50×50
    void require_ml()           const;  // ML
    void require_ros2()         const;  // ROS2
    void require_data_export()  const;  // RESEARCH

private:
    LicenseResult license_;
};

} // namespace license
