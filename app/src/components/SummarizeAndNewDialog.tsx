import { downloadSession } from '../lib/download'
import type { Session } from '../types'

interface Props {
  session: Session
  onConfirm: () => void
  onCancel: () => void
  summarizing: boolean
}

export function SummarizeAndNewDialog({ session, onConfirm, onCancel, summarizing }: Props) {
  return (
    <div
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '1.5rem',
          width: '100%',
          maxWidth: 420,
          boxShadow: 'var(--shadow)',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem' }}>Start a new session?</h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.88rem', lineHeight: 1.6, opacity: 0.75 }}>
          Session details will be summarized and archived. Only the summary is kept — download now if you want the full history.
        </p>

        {!session.targetAnswer.trim() && (
          <p style={{ margin: '0 0 1rem', fontSize: '0.83rem', lineHeight: 1.55, padding: '0.55rem 0.75rem', background: 'var(--code-bg)', borderRadius: 7, border: '1px solid var(--border)' }}>
            No target answer was set — this session has no scores. Consider setting one in the new session for better coaching.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {session.exchanges.length > 0 && (
            <button
              onClick={() => downloadSession(session, session.name)}
              style={secondaryBtn}
            >
              ↓ Download session JSON first
            </button>
          )}
          <button
            onClick={onConfirm}
            disabled={summarizing}
            style={{
              padding: '0.7rem',
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: '0.92rem',
              cursor: summarizing ? 'not-allowed' : 'pointer',
              opacity: summarizing ? 0.7 : 1,
            }}
          >
            {summarizing ? 'Summarizing…' : 'Summarize & start new session'}
          </button>
          <button onClick={onCancel} style={secondaryBtn}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

const secondaryBtn: React.CSSProperties = {
  padding: '0.65rem',
  background: 'var(--code-bg)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: '0.88rem',
  cursor: 'pointer',
  color: 'var(--text)',
}
