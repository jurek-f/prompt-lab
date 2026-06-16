export const config = { runtime: 'edge' }

export default async function handler(req: Request): Promise<Response> {
  let rawUrl = (process.env.OVERHANG_URL ?? '').replace(/\/$/, '')
  if (rawUrl && !rawUrl.startsWith('http')) rawUrl = 'https://' + rawUrl
  const baseUrl = rawUrl
  const token = process.env.OVERHANG_TOKEN

  if (!baseUrl) {
    return json({ error: 'Relay not configured — set OVERHANG_URL in Vercel env vars' }, 503)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'X-Overhang-Token': token } : {}),
  }

  const url = new URL(req.url)

  try {
    if (req.method === 'GET') {
      const workspaceId = url.searchParams.get('s')
      const action = url.searchParams.get('action')

      // global endpoints — no workspaceId needed, check before the workspace guard
      if (action === 'templates') {
        const r = await fetch(`${baseUrl}/templates`, { headers })
        return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
      }
      if (action === 'system-prompt-templates') {
        const r = await fetch(`${baseUrl}/system-prompt-templates`, { headers })
        return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
      }

      if (!workspaceId) return json({ error: 'Missing workspace ID (?s=...)' }, 400)

      const actionPath: Record<string, string> = {
        'test-cases': 'lab/test-cases',
        'test-results': 'lab/test-results',
        'suggestions': 'lab/suggestions',
        'regression': 'lab/regression',
        'model': 'lab/model',
      }
      const subpath = action && actionPath[action] ? actionPath[action] : 'lab'
      const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/${subpath}`, { headers })
      return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
    }

    if (req.method === 'POST') {
      const body = await req.json() as { action: string; workspaceId?: string; [k: string]: unknown }
      const { action, workspaceId, ...data } = body

      // create-workspace is the only action that doesn't need a pre-existing workspaceId
      if (action === 'create-session') {
        const createRes = await fetch(`${baseUrl}/workspaces`, {
          method: 'POST', headers,
          body: JSON.stringify({ label: data.label ?? 'Prompt Lab' }),
        })
        if (!createRes.ok) return new Response(await createRes.text(), { status: createRes.status, headers: { 'Content-Type': 'application/json' } })
        const workspace = await createRes.json() as { workspaceId: string }
        const id = workspace.workspaceId
        await fetch(`${baseUrl}/workspaces/${id}/lab`, {
          method: 'POST', headers,
          body: JSON.stringify({ systemPrompt: data.systemPrompt ?? '' }),
        })
        const labUrl = `${process.env.PROMPT_LAB_URL?.replace(/\/$/, '') ?? ''}?s=${id}`
        return json({ workspaceId: id, url: labUrl }, 201)
      }

      if (!workspaceId) return json({ error: 'Missing workspaceId in body' }, 400)

      switch (action) {
        case 'init-lab': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab`, {
            method: 'POST', headers, body: JSON.stringify(data),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'set-prompt': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/system-prompt`, {
            method: 'PATCH', headers, body: JSON.stringify(data),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'sync-test-cases': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/test-cases?replace=true`, {
            method: 'POST', headers, body: JSON.stringify(data.testCases),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'set-active-input': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/active-input`, {
            method: 'PATCH', headers, body: JSON.stringify(data),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'post-result': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/test-results`, {
            method: 'POST', headers, body: JSON.stringify(data),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'suggestion-status': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/suggestions/${data.suggestionId}`, {
            method: 'PATCH', headers, body: JSON.stringify({ status: data.status }),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'set-model': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/model`, {
            method: 'PATCH', headers, body: JSON.stringify(data),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'post-tutor-message': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/tutor-messages`, {
            method: 'POST', headers, body: JSON.stringify(data),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'push-session-history': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/history/sessions`, {
            method: 'POST', headers, body: JSON.stringify(data.entry),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        case 'push-regression-history': {
          const r = await fetch(`${baseUrl}/workspaces/${workspaceId}/lab/history/regressions`, {
            method: 'POST', headers, body: JSON.stringify(data.entry),
          })
          return new Response(await r.text(), { status: r.status, headers: { 'Content-Type': 'application/json' } })
        }
        default:
          return json({ error: `Unknown action: ${action}` }, 400)
      }
    }

    return json({ error: 'Method not allowed' }, 405)
  } catch (e) {
    return json({ error: `Relay unreachable: ${String(e)}` }, 502)
  }
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
