"""
cloudgate-licensing — reusable license + update check module.
By Amir Ali Mokhtarzadeh 2025
"""
from .license_check import LicenseValidator, LicenseResult, LicenseTier, TRIAL_RESULT, INVALID_RESULT
from .update_check  import UpdateChecker, UpdateStatus
from .machine_id    import get_machine_id

__all__ = [
    "LicenseValidator", "LicenseResult", "LicenseTier",
    "TRIAL_RESULT", "INVALID_RESULT",
    "UpdateChecker", "UpdateStatus",
    "get_machine_id",
]
