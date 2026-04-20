/**
 * LicenseDialog — modal for entering and viewing a license key.
 * Reusable: pass your LicenseManager instance and current result.
 * By Amir Ali Mokhtarzadeh 2025
 */
import { useState } from 'react'
import type { LicenseResult } from '../LicenseManager'
import type { LicenseManager } from '../LicenseManager'

interface Props {
  manager:       LicenseManager
  current:       LicenseResult | null
  onValidated:   (result: LicenseResult) => void
  onClose:       () => void
}

const TIER_COLOURS: Record<string, string> = {
  TRIAL:    '#607d8b',
  BASIC:    '#1565c0',
  RESEARCH: '#4caf50',
  ML:       '#9c27b0',
  ROS2:     '#ff9800',
  FULL:     '#f44336',
}

export function LicenseDialog({ manager, current, onValidated, onClose }: Props) {
  const [key,     setKey]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handleActivate() {
    setLoading(true)
    setError('')
    const result = await manager.validate(key)
    setLoading(false)
    if (result.valid) {
      onValidated(result)
      onClose()
    } else {
      setError(result.message)
    }
  }

  const tier = current?.tier ?? 'TRIAL'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: '#1a1a2e', border: '1px solid #2a2a4a',
        borderRadius: 8, padding: 28, width: 440, maxWidth: '90vw',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      }}>
        <h2 style={{ margin: '0 0 16px', color: '#e0e0f0', fontSize: '1rem' }}>
          License
        </h2>

        {/* Current status */}
        {current && (
          <div style={{
            background: '#0d0d1a', borderRadius: 6, padding: '10px 14px',
            marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center',
          }}>
            <span style={{
              background: TIER_COLOURS[tier] ?? '#607d8b',
              borderRadius: 4, padding: '2px 8px',
              fontSize: '0.75rem', fontWeight: 700, color: '#fff',
            }}>
              {tier}
            </span>
            <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
              {current.message}
            </span>
            {current.issuedDate && (
              <span style={{ marginLeft: 'auto', color: '#666', fontSize: '0.75rem' }}>
                Issued {current.issuedDate}
              </span>
            )}
          </div>
        )}

        {/* Key entry */}
        <label style={{ display: 'block', color: '#888', fontSize: '0.8rem', marginBottom: 6 }}>
          License key
        </label>
        <input
          type="text"
          value={key}
          onChange={e => setKey(e.target.value)}
          placeholder="SIMPATH4-RESEARCH-20250101-9F3A2B1C"
          style={{
            width: '100%', background: '#0d0d1a',
            border: '1px solid #2a2a4a', borderRadius: 4,
            color: '#e0e0f0', padding: '8px 10px', fontSize: '0.85rem',
            fontFamily: 'monospace', marginBottom: 8,
          }}
          onKeyDown={e => e.key === 'Enter' && handleActivate()}
        />

        {error && (
          <p style={{ color: '#ff5252', fontSize: '0.8rem', margin: '0 0 12px' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid #2a2a4a',
            borderRadius: 4, color: '#aaa', padding: '6px 16px', cursor: 'pointer',
          }}>
            Cancel
          </button>
          <button
            onClick={handleActivate}
            disabled={loading || !key.trim()}
            style={{
              background: '#2196f3', border: 'none',
              borderRadius: 4, color: '#fff', padding: '6px 16px',
              cursor: 'pointer', fontWeight: 600,
              opacity: loading || !key.trim() ? 0.5 : 1,
            }}
          >
            {loading ? 'Checking…' : 'Activate'}
          </button>
        </div>
      </div>
    </div>
  )
}
