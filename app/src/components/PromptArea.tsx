import React from 'react'

interface Props {
  query: string
  loading: boolean
  onQueryChange: (v: string) => void
  onSend: () => void
}

export function PromptArea({ query, loading, onQueryChange, onSend }: Props) {
  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) onSend()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <textarea
        value={query}
        onChange={e => onQueryChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="Your query…"
        rows={3}
        disabled={loading}
        style={{
          width: '100%', padding: '0.65rem 0.85rem',
          border: '1px solid var(--border)', borderRadius: 8,
          background: 'var(--bg)', color: 'var(--text-h)',
          fontSize: '0.92rem', resize: 'vertical',
          fontFamily: 'var(--sans)', lineHeight: 1.55, boxSizing: 'border-box',
          opacity: loading ? 0.6 : 1,
        }}
      />
      <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.4, textAlign: 'right' }}>
        ⌘/Ctrl+Enter to send
      </p>
    </div>
  )
}
