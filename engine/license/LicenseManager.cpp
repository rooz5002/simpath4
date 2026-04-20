#include "LicenseManager.h"
#include "MachineId.h"

#include <openssl/hmac.h>
#include <openssl/evp.h>

#include <algorithm>
#include <chrono>
#include <ctime>
#include <filesystem>
#include <fstream>
#include <iomanip>
#include <iostream>
#include <sstream>
#include <stdexcept>
#include <vector>

namespace fs = std::filesystem;

namespace license {

// ── Tier helpers ──────────────────────────────────────────────────────────────

Tier tier_from_string(const std::string& s) {
    if (s == "TRIAL")    return Tier::TRIAL;
    if (s == "BASIC")    return Tier::BASIC;
    if (s == "RESEARCH") return Tier::RESEARCH;
    if (s == "ML")       return Tier::ML;
    if (s == "ROS2")     return Tier::ROS2;
    if (s == "FULL")     return Tier::FULL;
    return Tier::NONE;
}

std::string tier_to_string(Tier t) {
    switch (t) {
        case Tier::TRIAL:    return "TRIAL";
        case Tier::BASIC:    return "BASIC";
        case Tier::RESEARCH: return "RESEARCH";
        case Tier::ML:       return "ML";
        case Tier::ROS2:     return "ROS2";
        case Tier::FULL:     return "FULL";
        default:             return "NONE";
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

static std::string to_upper(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(), ::toupper);
    return s;
}

static std::string trim(const std::string& s) {
    size_t a = s.find_first_not_of(" \t\r\n");
    size_t b = s.find_last_not_of(" \t\r\n");
    return (a == std::string::npos) ? "" : s.substr(a, b - a + 1);
}

static std::vector<std::string> split(const std::string& s, char delim) {
    std::vector<std::string> parts;
    std::stringstream ss(s);
    std::string tok;
    while (std::getline(ss, tok, delim)) parts.push_back(tok);
    return parts;
}

static bool valid_date(const std::string& s) {
    if (s.size() != 8) return false;
    for (char c : s) if (!std::isdigit(c)) return false;
    return true;
}

// ── LicenseManager ────────────────────────────────────────────────────────────

LicenseManager::LicenseManager(const std::string& app_id,
                               const std::string& hmac_secret,
                               int trial_days)
    : app_id_(to_upper(app_id))
    , secret_(hmac_secret)
    , trial_days_(trial_days) {
    const char* home = std::getenv("HOME");
    cache_dir_ = std::string(home ? home : "/tmp") +
                 "/.cache/" + app_id;
}

// ── HMAC ──────────────────────────────────────────────────────────────────────

std::string LicenseManager::compute_hmac(const std::string& tier,
                                          const std::string& date_str,
                                          const std::string& machine_id) const {
    std::string msg = app_id_ + ":" + tier + ":" + date_str + ":" + machine_id;

    unsigned char digest[EVP_MAX_MD_SIZE];
    unsigned int  dlen = 0;
    HMAC(EVP_sha256(),
         secret_.data(), (int)secret_.size(),
         (const unsigned char*)msg.data(), (int)msg.size(),
         digest, &dlen);

    std::ostringstream oss;
    for (unsigned int i = 0; i < dlen; ++i)
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)digest[i];

    std::string hex = oss.str();
    std::transform(hex.begin(), hex.end(), hex.begin(), ::toupper);
    return hex.substr(0, 12);  // first 12 hex chars — matches Python/TS
}

// ── validate ─────────────────────────────────────────────────────────────────

LicenseResult LicenseManager::validate(const std::string& raw_key) const {
    std::string key = to_upper(trim(raw_key));
    auto parts = split(key, '-');

    if (parts.size() != 4)
        return { false, Tier::NONE, "", false,
                 "Invalid key format (expected APP-TIER-DATE-HMAC)" };

    const std::string& app_id   = parts[0];
    const std::string& tier_str = parts[1];
    const std::string& date_str = parts[2];
    const std::string& key_hmac = parts[3];

    if (app_id != app_id_)
        return { false, Tier::NONE, "", false,
                 "Key is for '" + app_id + "', not '" + app_id_ + "'" };

    Tier tier = tier_from_string(tier_str);
    if (tier == Tier::NONE)
        return { false, Tier::NONE, "", false, "Unknown tier: " + tier_str };

    if (!valid_date(date_str))
        return { false, Tier::NONE, "", false, "Invalid date in key" };

    // Try universal key first (machine_id = ""), then machine-bound
    for (bool bound : { false, true }) {
        std::string mid = bound ? get_machine_id() : "";
        std::string expected = compute_hmac(tier_str, date_str, mid);
        if (key_hmac == expected) {
            LicenseResult r;
            r.valid         = true;
            r.tier          = tier;
            r.issued_date   = date_str;
            r.machine_bound = bound;
            r.message       = "Valid " + tier_str + " license";
            return r;
        }
    }

    return { false, Tier::NONE, date_str, false,
             "HMAC verification failed — key is invalid or tampered" };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

LicenseResult LicenseManager::load_cached() const {
    std::string path = cache_dir_ + "/license.key";
    std::ifstream f(path);
    if (!f) return { false, Tier::NONE, "", false, "No cached key" };
    std::string key;
    std::getline(f, key);
    return validate(trim(key));
}

void LicenseManager::save_cache(const std::string& key) const {
    try {
        fs::create_directories(cache_dir_);
        std::ofstream f(cache_dir_ + "/license.key");
        f << trim(key) << "\n";
    } catch (...) {}
}

// ── Trial ─────────────────────────────────────────────────────────────────────

LicenseResult LicenseManager::trial_status() const {
    std::string stamp_path = cache_dir_ + "/first_run.txt";
    try {
        fs::create_directories(cache_dir_);

        long long first_run = 0;
        std::ifstream f(stamp_path);
        if (f) {
            f >> first_run;
        } else {
            first_run = std::chrono::duration_cast<std::chrono::seconds>(
                std::chrono::system_clock::now().time_since_epoch()).count();
            std::ofstream o(stamp_path);
            o << first_run;
        }

        long long now = std::chrono::duration_cast<std::chrono::seconds>(
            std::chrono::system_clock::now().time_since_epoch()).count();
        int elapsed_days = (int)((now - first_run) / 86400);
        int remaining    = trial_days_ - elapsed_days;

        if (remaining > 0) {
            return { true, Tier::TRIAL, "", false,
                     "Trial: " + std::to_string(remaining) + " day(s) remaining" };
        }
        return { false, Tier::NONE, "", false, "Trial period expired" };
    } catch (...) {
        return { true, Tier::TRIAL, "", false, "Trial mode" };
    }
}

// ── startup_check ─────────────────────────────────────────────────────────────

LicenseResult LicenseManager::startup_check() const {
    LicenseResult cached = load_cached();
    if (cached.valid) {
        std::cout << "[License] " << cached.message << "\n";
        return cached;
    }
    LicenseResult trial = trial_status();
    std::cout << "[License] " << trial.message << "\n";
    return trial;
}

// ── generate_key ─────────────────────────────────────────────────────────────

std::string LicenseManager::generate_key(const std::string& tier,
                                          const std::string& date_str,
                                          const std::string& machine_id) const {
    std::string t = to_upper(tier);
    std::string h = compute_hmac(t, date_str, machine_id);
    return app_id_ + "-" + t + "-" + date_str + "-" + h;
}

} // namespace license
