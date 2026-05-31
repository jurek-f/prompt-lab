export const config = { runtime: 'edge' }

interface AnthropicStyleRequest {
  model: string
  system?: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  max_tokens: number
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body: AnthropicStyleRequest = await req.json()

  const messages: Array<{ role: string; content: string }> = []
  if (body.system) messages.push({ role: 'system', content: body.system })
  messages.push(...body.messages)

  let upstream: Response
  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: body.model,
        messages,
        max_tokens: body.max_tokens,
      }),
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: `Fetch failed: ${String(e)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const rawText = await upstream.text()

  if (!upstream.ok) {
    let errMsg = rawText
    try { errMsg = (JSON.parse(rawText) as { error?: { message?: string } }).error?.message ?? rawText } catch { /* keep raw */ }
    return new Response(JSON.stringify({ error: errMsg }), {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let data: { choices?: Array<{ message?: { content?: string } }> }
  try {
    data = JSON.parse(rawText)
  } catch {
    return new Response(JSON.stringify({ error: `Invalid JSON from OpenAI: ${rawText.slice(0, 200)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const text = data.choices?.[0]?.message?.content
  if (text == null) {
    return new Response(JSON.stringify({ error: `No content in OpenAI response: ${rawText.slice(0, 200)}` }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ content: [{ type: 'text', text }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
