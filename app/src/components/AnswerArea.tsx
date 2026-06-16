import { useState } from 'react'
import type { Exchange } from '../types'
import { ScoreBadge } from './ScoreBadge'
import { ExchangeCard } from './ExchangeCard'
import { downloadExchange } from '../lib/download'

interface Props {
  exchanges: Exchange[]
  loading: boolean
}

export function AnswerArea({ exchanges, loading }: Props) {
  const [pastOpen, setPastOpen] = useState(false)

  if (exchanges.length === 0) {
    if (!loading) return null
    return (
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '1.25rem 1rem',
        textAlign: 'center',
        opacity: 0.45,
        fontSize: '0.88rem',
      }}>
        Running…
      </div>
    )
  }

  const latest = exchanges[exchanges.length - 1]
  const past = exchanges.slice(0, -1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)' }}>Answer</span>
      <LatestCard exchange={latest} attemptNumber={exchanges.length} />

      {past.length > 0 && (
        <div style={{ borderBottom: '1px solid var(--border)' }}>
          <button
            onClick={() => setPastOpen(o => !o)}
            style={{
              width: '100%',
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
            <span>Past answers ({past.length})</span>
            <span>{pastOpen ? '▲' : '▼'}</span>
          </button>

          {pastOpen && (
            <div style={{ padding: '0.5rem 1rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[...past].reverse().map((ex, i) => (
                <ExchangeCard key={ex.id} exchange={ex} index={past.length - 1 - i} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LatestCard({ exchange, attemptNumber }: { exchange: Exchange; attemptNumber: number }) {
  const [promptOpen, setPromptOpen] = useState(false)

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 10,
      padding: '0.9rem 1rem',
      background: 'var(--code-bg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.78rem', opacity: 0.45 }}>
          #{attemptNumber} · {new Date(exchange.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button onClick={() => setPromptOpen(o => !o)} style={chipBtn}>
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
          background: 'var(--code-bg)',
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
