"""
Cross-platform machine fingerprint.
Returns a stable hex string based on hardware identifiers.
Used to bind a license key to a specific machine.

Reusable — no project-specific dependencies.
By Amir Ali Mokhtarzadeh 2025
"""

import hashlib
import platform
import subprocess
import uuid


def _read_file(path: str) -> str:
    try:
        with open(path) as f:
            return f.read().strip()
    except Exception:
        return ""


def _linux_machine_id() -> str:
    # Prefer /etc/machine-id (systemd, very stable)
    mid = _read_file("/etc/machine-id") or _read_file("/var/lib/dbus/machine-id")
    if mid:
        return mid

    # Fallback: CPU serial from /proc/cpuinfo
    for line in _read_file("/proc/cpuinfo").splitlines():
        if "Serial" in line:
            parts = line.split(":")
            if len(parts) == 2:
                return parts[1].strip()

    return ""


def _mac_machine_id() -> str:
    try:
        out = subprocess.check_output(
            ["ioreg", "-rd1", "-c", "IOPlatformExpertDevice"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        for line in out.splitlines():
            if "IOPlatformUUID" in line:
                return line.split('"')[-2]
    except Exception:
        pass
    return ""


def _windows_machine_id() -> str:
    try:
        out = subprocess.check_output(
            ["wmic", "csproduct", "get", "UUID"],
            stderr=subprocess.DEVNULL,
            text=True,
        )
        lines = [l.strip() for l in out.splitlines() if l.strip()]
        if len(lines) >= 2:
            return lines[1]
    except Exception:
        pass
    return ""


def get_machine_id() -> str:
    """Return a stable 32-char hex machine fingerprint."""
    system = platform.system()

    raw = ""
    if system == "Linux":
        raw = _linux_machine_id()
    elif system == "Darwin":
        raw = _mac_machine_id()
    elif system == "Windows":
        raw = _windows_machine_id()

    # Final fallback: MAC address (less stable but widely available)
    if not raw:
        raw = hex(uuid.getnode())

    return hashlib.sha256(raw.encode()).hexdigest()
