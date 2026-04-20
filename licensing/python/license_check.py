"""
License key validator.

Key format:
    {APP_ID}-{TIER}-{YYYYMMDD}-{HMAC12}

Example:
    SIMPATH4-RESEARCH-20250101-9f3a2b1c4d5e

Tiers (ordered by capability):
    TRIAL < BASIC < RESEARCH < ML < ROS2 < FULL

The HMAC is computed as:
    HMAC-SHA256(secret, "{APP_ID}:{TIER}:{YYYYMMDD}:{MACHINE_ID}")
    and the first 12 hex characters are appended to the key.

Machine-bound keys include the machine fingerprint in the HMAC input.
Non-machine-bound keys use an empty string for MACHINE_ID,
allowing the key to work on any machine.

Reusable — configure with your app_id and hmac_secret.
By Amir Ali Mokhtarzadeh 2025
"""

import hashlib
import hmac as hmac_module
import json
import os
import time
from dataclasses import dataclass, asdict
from datetime import datetime, date
from enum import Enum
from pathlib import Path
from typing import Optional

from .machine_id import get_machine_id


# ── Tiers ────────────────────────────────────────────────────────────────────

class LicenseTier(Enum):
    TRIAL    = 0
    BASIC    = 1
    RESEARCH = 2
    ML       = 3
    ROS2     = 4
    FULL     = 5

    @classmethod
    def from_str(cls, s: str) -> "LicenseTier":
        try:
            return cls[s.upper()]
        except KeyError:
            raise ValueError(f"Unknown tier: {s}")

    def __ge__(self, other: "LicenseTier") -> bool:
        return self.value >= other.value

    def __gt__(self, other: "LicenseTier") -> bool:
        return self.value > other.value


# ── Result ───────────────────────────────────────────────────────────────────

@dataclass
class LicenseResult:
    valid:        bool
    tier:         str            # LicenseTier.name
    issued_date:  str            # "YYYYMMDD"
    machine_bound: bool
    message:      str

    @property
    def tier_enum(self) -> LicenseTier:
        return LicenseTier.from_str(self.tier)

    def has_feature(self, required_tier: LicenseTier) -> bool:
        return self.valid and self.tier_enum >= required_tier


TRIAL_RESULT = LicenseResult(
    valid=True, tier="TRIAL", issued_date="", machine_bound=False,
    message="Trial mode"
)
INVALID_RESULT = LicenseResult(
    valid=False, tier="TRIAL", issued_date="", machine_bound=False,
    message="No valid license"
)


# ── Validator ────────────────────────────────────────────────────────────────

HMAC_LEN = 12   # hex characters appended to key

class LicenseValidator:
    """
    Validates license keys and caches the result locally.

    Parameters
    ----------
    app_id      : Short uppercase identifier, e.g. "SIMPATH4"
    hmac_secret : Secret string — keep this private, compile it in.
    cache_dir   : Directory for the cached validation result.
                  Defaults to ~/.cache/{app_id.lower()}/
    trial_days  : How many days the app runs without a key.
    """

    def __init__(
        self,
        app_id: str,
        hmac_secret: str,
        cache_dir: Optional[str] = None,
        trial_days: int = 30,
    ):
        self.app_id       = app_id.upper()
        self.hmac_secret  = hmac_secret
        self.trial_days   = trial_days
        self._cache_path  = Path(
            cache_dir or os.path.expanduser(f"~/.cache/{app_id.lower()}")
        ) / "license.json"

    # ── Public API ────────────────────────────────────────────────────────────

    def validate(self, key: str) -> LicenseResult:
        """Validate a license key. Returns LicenseResult."""
        key = key.strip().upper()
        parts = key.split("-")

        # Format: APP_ID - TIER - DATE - HMAC12
        if len(parts) != 4:
            return LicenseResult(
                valid=False, tier="TRIAL", issued_date="", machine_bound=False,
                message="Invalid key format (expected APP-TIER-DATE-HMAC)"
            )

        app_id, tier_str, date_str, key_hmac = parts

        if app_id != self.app_id:
            return LicenseResult(
                valid=False, tier="TRIAL", issued_date="", machine_bound=False,
                message=f"Key is for '{app_id}', not '{self.app_id}'"
            )

        try:
            LicenseTier.from_str(tier_str)
        except ValueError as e:
            return LicenseResult(
                valid=False, tier="TRIAL", issued_date="", machine_bound=False,
                message=str(e)
            )

        # Validate date
        try:
            datetime.strptime(date_str, "%Y%m%d")
        except ValueError:
            return LicenseResult(
                valid=False, tier="TRIAL", issued_date="", machine_bound=False,
                message="Invalid date in key"
            )

        # Try machine-bound HMAC first, then universal HMAC
        machine_id = get_machine_id()
        for mid, bound in [(machine_id, True), ("", False)]:
            expected = self._compute_hmac(tier_str, date_str, mid)
            if hmac_module.compare_digest(key_hmac.lower(), expected):
                result = LicenseResult(
                    valid=True,
                    tier=tier_str,
                    issued_date=date_str,
                    machine_bound=bound,
                    message=f"Valid {tier_str} license"
                )
                self._save_cache(result, key)
                return result

        return LicenseResult(
            valid=False, tier="TRIAL", issued_date=date_str, machine_bound=False,
            message="HMAC verification failed — key is invalid or tampered"
        )

    def load_cached(self) -> Optional[LicenseResult]:
        """Return cached LicenseResult if present and not expired."""
        try:
            data = json.loads(self._cache_path.read_text())
            # Re-validate the cached key to ensure it hasn't been tampered
            result = self.validate(data.get("key", ""))
            if result.valid:
                return result
        except Exception:
            pass
        return None

    def trial_status(self, first_run_file: Optional[str] = None) -> LicenseResult:
        """
        Return TRIAL result if within trial_days of first run,
        otherwise INVALID.
        """
        path = Path(
            first_run_file or str(self._cache_path.parent / "first_run.txt")
        )
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                path.write_text(str(int(time.time())))
            first_run = int(path.read_text().strip())
            elapsed_days = (time.time() - first_run) / 86400
            if elapsed_days <= self.trial_days:
                remaining = int(self.trial_days - elapsed_days)
                return LicenseResult(
                    valid=True, tier="TRIAL", issued_date="", machine_bound=False,
                    message=f"Trial: {remaining} day(s) remaining"
                )
            return LicenseResult(
                valid=False, tier="TRIAL", issued_date="", machine_bound=False,
                message="Trial period expired"
            )
        except Exception:
            return INVALID_RESULT

    def generate_key(self, tier: str, date_str: str, machine_id: str = "") -> str:
        """
        Generate a license key (call this from your licence-issue script,
        not from the end-user app).
        """
        h = self._compute_hmac(tier.upper(), date_str, machine_id)
        return f"{self.app_id}-{tier.upper()}-{date_str}-{h.upper()}"

    # ── Internal ──────────────────────────────────────────────────────────────

    def _compute_hmac(self, tier: str, date_str: str, machine_id: str) -> str:
        msg = f"{self.app_id}:{tier}:{date_str}:{machine_id}".encode()
        return hmac_module.new(
            self.hmac_secret.encode(), msg, hashlib.sha256
        ).hexdigest()[:HMAC_LEN]

    def _save_cache(self, result: LicenseResult, key: str) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            data = asdict(result)
            data["key"] = key
            self._cache_path.write_text(json.dumps(data, indent=2))
        except Exception:
            pass
