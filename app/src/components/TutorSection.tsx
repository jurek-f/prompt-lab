import { useEffect, useRef, useState } from 'react'
import type { TutorMessage } from '../types'

interface Props {
  messages: TutorMessage[]
  onUserMessage: (text: string) => Promise<void>
  loading: boolean
  responseLoading?: boolean
}

export function TutorSection({ messages, onUserMessage, loading, responseLoading }: Props) {
  const [open, setOpen] = useState(true)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, open])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    await onUserMessage(text)
  }

  return (
    <div style={{
      border: '1px solid var(--accent-border)',
      borderRadius: 10,
      overflow: 'hidden',
      background: 'var(--accent-bg)',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '0.7rem 1rem',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          color: 'var(--accent)',
          fontSize: '0.88rem',
          fontWeight: 500,
        }}
      >
        <span>Tutor {responseLoading ? '· waiting for answer…' : loading ? '· thinking…' : ''}</span>
        <span style={{ opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--accent-border)', padding: '0.75rem 1rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem', maxHeight: 320, overflowY: 'auto' }}>
            {messages.length === 0 && (
              <p style={{ margin: 0, opacity: 0.5, fontSize: '0.85rem' }}>
                Tutor feedback will appear here after each run.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '90%',
                background: m.role === 'user' ? 'var(--accent)' : 'var(--bg)',
                color: m.role === 'user' ? '#fff' : 'var(--text)',
                borderRadius: 8,
                padding: '0.55rem 0.8rem',
                fontSize: '0.88rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                border: m.role === 'tutor' ? '1px solid var(--border)' : 'none',
              }}>
                {m.content}
              </div>
            ))}
            {responseLoading && (
              <div style={{ alignSelf: 'flex-start', opacity: 0.4, fontSize: '0.85rem', fontStyle: 'italic' }}>
                Waiting for answer…
              </div>
            )}
            {loading && !responseLoading && (
              <div style={{ alignSelf: 'flex-start', opacity: 0.5, fontSize: '0.85rem', fontStyle: 'italic' }}>
                Thinking…
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
              placeholder="Ask the tutor anything…"
              rows={2}
              style={{
                flex: 1,
                padding: '0.5rem 0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg)',
                color: 'var(--text-h)',
                fontSize: '0.88rem',
                resize: 'none',
                fontFamily: 'var(--sans)',
                lineHeight: 1.5,
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              style={{
                padding: '0.5rem 0.9rem',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading || !input.trim() ? 0.5 : 1,
                fontSize: '0.88rem',
                alignSelf: 'flex-end',
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
