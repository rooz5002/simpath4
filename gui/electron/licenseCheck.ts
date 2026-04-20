import * as https from 'https'
import * as http  from 'http'
import * as os    from 'os'
import * as crypto from 'crypto'
import * as fs    from 'fs'
import * as path  from 'path'
import { app }    from 'electron'

// ── Config ─────────────────────────────────────────────────────────────────────
const LICENSE_SERVER    = 'https://api.rooz.com'
const OFFLINE_GRACE_DAYS = 7
const REQUEST_TIMEOUT_MS = 9000

function licenseFilePath(): string {
  return path.join(app.getPath('userData'), 'license.json')
}

// ── Machine ID ─────────────────────────────────────────────────────────────────
// Stable identifier derived from hardware/OS — never changes on the same machine.
export function machineId(): string {
  const raw = [os.hostname(), os.platform(), os.cpus()[0]?.model ?? ''].join('|')
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32)
}

// ── Stored license ─────────────────────────────────────────────────────────────
export interface StoredLicense {
  machine_id: string
  key:        string
  tier:       string
  expires:    string
  last_check: number   // Date.now() ms
}

export function loadStoredLicense(): StoredLicense | null {
  try {
    return JSON.parse(fs.readFileSync(licenseFilePath(), 'utf-8')) as StoredLicense
  } catch {
    return null
  }
}

function saveLicense(lic: StoredLicense): void {
  try {
    fs.writeFileSync(licenseFilePath(), JSON.stringify(lic, null, 2), 'utf-8')
  } catch { /* best-effort */ }
}

// ── HTTP helper ────────────────────────────────────────────────────────────────
function postJson(url: string, body: object): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const json   = JSON.stringify(body)
    const parsed = new URL(url)
    const isHttps = parsed.protocol === 'https:'
    const mod    = isHttps ? https : http

    const req = mod.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port ? parseInt(parsed.port) : (isHttps ? 443 : 80),
        path:     parsed.pathname + (parsed.search ?? ''),
        method:   'POST',
        headers:  {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(json),
        },
      },
      res => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          try   { resolve(JSON.parse(data) as Record<string, unknown>) }
          catch { reject(new Error('Invalid JSON from license server')) }
        })
      }
    )

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('License server request timed out'))
    })
    req.on('error', reject)
    req.write(json)
    req.end()
  })
}

// ── Result type ────────────────────────────────────────────────────────────────
export type LicenseStatus =
  | 'valid'          // server confirmed valid
  | 'renewed'        // server issued a new 30-day key
  | 'blocked'        // machine is blacklisted
  | 'offline_grace'  // server unreachable, within grace period
  | 'first_run'      // server unreachable, no stored license

export interface LicenseResult {
  status:  LicenseStatus
  license: StoredLicense | null
}

// ── Main check ─────────────────────────────────────────────────────────────────
export async function checkLicense(): Promise<LicenseResult> {
  const mid    = machineId()
  const stored = loadStoredLicense()

  let resp: Record<string, unknown>
  try {
    resp = await postJson(`${LICENSE_SERVER}/api/license/check`, {
      machine_id: mid,
      key: stored?.key ?? '',
    })
  } catch {
    // Server unreachable — apply offline grace
    if (stored) {
      const ageDays = (Date.now() - stored.last_check) / 86_400_000
      if (ageDays <= OFFLINE_GRACE_DAYS) {
        return { status: 'offline_grace', license: stored }
      }
    }
    return { status: 'first_run', license: null }
  }

  const serverStatus = String(resp.status ?? '')

  if (serverStatus === 'blocked') {
    return { status: 'blocked', license: null }
  }

  if (serverStatus === 'valid' || serverStatus === 'renewed') {
    const lic: StoredLicense = {
      machine_id: mid,
      key:        String(resp.key    ?? stored?.key    ?? ''),
      tier:       String(resp.tier   ?? stored?.tier   ?? 'BASIC'),
      expires:    String(resp.expires ?? stored?.expires ?? ''),
      last_check: Date.now(),
    }
    saveLicense(lic)
    return { status: serverStatus, license: lic }
  }

  // 'invalid' or unknown: new machine with no stored license, allow with first_run
  return { status: 'first_run', license: null }
}
