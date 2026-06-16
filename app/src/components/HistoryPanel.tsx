import React, { useState } from 'react'
import type { SessionSummary } from '../types'

interface Props {
  summaries: SessionSummary[]
  onDownload: () => void
  onClearHistory: () => void
}

export function HistoryPanel({ summaries, onDownload, onClearHistory }: Props) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const count = summaries.length

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => !o)}
          style={{
            flex: 1,
            padding: '0.55rem 1rem',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.82rem',
            color: 'var(--text)',
            opacity: 0.7,
          }}
        >
          <span>Past session summaries ({count})</span>
          <span>{open ? '▲' : '▼'}</span>
        </button>

        {count > 0 && (
          confirmClear ? (
            <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', paddingRight: '0.5rem' }}>
              <span style={{ fontSize: '0.78rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Clear all?</span>
              <button onClick={() => { onClearHistory(); setConfirmClear(false) }} style={{ ...iconBtn, background: 'var(--text-h)', color: 'var(--bg)', borderColor: 'var(--text-h)', fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}>Yes</button>
              <button onClick={() => setConfirmClear(false)} style={{ ...iconBtn, fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}>No</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.3rem', paddingRight: '0.5rem' }}>
              <button onClick={onDownload} title="Download summaries JSON" style={iconBtn}>↓</button>
              <button onClick={() => setConfirmClear(true)} title="Clear history" style={iconBtn}>✕</button>
            </div>
          )
        )}
      </div>

      {open && (
        <div style={{ padding: '0.5rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {count === 0 ? (
            <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.45, lineHeight: 1.55 }}>
              Summaries of completed sessions appear here (up to 10). Use "New →" to finish a session and save its summary.
            </p>
          ) : summaries.map(s => (
            <div
              key={s.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setExpanded(expanded === s.id ? null : s.id)}
                style={{
                  width: '100%',
                  padding: '0.55rem 0.75rem',
                  background: 'var(--code-bg)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textAlign: 'left',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-h)' }}>
                    {s.name}
                  </span>
                  <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>
                    {s.date} · {s.exchangeCount} attempts
                    {s.scoreMax !== null && ` · best: ${s.scoreMax.toFixed(2)}`}
                  </span>
                </div>
                <span style={{ opacity: 0.5, fontSize: '0.8rem' }}>{expanded === s.id ? '▲' : '▼'}</span>
              </button>

              {expanded === s.id && (
                <div style={{ padding: '0.6rem 0.75rem' }}>
                  {s.targetAnswer && (
                    <p style={{ margin: '0 0 0.4rem', fontSize: '0.8rem', opacity: 0.6 }}>
                      <strong>Target:</strong> {s.targetAnswer}
                    </p>
                  )}
                  <p style={{ margin: 0, fontSize: '0.82rem', lineHeight: 1.6 }}>
                    {s.summary}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: 'var(--code-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.82rem',
  color: 'var(--text)',
  lineHeight: 1,
  minHeight: 28,
  minWidth: 28,
}
