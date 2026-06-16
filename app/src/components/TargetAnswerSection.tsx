import { useState } from 'react'

interface Props {
  targetAnswer: string
  onChange: (v: string) => void
}

export function TargetAnswerSection({ targetAnswer, onChange }: Props) {
  const [infoOpen, setInfoOpen] = useState(false)

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)' }}>
          Target answer
        </span>
        <span style={{ fontSize: '0.75rem', opacity: 0.45 }}>optional — enables scoring</span>
        <button
          onClick={() => setInfoOpen(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: '0.85rem', opacity: infoOpen ? 0.8 : 0.4,
            padding: '0.1rem 0.2rem', lineHeight: 1, color: 'var(--text)',
          }}
          title="About the target answer"
        >
          ℹ
        </button>
      </div>

      {infoOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% - 2px)', left: 0, zIndex: 20,
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 8, padding: '0.6rem 0.8rem',
          fontSize: '0.8rem', lineHeight: 1.55, color: 'var(--text)',
          maxWidth: 300, boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        }}>
          Describe what a correct response should contain. Each send scores the response against this (0.00–1.00) and gives the tutor more precise feedback. You can update it at any time — past scores are unaffected.
        </div>
      )}

      <textarea
        value={targetAnswer}
        onChange={e => onChange(e.target.value)}
        placeholder="Describe what a correct response should contain…"
        rows={2}
        style={{
          width: '100%',
          padding: '0.55rem 0.75rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg)',
          color: 'var(--text-h)',
          fontSize: '0.88rem',
          resize: 'vertical',
          fontFamily: 'var(--sans)',
          lineHeight: 1.5,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
