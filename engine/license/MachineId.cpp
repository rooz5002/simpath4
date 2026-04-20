#include "MachineId.h"
#include <openssl/evp.h>
#include <fstream>
#include <sstream>
#include <iomanip>
#include <unistd.h>

namespace license {

static std::string sha256_hex(const std::string& input) {
    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int  len = 0;
    EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr);
    EVP_DigestUpdate(ctx, input.data(), input.size());
    EVP_DigestFinal_ex(ctx, hash, &len);
    EVP_MD_CTX_free(ctx);
    std::ostringstream oss;
    for (unsigned int i = 0; i < len; ++i)
        oss << std::hex << std::setw(2) << std::setfill('0') << (int)hash[i];
    return oss.str();
}

static std::string read_file(const std::string& path) {
    std::ifstream f(path);
    if (!f) return "";
    std::string s;
    std::getline(f, s);
    return s;
}

std::string get_machine_id() {
    // Prefer /etc/machine-id (systemd — very stable across reboots)
    std::string raw = read_file("/etc/machine-id");
    if (raw.empty()) raw = read_file("/var/lib/dbus/machine-id");

    // Fallback: hostname
    if (raw.empty()) {
        char buf[256] = {};
        gethostname(buf, sizeof(buf) - 1);
        raw = std::string(buf);
    }

    return sha256_hex(raw);
}

} // namespace license
