#pragma once
#include <string>

namespace license {

/**
 * License tiers — ordered by capability.
 * A higher tier includes all features of lower tiers.
 */
enum class Tier : int {
    NONE     = -1,
    TRIAL    =  0,
    BASIC    =  1,
    RESEARCH =  2,
    ML       =  3,
    ROS2     =  4,
    FULL     =  5,
};

Tier        tier_from_string(const std::string& s);
std::string tier_to_string(Tier t);

struct LicenseResult {
    bool        valid        = false;
    Tier        tier         = Tier::NONE;
    std::string issued_date;        // "YYYYMMDD"
    bool        machine_bound = false;
    std::string message;
};

/**
 * Validates SIMPATH4 license keys.
 *
 * Key format:  {APP_ID}-{TIER}-{YYYYMMDD}-{HMAC12}
 * HMAC input:  "{APP_ID}:{TIER}:{YYYYMMDD}:{MACHINE_ID}"
 * Universal keys use "" for MACHINE_ID.
 *
 * The secret must match the one used to generate keys
 * (same secret as in LicenseManager.ts and license_check.py).
 */
class LicenseManager {
public:
    LicenseManager(const std::string& app_id,
                   const std::string& hmac_secret,
                   int trial_days = 30);

    /** Validate a key string. */
    LicenseResult validate(const std::string& key) const;

    /** Load key from cache file (~/.cache/{app_id}/license.key). */
    LicenseResult load_cached() const;

    /** Save a validated key to the cache file. */
    void save_cache(const std::string& key) const;

    /** Return TRIAL result with remaining days, or NONE if expired. */
    LicenseResult trial_status() const;

    /**
     * Full startup check:
     *   1. Try cached key
     *   2. Fall back to trial
     * Never returns NONE — always returns something the FeatureGate can act on.
     */
    LicenseResult startup_check() const;

    /** Generate a key (use from your key-issuing tool, not from the end-user binary). */
    std::string generate_key(const std::string& tier,
                             const std::string& date_str,
                             const std::string& machine_id = "") const;

private:
    std::string compute_hmac(const std::string& tier,
                             const std::string& date_str,
                             const std::string& machine_id) const;

    std::string app_id_;
    std::string secret_;
    int         trial_days_;
    std::string cache_dir_;
};

} // namespace license
