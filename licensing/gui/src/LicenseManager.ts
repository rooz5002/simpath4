/**
 * Client-side license manager (TypeScript).
 *
 * Validates license keys in the browser/Electron using the same
 * HMAC-SHA256 scheme as the Python module.
 *
 * Key format:  {APP_ID}-{TIER}-{YYYYMMDD}-{HMAC12}
 * Example:     SIMPATH4-RESEARCH-20250101-9F3A2B1C4D5E
 *
 * Reusable — configure with your app_id and hmac_secret.
 * By Amir Ali Mokhtarzadeh 2025
 */

export type LicenseTier = 'TRIAL' | 'BASIC' | 'RESEARCH' | 'ML' | 'ROS2' | 'FULL'

const TIER_RANK: Record<LicenseTier, number> = {
  TRIAL: 0, BASIC: 1, RESEARCH: 2, ML: 3, ROS2: 4, FULL: 5,
}

export interface LicenseResult {
  valid:        boolean
  tier:         LicenseTier
  issuedDate:   string      // "YYYYMMDD"
  machineBound: boolean
  message:      string
}

export const TRIAL_RESULT: LicenseResult = {
  valid: true, tier: 'TRIAL', issuedDate: '', machineBound: false, message: 'Trial mode',
}
export const INVALID_RESULT: LicenseResult = {
  valid: false, tier: 'TRIAL', issuedDate: '', machineBound: false, message: 'No valid license',
}

export function hasFeature(result: LicenseResult, required: LicenseTier): boolean {
  return result.valid && TIER_RANK[result.tier] >= TIER_RANK[required]
}

const STORAGE_KEY = (appId: string) => `${appId.toLowerCase()}_license`
const HMAC_LEN = 12

// ── HMAC-SHA256 via Web Crypto API ───────────────────────────────────────────

async function computeHmac(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message))
  return Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, HMAC_LEN)
}

// ── LicenseManager ───────────────────────────────────────────────────────────

export class LicenseManager {
  private appId:      string
  private secret:     string
  private trialDays:  number

  /**
   * @param appId      Short uppercase ID, e.g. "SIMPATH4"
   * @param hmacSecret Keep private — compile/bundle into app
   * @param trialDays  Days before trial expires (default 30)
   */
  constructor(appId: string, hmacSecret: string, trialDays = 30) {
    this.appId     = appId.toUpperCase()
    this.secret    = hmacSecret
    this.trialDays = trialDays
  }

  async validate(key: string): Promise<LicenseResult> {
    const parts = key.trim().toUpperCase().split('-')
    if (parts.length !== 4) {
      return { ...INVALID_RESULT, message: 'Invalid key format (expected APP-TIER-DATE-HMAC)' }
    }
    const [appId, tierStr, dateStr, keyHmac] = parts

    if (appId !== this.appId) {
      return { ...INVALID_RESULT, message: `Key is for '${appId}', not '${this.appId}'` }
    }
    if (!(tierStr in TIER_RANK)) {
      return { ...INVALID_RESULT, message: `Unknown tier: ${tierStr}` }
    }
    if (!/^\d{8}$/.test(dateStr)) {
      return { ...INVALID_RESULT, message: 'Invalid date in key' }
    }

    // Try universal key (machine_id = "")
    const expected = await computeHmac(
      this.secret, `${this.appId}:${tierStr}:${dateStr}:`
    )
    if (keyHmac.toLowerCase() === expected.toLowerCase()) {
      const result: LicenseResult = {
        valid: true, tier: tierStr as LicenseTier,
        issuedDate: dateStr, machineBound: false,
        message: `Valid ${tierStr} license`,
      }
      this._save(key, result)
      return result
    }

    return { ...INVALID_RESULT, message: 'Invalid key — HMAC verification failed' }
  }

  loadCached(): LicenseResult | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(this.appId))
      if (!raw) return null
      const data = JSON.parse(raw)
      // Basic sanity check
      if (data.valid && data.tier && data.key) return data as LicenseResult
    } catch { /* ignore */ }
    return null
  }

  trialStatus(): LicenseResult {
    const key  = `${STORAGE_KEY(this.appId)}_first_run`
    const now  = Date.now()
    let first  = parseInt(localStorage.getItem(key) ?? '0', 10)
    if (!first) { first = now; localStorage.setItem(key, String(now)) }
    const days     = (now - first) / 86_400_000
    const remaining = Math.max(0, Math.ceil(this.trialDays - days))
    if (remaining > 0) {
      return { ...TRIAL_RESULT, message: `Trial: ${remaining} day(s) remaining` }
    }
    return { ...INVALID_RESULT, message: 'Trial period expired' }
  }

  clearLicense(): void {
    localStorage.removeItem(STORAGE_KEY(this.appId))
  }

  private _save(key: string, result: LicenseResult): void {
    try {
      localStorage.setItem(STORAGE_KEY(this.appId), JSON.stringify({ ...result, key }))
    } catch { /* ignore */ }
  }
}
