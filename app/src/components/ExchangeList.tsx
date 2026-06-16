import type { Exchange } from '../types'
import { ExchangeCard } from './ExchangeCard'

interface Props {
  exchanges: Exchange[]
}

export function ExchangeList({ exchanges }: Props) {
  if (exchanges.length === 0) {
    return (
      <p style={{ opacity: 0.4, fontSize: '0.88rem', textAlign: 'center', padding: '2rem 0' }}>
        Send your first prompt to start.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {[...exchanges].reverse().map((ex, i) => (
        <ExchangeCard key={ex.id} exchange={ex} index={exchanges.length - 1 - i} />
      ))}
    </div>
  )
}
