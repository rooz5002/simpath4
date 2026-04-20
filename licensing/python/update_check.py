"""
Online update checker.

Fetches a version manifest from a URL and compares it to the running version.
Works offline gracefully — returns cached result if the server is unreachable.

Version manifest JSON (host this as a static file, e.g. on GitHub Pages):
{
    "latest":       "0.2.0",
    "min_required": "0.1.0",
    "release_date": "2025-06-01",
    "download_url": "https://example.com/releases/simpath4-0.2.0.tar.gz",
    "notes":        "Bug fixes and performance improvements."
}

Reusable — configure with your app's version and manifest URL.
By Amir Ali Mokhtarzadeh 2025
"""

import json
import os
import time
import urllib.request
import urllib.error
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, Tuple


@dataclass
class VersionInfo:
    latest:       str
    min_required: str
    release_date: str
    download_url: str
    notes:        str


@dataclass
class UpdateStatus:
    update_available:  bool
    update_required:   bool   # current < min_required
    current_version:   str
    latest_version:    str
    download_url:      str
    notes:             str
    from_cache:        bool
    message:           str


def _parse_version(v: str) -> Tuple[int, ...]:
    """Parse "1.2.3" → (1, 2, 3). Extra labels (e.g. '-beta') are stripped."""
    return tuple(int(x) for x in v.split("-")[0].split("."))


class UpdateChecker:
    """
    Parameters
    ----------
    current_version : Running version string, e.g. "0.1.0"
    manifest_url    : URL of the version manifest JSON.
    cache_dir       : Directory to cache the last known manifest.
                      Defaults to ~/.cache/{app_id.lower()}/
    timeout_secs    : HTTP timeout. Default 5 s.
    cache_ttl_secs  : Re-fetch interval. Default 6 hours.
    """

    def __init__(
        self,
        current_version: str,
        manifest_url: str,
        app_id: str = "app",
        cache_dir: Optional[str] = None,
        timeout_secs: int = 5,
        cache_ttl_secs: int = 21600,
    ):
        self.current_version = current_version
        self.manifest_url    = manifest_url
        self.timeout_secs    = timeout_secs
        self.cache_ttl_secs  = cache_ttl_secs
        self._cache_path = Path(
            cache_dir or os.path.expanduser(f"~/.cache/{app_id.lower()}")
        ) / "version_cache.json"

    def check(self) -> UpdateStatus:
        """Fetch manifest (or use cache) and return UpdateStatus."""
        manifest, from_cache = self._fetch_manifest()

        if manifest is None:
            return UpdateStatus(
                update_available=False,
                update_required=False,
                current_version=self.current_version,
                latest_version=self.current_version,
                download_url="",
                notes="",
                from_cache=False,
                message="Could not reach update server",
            )

        try:
            current = _parse_version(self.current_version)
            latest  = _parse_version(manifest.latest)
            minimum = _parse_version(manifest.min_required)
        except Exception as e:
            return UpdateStatus(
                update_available=False, update_required=False,
                current_version=self.current_version,
                latest_version=manifest.latest,
                download_url=manifest.download_url,
                notes=manifest.notes,
                from_cache=from_cache,
                message=f"Version parse error: {e}",
            )

        update_available = latest > current
        update_required  = current < minimum

        if update_required:
            msg = (f"Version {self.current_version} is no longer supported. "
                   f"Please update to {manifest.latest}.")
        elif update_available:
            msg = f"Update available: {manifest.latest} ({manifest.release_date})"
        else:
            msg = f"Up to date ({self.current_version})"

        return UpdateStatus(
            update_available=update_available,
            update_required=update_required,
            current_version=self.current_version,
            latest_version=manifest.latest,
            download_url=manifest.download_url,
            notes=manifest.notes,
            from_cache=from_cache,
            message=msg,
        )

    # ── Internal ──────────────────────────────────────────────────────────────

    def _fetch_manifest(self) -> Tuple[Optional[VersionInfo], bool]:
        # Use cache if fresh enough
        cached = self._load_cache()
        if cached:
            return cached, True

        # Fetch from server
        try:
            req = urllib.request.Request(
                self.manifest_url,
                headers={"User-Agent": "simpath4-update-checker/1.0"},
            )
            with urllib.request.urlopen(req, timeout=self.timeout_secs) as resp:
                data = json.loads(resp.read().decode())
            info = VersionInfo(
                latest       = data["latest"],
                min_required = data.get("min_required", "0.0.0"),
                release_date = data.get("release_date", ""),
                download_url = data.get("download_url", ""),
                notes        = data.get("notes", ""),
            )
            self._save_cache(info)
            return info, False
        except Exception:
            # Server unreachable — return stale cache if available, else None
            stale = self._load_cache(ignore_ttl=True)
            return stale, stale is not None

    def _load_cache(self, ignore_ttl: bool = False) -> Optional[VersionInfo]:
        try:
            data = json.loads(self._cache_path.read_text())
            if not ignore_ttl:
                age = time.time() - data.get("_cached_at", 0)
                if age > self.cache_ttl_secs:
                    return None
            return VersionInfo(
                latest       = data["latest"],
                min_required = data.get("min_required", "0.0.0"),
                release_date = data.get("release_date", ""),
                download_url = data.get("download_url", ""),
                notes        = data.get("notes", ""),
            )
        except Exception:
            return None

    def _save_cache(self, info: VersionInfo) -> None:
        try:
            self._cache_path.parent.mkdir(parents=True, exist_ok=True)
            data = {
                "latest":       info.latest,
                "min_required": info.min_required,
                "release_date": info.release_date,
                "download_url": info.download_url,
                "notes":        info.notes,
                "_cached_at":   int(time.time()),
            }
            self._cache_path.write_text(json.dumps(data, indent=2))
        except Exception:
            pass
