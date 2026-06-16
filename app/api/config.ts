export const config = { runtime: 'edge' }

export default function handler(req: Request): Response {
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 })
  }

  return new Response(
    JSON.stringify({
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      google: !!process.env.GEMINI_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  )
}
