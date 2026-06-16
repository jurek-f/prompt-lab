import { useState } from 'react'
import type { Exchange } from '../types'
import { ScoreBadge } from './ScoreBadge'
import { downloadExchange } from '../lib/download'

interface Props {
  exchange: Exchange
  index: number
}

export function ExchangeCard({ exchange, index }: Props) {
  const [promptOpen, setPromptOpen] = useState(index === 0)

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '0.9rem 1rem',
      background: 'var(--code-bg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.78rem', opacity: 0.45 }}>
          #{index + 1} · {new Date(exchange.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button
            onClick={() => setPromptOpen(o => !o)}
            style={chipBtn}
          >
            {promptOpen ? 'hide prompt' : 'show prompt'}
          </button>
          <button
            onClick={() => downloadExchange(exchange)}
            style={chipBtn}
            title="Download this exchange as JSON"
          >
            ↓ JSON
          </button>
        </div>
      </div>

      {promptOpen && (
        <pre style={{
          margin: '0 0 0.75rem',
          padding: '0.6rem 0.75rem',
          background: 'var(--bg)',
          borderRadius: 6,
          fontSize: '0.8rem',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily: 'var(--mono)',
          color: 'var(--text)',
          lineHeight: 1.5,
        }}>
          {exchange.prompt}
        </pre>
      )}

      <p style={{ margin: 0, lineHeight: 1.65, fontSize: '0.92rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {exchange.response}
      </p>

      {exchange.score && <ScoreBadge score={exchange.score} />}
    </div>
  )
}

const chipBtn: React.CSSProperties = {
  background: 'var(--code-bg)',
  border: '1px solid var(--border)',
  borderRadius: 5,
  padding: '0.15rem 0.5rem',
  fontSize: '0.75rem',
  cursor: 'pointer',
  color: 'var(--text)',
  lineHeight: 1.6,
}
