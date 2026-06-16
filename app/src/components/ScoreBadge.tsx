import type { Score } from '../types'

interface Props {
  score: Score
}

function scoreColor(v: number): string {
  if (v >= 0.75) return '#22c55e'
  if (v >= 0.5) return '#f59e0b'
  return '#ef4444'
}

export function ScoreBadge({ score }: Props) {
  const color = scoreColor(score.value)
  return (
    <div style={{ marginTop: '0.6rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{
          fontFamily: 'var(--mono)',
          fontSize: '1rem',
          fontWeight: 600,
          color,
          letterSpacing: '-0.5px',
        }}>
          {score.value.toFixed(2)}
        </span>
        <span style={{ fontSize: '0.78rem', opacity: 0.5 }}>
          via {score.judgeModel.includes('sonnet') ? 'Sonnet' : score.judgeModel.includes('gemini') ? 'Flash' : 'Haiku'}
        </span>
      </div>
      <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', opacity: 0.7, lineHeight: 1.5 }}>
        {score.reasoning}
      </p>
    </div>
  )
}
