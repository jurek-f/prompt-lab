import { useState } from 'react'
import type { Session } from '../types'
import { downloadSession } from '../lib/download'

interface Props {
  session: Session
  onNameChange: (v: string) => void
  onNewSession: () => void
  onClear: () => void
}

export function SessionControlBar({ session, onNameChange, onNewSession, onClear }: Props) {
  const [confirmClear, setConfirmClear] = useState(false)
  const hasData = session.exchanges.length > 0

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <input
        value={session.name}
        onChange={e => onNameChange(e.target.value)}
        placeholder="Name"
        style={{
          flex: 1,
          padding: '0.35rem 0.6rem',
          border: '1px solid var(--border)',
          borderRadius: 6,
          background: 'transparent',
          color: 'var(--text-h)',
          fontSize: '0.88rem',
          fontWeight: 500,
          minWidth: 0,
        }}
      />

      <button
        onClick={() => downloadSession(session, session.name)}
        disabled={!hasData}
        style={{ ...iconBtn, opacity: !hasData ? 0.3 : 1, cursor: !hasData ? 'default' : 'pointer' }}
        title="Download session JSON"
      >↓</button>

      {confirmClear ? (
        <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Clear?</span>
          <button
            onClick={() => { onClear(); setConfirmClear(false) }}
            style={{ ...iconBtn, background: 'var(--text-h)', color: 'var(--bg)', borderColor: 'var(--text-h)', fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
          >Yes</button>
          <button onClick={() => setConfirmClear(false)} style={{ ...iconBtn, fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}>No</button>
        </div>
      ) : (
        <button
          onClick={() => hasData ? setConfirmClear(true) : onClear()}
          style={iconBtn}
          title="Clear session"
        >✕</button>
      )}

      <button
        onClick={onNewSession}
        style={{ ...iconBtn, color: 'var(--accent)' }}
        title="Summarize & start new session"
      >
        New →
      </button>
    </div>
  )
}

const iconBtn: React.CSSProperties = {
  padding: '0.35rem 0.6rem',
  background: 'var(--code-bg)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: '0.88rem',
  color: 'var(--text)',
  lineHeight: 1,
  minHeight: 32,
  minWidth: 32,
}
