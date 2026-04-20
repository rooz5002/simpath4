/**
 * Client-side update checker (TypeScript).
 *
 * Fetches a version manifest JSON and compares to the running version.
 * Caches the result in localStorage to avoid hitting the server on every load.
 *
 * Version manifest format (host as a static JSON file):
 * {
 *   "latest":       "0.2.0",
 *   "min_required": "0.1.0",
 *   "release_date": "2025-06-01",
 *   "download_url": "https://example.com/releases/latest",
 *   "notes":        "Bug fixes and new features."
 * }
 *
 * Reusable — configure with your manifest URL and current version.
 * By Amir Ali Mokhtarzadeh 2025
 */

export interface VersionManifest {
  latest:       string
  min_required: string
  release_date: string
  download_url: string
  notes:        string
}

export interface UpdateStatus {
  updateAvailable: boolean
  updateRequired:  boolean   // current < min_required
  currentVersion:  string
  latestVersion:   string
  downloadUrl:     string
  notes:           string
  fromCache:       boolean
  message:         string
}

function parseVersion(v: string): number[] {
  return v.split('-')[0].split('.').map(Number)
}

function versionLt(a: number[], b: number[]): boolean {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const ai = a[i] ?? 0, bi = b[i] ?? 0
    if (ai < bi) return true
    if (ai > bi) return false
  }
  return false
}

const CACHE_KEY  = (appId: string) => `${appId.toLowerCase()}_version_cache`
const TTL_MS     = 6 * 3600 * 1000   // 6 hours

export class UpdateChecker {
  private currentVersion: string
  private manifestUrl:    string
  private appId:          string
  private timeoutMs:      number

  /**
   * @param currentVersion  Running version, e.g. "0.1.0"
   * @param manifestUrl     URL of the version manifest JSON
   * @param appId           Used as localStorage key prefix
   * @param timeoutMs       Fetch timeout (default 5000 ms)
   */
  constructor(
    currentVersion: string,
    manifestUrl:    string,
    appId:          string = 'app',
    timeoutMs:      number = 5000,
  ) {
    this.currentVersion = currentVersion
    this.manifestUrl    = manifestUrl
    this.appId          = appId.toLowerCase()
    this.timeoutMs      = timeoutMs
  }

  async check(): Promise<UpdateStatus> {
    const { manifest, fromCache } = await this._fetchManifest()

    if (!manifest) {
      return {
        updateAvailable: false, updateRequired: false,
        currentVersion: this.currentVersion, latestVersion: this.currentVersion,
        downloadUrl: '', notes: '', fromCache: false,
        message: 'Could not reach update server',
      }
    }

    const current = parseVersion(this.currentVersion)
    const latest  = parseVersion(manifest.latest)
    const minimum = parseVersion(manifest.min_required)

    const updateAvailable = versionLt(current, latest)
    const updateRequired  = versionLt(current, minimum)

    let message: string
    if (updateRequired) {
      message = `Version ${this.currentVersion} is no longer supported. Please update to ${manifest.latest}.`
    } else if (updateAvailable) {
      message = `Update available: ${manifest.latest} (${manifest.release_date})`
    } else {
      message = `Up to date (${this.currentVersion})`
    }

    return {
      updateAvailable, updateRequired,
      currentVersion: this.currentVersion,
      latestVersion:  manifest.latest,
      downloadUrl:    manifest.download_url,
      notes:          manifest.notes,
      fromCache,
      message,
    }
  }

  private async _fetchManifest(): Promise<{ manifest: VersionManifest | null; fromCache: boolean }> {
    // Try fresh fetch first
    try {
      const controller = new AbortController()
      const tid = setTimeout(() => controller.abort(), this.timeoutMs)
      const resp = await fetch(this.manifestUrl, { signal: controller.signal })
      clearTimeout(tid)
      if (resp.ok) {
        const data: VersionManifest = await resp.json()
        this._saveCache(data)
        return { manifest: data, fromCache: false }
      }
    } catch { /* network error or timeout */ }

    // Fall back to cache (fresh or stale)
    const cached = this._loadCache(false) ?? this._loadCache(true)
    return { manifest: cached, fromCache: cached !== null }
  }

  private _loadCache(ignoreExpiry: boolean): VersionManifest | null {
    try {
      const raw  = localStorage.getItem(CACHE_KEY(this.appId))
      if (!raw) return null
      const data = JSON.parse(raw)
      if (!ignoreExpiry && Date.now() - (data._cached_at ?? 0) > TTL_MS) return null
      return data as VersionManifest
    } catch { return null }
  }

  private _saveCache(manifest: VersionManifest): void {
    try {
      localStorage.setItem(
        CACHE_KEY(this.appId),
        JSON.stringify({ ...manifest, _cached_at: Date.now() }),
      )
    } catch { /* quota exceeded */ }
  }
}
