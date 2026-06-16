interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicCallOptions {
  model: string
  system?: string
  messages: AnthropicMessage[]
  max_tokens?: number
  ollamaBaseUrl?: string
  ollamaModel?: string
  workspaceId?: string | null
}

export async function callAnthropic(opts: AnthropicCallOptions): Promise<string> {
  if (opts.model === 'ollama') {
    const baseUrl = (opts.ollamaBaseUrl || 'http://localhost:11434').replace(/\/$/, '')
    const model = opts.ollamaModel || 'gemma3:1b'
    const messages: Array<{ role: string; content: string }> = []
    if (opts.system) messages.push({ role: 'system', content: opts.system })
    messages.push(...opts.messages)
    const res = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, max_tokens: opts.max_tokens ?? 1024 }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
      throw new Error(err.error?.message ?? `Ollama error ${res.status}`)
    }
    const data = await res.json() as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? ''
  }

  // Workspace mode: key lives on Railway, route through /api/ask
  if (opts.workspaceId) {
    const res = await fetch('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId: opts.workspaceId,
        messages: opts.messages,
        systemPrompt: opts.system,
        model: opts.model,
        maxTokens: opts.max_tokens ?? 1024,
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error ?? `API error ${res.status}`)
    }
    const data = await res.json() as { response: string }
    return data.response
  }

  const endpoint = opts.model.startsWith('gemini') ? '/api/google'
    : opts.model.startsWith('gpt') ? '/api/openai'
    : '/api/anthropic'
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: opts.model,
      system: opts.system,
      messages: opts.messages,
      max_tokens: opts.max_tokens ?? 1024,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `API error ${res.status}`)
  }

  const data = await res.json() as { content: Array<{ type: string; text: string }> }
  return data.content.filter(b => b.type === 'text').map(b => b.text).join('') || ''
}
