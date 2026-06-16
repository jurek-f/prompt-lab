import { useEffect, useState } from 'react'
import type { ServerSystemPromptTemplate } from '../lib/overhang'

interface StaticEntry {
  id: string
  label: string
}

interface Props {
  systemPrompt: string
  onChange: (v: string) => void
  serverSystemPromptTemplates?: ServerSystemPromptTemplate[]
}

export function SystemPromptPanel({ systemPrompt, onChange, serverSystemPromptTemplates = [] }: Props) {
  const [staticTemplates, setStaticTemplates] = useState<StaticEntry[]>([])
  const [selected, setSelected] = useState('')

  useEffect(() => {
    fetch('/data/system_prompts/index.json')
      .then(r => r.json())
      .then(setStaticTemplates)
      .catch(() => {})
  }, [])

  const hasTemplates = staticTemplates.length > 0 || serverSystemPromptTemplates.length > 0

  function handleSelect(value: string) {
    if (!value) return
    setSelected(value)
    const [type, id] = value.split(':', 2)
    if (type === 'static') {
      fetch(`/data/system_prompts/${id}.txt`)
        .then(r => r.text())
        .then(onChange)
        .catch(() => {})
    } else {
      const tpl = serverSystemPromptTemplates.find(t => t.name === id)
      if (tpl) onChange(tpl.content)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)', flex: 1 }}>
          System prompt
        </span>
        {hasTemplates && (
          <select
            value={selected}
            onChange={e => handleSelect(e.target.value)}
            style={{
              fontSize: '0.75rem',
              padding: '0.2rem 0.4rem',
              border: '1px solid var(--border)',
              borderRadius: 5,
              background: 'var(--code-bg)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            <option value="" disabled>Load template…</option>
            {staticTemplates.length > 0 && serverSystemPromptTemplates.length > 0 && (
              <option disabled>── Built-in ──</option>
            )}
            {staticTemplates.map(t => (
              <option key={`static:${t.id}`} value={`static:${t.id}`}>{t.label}</option>
            ))}
            {serverSystemPromptTemplates.length > 0 && (
              <option disabled>── Agent ──</option>
            )}
            {serverSystemPromptTemplates.map(t => (
              <option key={`agent:${t.name}`} value={`agent:${t.name}`}>{t.name}</option>
            ))}
          </select>
        )}
      </div>
      <textarea
        value={systemPrompt}
        onChange={e => onChange(e.target.value)}
        placeholder={`System prompt. Use {QUERY} as a placeholder for the query (typed above), or leave it out to prepend this as a prefix.\n\nExample: You are a concise assistant. Answer in 2 sentences. {QUERY}`}
        rows={5}
        style={{
          width: '100%',
          padding: '0.65rem 0.85rem',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: 'var(--bg)',
          color: 'var(--text-h)',
          fontSize: '0.85rem',
          resize: 'vertical',
          fontFamily: 'var(--mono)',
          lineHeight: 1.55,
          boxSizing: 'border-box',
        }}
      />
    </div>
  )
}
