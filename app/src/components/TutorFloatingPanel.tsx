import { useEffect, useRef, useState } from 'react'
import type { TutorMessage } from '../types'

const TOPBAR_H = 44

interface Props {
  messages: TutorMessage[]
  tutorEnabled: boolean
  loading: boolean
  responseLoading: boolean
  onTutorToggle: (v: boolean) => void
  onUserMessage: (text: string) => Promise<void>
  onClose: () => void
}

export function TutorFloatingPanel({
  messages, tutorEnabled, loading, responseLoading,
  onTutorToggle, onUserMessage, onClose,
}: Props) {
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await onUserMessage(text)
  }

  const statusText = responseLoading
    ? 'waiting for answer…'
    : loading
      ? 'thinking…'
      : null

  return (
    <div style={{
      position: 'fixed',
      top: TOPBAR_H,
      right: 0,
      width: 'min(380px, calc(100vw - 40px))',
      maxHeight: `calc(100vh - ${TOPBAR_H}px)`,
      zIndex: 30,
      background: 'var(--bg)',
      borderLeft: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '-4px 4px 20px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.55rem 0.75rem',
        borderBottom: '1px solid var(--border)',
        background: 'var(--code-bg)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-h)', flex: 1 }}>
          Tutor
          {statusText && (
            <span style={{ marginLeft: '0.4rem', fontSize: '0.78rem', fontWeight: 400, opacity: 0.55 }}>
              · {statusText}
            </span>
          )}
        </span>

        <button
          onClick={() => onTutorToggle(!tutorEnabled)}
          style={{
            padding: '0.2rem 0.55rem',
            fontSize: '0.75rem',
            background: tutorEnabled ? 'var(--accent-bg)' : 'var(--bg)',
            border: `1px solid ${tutorEnabled ? 'var(--accent-border)' : 'var(--border)'}`,
            borderRadius: 5,
            cursor: 'pointer',
            color: tutorEnabled ? 'var(--accent)' : 'var(--text)',
            whiteSpace: 'nowrap',
          }}
          title="Enable or disable automatic tutor feedback after each send"
        >
          {tutorEnabled ? 'auto on' : 'auto off'}
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text)', opacity: 0.5, fontSize: '1.1rem',
            lineHeight: 1, padding: '0 0.15rem',
          }}
          title="Close tutor"
        >×</button>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0.75rem',
        display: 'flex', flexDirection: 'column', gap: '0.6rem',
      }}>
        {messages.length === 0 && !statusText && (
          <p style={{ margin: 0, opacity: 0.45, fontSize: '0.85rem' }}>
            Tutor feedback will appear here after each send (when auto is on).
          </p>
        )}

        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '92%',
            background: m.role === 'user' ? 'var(--accent)' : 'var(--code-bg)',
            color: m.role === 'user' ? 'var(--bg)' : 'var(--text)',
            borderRadius: 8,
            padding: '0.5rem 0.75rem',
            fontSize: '0.87rem',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            border: m.role === 'tutor' ? '1px solid var(--border)' : 'none',
          }}>
            {m.content}
          </div>
        ))}

        {responseLoading && (
          <div style={{ alignSelf: 'flex-start', opacity: 0.35, fontSize: '0.83rem', fontStyle: 'italic' }}>
            Waiting for answer…
          </div>
        )}
        {loading && !responseLoading && (
          <div style={{ alignSelf: 'flex-start', opacity: 0.45, fontSize: '0.83rem', fontStyle: 'italic' }}>
            Thinking…
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        display: 'flex', gap: '0.5rem',
        padding: '0.6rem 0.75rem',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder="Ask the tutor anything…"
          rows={2}
          style={{
            flex: 1, padding: '0.45rem 0.65rem',
            border: '1px solid var(--border)', borderRadius: 7,
            background: 'var(--bg)', color: 'var(--text-h)',
            fontSize: '0.87rem', resize: 'none',
            fontFamily: 'var(--sans)', lineHeight: 1.5,
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: '0.45rem 0.8rem',
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', borderRadius: 7,
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.4 : 1,
            fontSize: '0.87rem', alignSelf: 'flex-end',
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
