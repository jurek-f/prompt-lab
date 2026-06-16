import { useEffect, useState } from 'react'

interface TemplateEntry {
  id: string
  label: string
}

interface Props {
  systemPrompt: string
  onChange: (v: string) => void
}

export function SystemPromptPanel({ systemPrompt, onChange }: Props) {
  const [templates, setTemplates] = useState<TemplateEntry[]>([])
  const [selected, setSelected] = useState('')

  useEffect(() => {
    fetch('/data/system_prompts/index.json')
      .then(r => r.json())
      .then(setTemplates)
      .catch(() => {})
  }, [])

  function handleLoad(id: string) {
    if (!id) return
    setSelected(id)
    fetch(`/data/system_prompts/${id}.txt`)
      .then(r => r.text())
      .then(onChange)
      .catch(() => {})
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)', flex: 1 }}>
          System prompt
        </span>
        {templates.length > 0 && (
          <select
            value={selected}
            onChange={e => handleLoad(e.target.value)}
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
            {templates.map(t => (
              <option key={t.id} value={t.id}>{t.label}</option>
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
