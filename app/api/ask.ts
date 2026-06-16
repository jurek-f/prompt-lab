export const config = { runtime: 'edge' }

type Provider = 'anthropic' | 'google' | 'openai'

function detectProvider(model: string): Provider {
  if (model.startsWith('claude')) return 'anthropic'
  if (model.startsWith('gemini')) return 'google'
  if (model.startsWith('gpt') || /^o\d/.test(model)) return 'openai'
  return 'anthropic'
}

const PROVIDER_DEFAULTS: Record<Provider, string> = {
  google: 'gemini-2.5-flash-lite',
  anthropic: 'claude-haiku-4-5-20251001',
  openai: 'gpt-4o-mini',
}

function pickProviderAndModel(
  requestedModel: string | undefined,
  keys: Record<string, string>
): { provider: Provider; model: string } {
  if (requestedModel) {
    const provider = detectProvider(requestedModel)
    return { provider, model: requestedModel }
  }
  // No model specified — pick whichever provider has a key, in priority order
  const priority: Provider[] = ['google', 'anthropic', 'openai']
  const provider = priority.find(p => !!keys[p]) ?? 'anthropic'
  return { provider, model: PROVIDER_DEFAULTS[provider] }
}

type Message = { role: 'user' | 'assistant'; content: string }

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  let rawUrl = (process.env.OVERHANG_URL ?? '').replace(/\/$/, '')
  if (rawUrl && !rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl
  if (!rawUrl) return json({ error: 'OVERHANG_URL not configured' }, 503)

  try {
    const body = await req.json() as {
      workspaceId: string
      model?: string
      systemPrompt?: string
      query?: string
      messages?: Message[]
      maxTokens?: number
    }
    const { workspaceId, model: requestedModel, systemPrompt, query, messages, maxTokens } = body
    if (!workspaceId || (!query && !messages?.length)) return json({ error: 'Missing workspaceId or query/messages' }, 400)
    const msgs: Message[] = messages?.length ? messages : [{ role: 'user', content: query! }]

    // Fetch all registered keys server-side — never touches the browser
    const keyRes = await fetch(`${rawUrl}/workspaces/${workspaceId}/lab/api-key`)
    if (!keyRes.ok) return json({ error: 'Could not retrieve session credentials' }, keyRes.status)
    const keys = await keyRes.json() as Record<string, string>

    const { provider, model } = pickProviderAndModel(requestedModel, keys)
    const apiKey = keys[provider]
    if (!apiKey) {
      return json({
        error: `No ${provider} API key registered for this session. In Claude Code, call list_models and pass your ${provider} key.`,
      }, 400)
    }
    const trimmedKey = apiKey.trim()

    const mx = maxTokens ?? 1024
    if (provider === 'anthropic') return await callAnthropic(trimmedKey, model, systemPrompt, msgs, mx)
    if (provider === 'google') return await callGoogle(trimmedKey, model, systemPrompt, msgs, mx)
    return await callOpenAI(trimmedKey, model, systemPrompt, msgs, mx)
  } catch (e) {
    return json({ error: `Ask failed: ${String(e)}` }, 502)
  }
}

async function callAnthropic(apiKey: string, model: string, system: string | undefined, messages: Message[], maxTokens: number): Promise<Response> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model, max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return json({ error: err.error?.message ?? `Anthropic error ${res.status}` }, res.status)
  }
  const result = await res.json() as { content: { type: string; text: string }[] }
  return json({ response: result.content.find(b => b.type === 'text')?.text ?? '' }, 200)
}

async function callGoogle(apiKey: string, model: string, system: string | undefined, messages: Message[], maxTokens: number): Promise<Response> {
  const chatMessages: { role: string; content: string }[] = []
  if (system) chatMessages.push({ role: 'system', content: system })
  chatMessages.push(...messages)
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({ model, messages: chatMessages, max_tokens: maxTokens }),
    }
  )
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const keyHint = `key=${apiKey.slice(0, 8)}…(len=${apiKey.length})`
    return json({ error: `Google error ${res.status} [${keyHint}]: ${text.slice(0, 200)}` }, res.status)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  return json({ response: data.choices?.[0]?.message?.content ?? '' }, 200)
}

async function callOpenAI(apiKey: string, model: string, system: string | undefined, messages: Message[], maxTokens: number): Promise<Response> {
  const chatMessages: { role: string; content: string }[] = []
  if (system) chatMessages.push({ role: 'system', content: system })
  chatMessages.push(...messages)
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: chatMessages, max_tokens: maxTokens }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } }
    return json({ error: err.error?.message ?? `OpenAI error ${res.status}` }, res.status)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[] }
  return json({ response: data.choices?.[0]?.message?.content ?? '' }, 200)
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
