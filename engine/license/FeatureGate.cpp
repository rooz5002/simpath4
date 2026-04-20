#include "FeatureGate.h"

namespace license {

FeatureGate::FeatureGate(const LicenseResult& license)
    : license_(license) {}

void FeatureGate::set_license(const LicenseResult& license) {
    license_ = license;
}

bool FeatureGate::allows(Tier min_tier) const {
    return license_.valid && static_cast<int>(license_.tier) >= static_cast<int>(min_tier);
}

void FeatureGate::require(Tier min_tier, const std::string& feature_name) const {
    if (!license_.valid) {
        throw std::runtime_error(
            "License required to use " + feature_name +
            ". Current status: " + license_.message);
    }
    if (!allows(min_tier)) {
        throw std::runtime_error(
            feature_name + " requires " + tier_to_string(min_tier) +
            " license or higher. Current tier: " + tier_to_string(license_.tier));
    }
}

void FeatureGate::require_planning() const {
    require(Tier::TRIAL, "path planning");
}

void FeatureGate::require_full_grid(int rows, int cols) const {
    constexpr int TRIAL_MAX = 50;
    if (rows > TRIAL_MAX || cols > TRIAL_MAX) {
        require(Tier::BASIC, "grid larger than " +
                std::to_string(TRIAL_MAX) + "×" + std::to_string(TRIAL_MAX));
    }
}

void FeatureGate::require_ml() const {
    require(Tier::ML, "ML-based planners");
}

void FeatureGate::require_ros2() const {
    require(Tier::ROS2, "ROS2 integration");
}

void FeatureGate::require_data_export() const {
    require(Tier::RESEARCH, "data export");
}

} // namespace license
