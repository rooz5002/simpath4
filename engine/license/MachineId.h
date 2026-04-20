#pragma once
#include <string>

namespace license {

/**
 * Returns a stable 64-hex-char machine fingerprint.
 * Linux: SHA-256 of /etc/machine-id
 * Fallback: SHA-256 of hostname
 */
std::string get_machine_id();

} // namespace license
