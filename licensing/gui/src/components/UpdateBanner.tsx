/**
 * UpdateBanner — shows a top-of-screen notification when a new version is available.
 * Reusable: pass your UpdateStatus and it handles the rest.
 * By Amir Ali Mokhtarzadeh 2025
 */
import { useState } from 'react'
import type { UpdateStatus } from '../UpdateChecker'

interface Props {
  status: UpdateStatus | null
}

export function UpdateBanner({ status }: Props) {
  const [dismissed, setDismissed] = useState(false)

  if (!status || dismissed) return null
  if (!status.updateAvailable && !status.updateRequired) return null

  const isRequired = status.updateRequired

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
      background: isRequired ? '#b71c1c' : '#1565c0',
      color: '#fff',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 16px',
      fontSize: '0.85rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
    }}>
      <span style={{ flex: 1 }}>
        {isRequired ? '⚠ ' : '↑ '}
        {status.message}
        {status.notes && <span style={{ marginLeft: 8, opacity: 0.85 }}>— {status.notes}</span>}
      </span>

      {status.downloadUrl && (
        <a
          href={status.downloadUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: '1px solid rgba(255,255,255,0.4)',
            borderRadius: 4,
            color: '#fff',
            padding: '3px 10px',
            textDecoration: 'none',
            fontSize: '0.8rem',
          }}
        >
          Download
        </a>
      )}

      {!isRequired && (
        <button
          onClick={() => setDismissed(true)}
          style={{
            background: 'transparent', border: 'none', color: '#fff',
            cursor: 'pointer', fontSize: '1rem', lineHeight: 1,
          }}
          title="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  )
}
