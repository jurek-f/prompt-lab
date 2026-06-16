/**
 * Local development API server — mirrors the Vercel edge functions.
 * No Vercel CLI needed. Requires Node 18+ (built-in fetch).
 *
 * Usage:  node scripts/local-api.mjs
 * Keys:   set as system environment variables before running.
 */

import http from 'http'

const PORT = 3000

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const GEMINI_API_KEY    = process.env.GEMINI_API_KEY
const OPENAI_API_KEY    = process.env.OPENAI_API_KEY

// ── helpers ──────────────────────────────────────────────────────────────────

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = ''
    req.on('data', chunk => { raw += chunk })
    req.on('end', () => { try { resolve(JSON.parse(raw)) } catch { reject(new Error('Invalid JSON')) } })
    req.on('error', reject)
  })
}

// ── handlers ─────────────────────────────────────────────────────────────────

function handleConfig(res) {
  json(res, 200, {
    anthropic: !!ANTHROPIC_API_KEY,
    google:    !!GEMINI_API_KEY,
    openai:    !!OPENAI_API_KEY,
  })
}

async function handleAnthropic(req, res) {
  if (!ANTHROPIC_API_KEY) return json(res, 500, { error: 'ANTHROPIC_API_KEY not set' })
  const body = await readBody(req).catch(() => null)
  if (!body) return json(res, 400, { error: 'Invalid request body' })

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })
    const text = await upstream.text()
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' })
    res.end(text)
  } catch (e) {
    json(res, 502, { error: `Fetch failed: ${e}` })
  }
}

async function handleGoogle(req, res) {
  if (!GEMINI_API_KEY) return json(res, 500, { error: 'GEMINI_API_KEY not set' })
  const body = await readBody(req).catch(() => null)
  if (!body) return json(res, 400, { error: 'Invalid request body' })

  const messages = []
  if (body.system) messages.push({ role: 'system', content: body.system })
  messages.push(...body.messages)

  try {
    const upstream = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GEMINI_API_KEY}`,
        },
        body: JSON.stringify({ model: body.model, messages, max_tokens: body.max_tokens }),
      }
    )
    const text = await upstream.text()
    if (!upstream.ok) return json(res, upstream.status, { error: text })

    const data = JSON.parse(text)
    const raw = data.choices?.[0]?.message?.content
    const content = raw == null ? '' : typeof raw === 'string'
      ? raw
      : raw.filter(p => p.type === 'text').map(p => p.text ?? '').join('')

    json(res, 200, { content: [{ type: 'text', text: content }] })
  } catch (e) {
    json(res, 502, { error: `Fetch failed: ${e}` })
  }
}

async function handleOpenAI(req, res) {
  if (!OPENAI_API_KEY) return json(res, 500, { error: 'OPENAI_API_KEY not set' })
  const body = await readBody(req).catch(() => null)
  if (!body) return json(res, 400, { error: 'Invalid request body' })

  const messages = []
  if (body.system) messages.push({ role: 'system', content: body.system })
  messages.push(...body.messages)

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({ model: body.model, messages, max_tokens: body.max_tokens }),
    })
    const text = await upstream.text()
    if (!upstream.ok) {
      let errMsg = text
      try { errMsg = JSON.parse(text).error?.message ?? text } catch { /* keep raw */ }
      return json(res, upstream.status, { error: errMsg })
    }
    const data = JSON.parse(text)
    const content = data.choices?.[0]?.message?.content ?? ''
    json(res, 200, { content: [{ type: 'text', text: content }] })
  } catch (e) {
    json(res, 502, { error: `Fetch failed: ${e}` })
  }
}

// ── server ────────────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

  const path = (req.url ?? '').split('?')[0]

  if (path === '/api/config'    && req.method === 'GET')  return handleConfig(res)
  if (path === '/api/anthropic' && req.method === 'POST') return handleAnthropic(req, res)
  if (path === '/api/google'    && req.method === 'POST') return handleGoogle(req, res)
  if (path === '/api/openai'    && req.method === 'POST') return handleOpenAI(req, res)

  res.writeHead(404); res.end()
})

server.listen(PORT, () => {
  console.log(`\nLocal API server → http://localhost:${PORT}`)
  console.log(`  ANTHROPIC_API_KEY  ${ANTHROPIC_API_KEY ? '✓' : '✗  (Claude models unavailable)'}`)
  console.log(`  GEMINI_API_KEY     ${GEMINI_API_KEY    ? '✓' : '✗  (Gemini models unavailable)'}`)
  console.log(`  OPENAI_API_KEY     ${OPENAI_API_KEY    ? '✓' : '✗  (GPT models unavailable)'}`)
  console.log()
})
