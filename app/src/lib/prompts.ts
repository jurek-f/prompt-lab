import type { Exchange, SessionSummary, TutorMessage, TestCase, TestRunResult, QueryType } from '../types'
import { QUERY_TYPES } from '../types'

export function buildPrompt(systemPrompt: string, query: string): string {
  if (!systemPrompt.trim()) return query
  if (systemPrompt.includes('{QUERY}')) return systemPrompt.replace('{QUERY}', query)
  return `${systemPrompt}\n\n${query}`
}

export function buildJudgePrompt(response: string, targetAnswer: string, query: string, systemPrompt: string): string {
  return `You are evaluating how well an AI response matches a target answer.

Query (sets the topic): ${query}

System prompt (describes the prompt strategy/style): ${systemPrompt || '(none)'}

Target answer: ${targetAnswer}

AI response: ${response}

Score the AI response from 0.0 to 1.0 where:
- 1.0 = perfectly matches the target in accuracy, completeness, and key concepts
- 0.0 = completely wrong or unrelated

Return ONLY a JSON object with no surrounding text:
{"score": 0.00, "topic": "2-4 word label for the subject matter tested (derived from the query)", "queryType": "one of: explain | generate | transform | extract | compare | reason | classify", "reasoning": "one sentence that characterises the system prompt approach and explains why the response did or did not match the target"}`
}

export function parseJudgeResponse(text: string): { value: number; topic?: string; queryType?: QueryType; reasoning: string } | null {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) return null
    const parsed = JSON.parse(match[0]) as { score?: number; topic?: string; queryType?: string; reasoning?: string }
    if (typeof parsed.score !== 'number' || typeof parsed.reasoning !== 'string') return null
    const qt = typeof parsed.queryType === 'string' && (QUERY_TYPES as readonly string[]).includes(parsed.queryType)
      ? parsed.queryType as QueryType
      : undefined
    return {
      value: Math.max(0, Math.min(1, parsed.score)),
      topic: typeof parsed.topic === 'string' ? parsed.topic : undefined,
      queryType: qt,
      reasoning: parsed.reasoning,
    }
  } catch {
    return null
  }
}

export function buildTutorSystemPrompt(
  pastSessions: SessionSummary[],
  targetAnswer: string,
  exchanges: Exchange[],
): string {
  const pastSection = pastSessions.length
    ? pastSessions.map((s, i) =>
        `Session ${i + 1} (${s.date}, "${s.name}"): ${s.summary}${s.scoreMin !== null ? ` Scores: ${s.scoreMin}–${s.scoreMax}.` : ''}`
      ).join('\n')
    : 'No past sessions yet.'

  const recentExchanges = exchanges.slice(-5)
  const exchangeSection = recentExchanges.map((e, i) => {
    const score = e.score ? ` [score: ${e.score.value.toFixed(2)}]` : ''
    return `Attempt ${i + 1}${score}:\nPrompt: ${e.prompt}\nResponse: ${e.response}`
  }).join('\n\n')

  return `You are a prompt engineering coach inside Prompt Lab, a browser-based practice tool for iterative prompt engineering.

App structure the learner is working in:
- SYSTEM PROMPT field: a reusable template. Supports {QUERY} as a placeholder for the query; without it the system prompt is prepended as a prefix. This is the main thing the learner is tuning.
- QUERY field: the actual question or instruction sent per attempt. Sets the topic and task type.
- ANSWER: the model's response to the combined system prompt + query.
- TARGET ANSWER: the ideal response. When set, an LLM-as-judge scores each attempt 0.0–1.0 automatically.
- SESSION: the learner names their session, downloads it, or archives it as a summary to carry insight forward.
- REGRESSION PANEL: define multiple test cases (each with a query + target answer) and run them all against the current system prompt at once — useful for checking that an improvement on one query doesn't break others.
- TUTOR (you): activated per session. You see the last 5 attempts and past session summaries. The learner can also chat with you directly.

Available models (learner can switch):
- Response model: Haiku (fast/cheap), Sonnet (capable), Flash (Gemini, fast).
- Evaluation model (scores answers): same options. Haiku is the default judge.

Scoring: LLM-as-judge, 0.0–1.0. Each score summary names the topic, the system prompt style, and why the response did or did not match the target.

Your job after each attempt:
1. Diagnose the single most important limiting factor in the current prompt
2. Name the underlying principle in one sentence
3. Give exactly one concrete, specific next step (not a list)

Rules:
- Always quote specific text from the actual prompt — never give abstract advice
- One paragraph only after each run
- When referencing past sessions, name them explicitly: "In your session on [date]..."
- Be a teacher, not a critic. Frame gaps as opportunities.
- If score variance looks like noise (score changed without prompt change), say so explicitly.
- If the task seems too hard for Haiku, flag it honestly and suggest switching the response model.
- When relevant, reference Prompt Lab features: suggest running regression tests, switching the eval model, using {QUERY} in the system prompt, or archiving the session.

Past session history:
${pastSection}

Current session target answer: ${targetAnswer || '(no target answer set — scoring unavailable)'}

Current session attempts so far:
${exchangeSection || '(none yet)'}`
}

export function buildTutorMessages(
  chat: TutorMessage[],
  newUserMessage?: string,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  const msgs = chat.map(m => ({
    role: m.role === 'tutor' ? ('assistant' as const) : ('user' as const),
    content: m.content,
  }))
  if (newUserMessage) msgs.push({ role: 'user', content: newUserMessage })
  return msgs
}

export function buildSummarizationPrompt(
  sessionName: string,
  targetAnswer: string,
  exchanges: Exchange[],
): string {
  const scored = exchanges.filter(e => e.score !== null)
  const scores = scored.map(e => e.score!.value)
  const scoreInfo = scores.length
    ? `Scores ranged from ${Math.min(...scores).toFixed(2)} to ${Math.max(...scores).toFixed(2)}.`
    : 'No scoring was used in this session.'

  const attempts = exchanges.map((e, i) => {
    const score = e.score ? ` (score: ${e.score.value.toFixed(2)})` : ''
    return `Attempt ${i + 1}${score}: ${e.prompt.slice(0, 200)}`
  }).join('\n')

  return `Summarize this prompt engineering practice session in 2–3 sentences.

Session: "${sessionName}"
Target answer: ${targetAnswer || '(none)'}
${scoreInfo}

Attempts:
${attempts}

Focus on: what techniques improved the score most, what didn't work, one key insight to carry forward.
Write in past tense. Be specific about what changed between attempts.`
}

export function buildRegressionAnalysisPrompt(
  systemPrompt: string,
  testCases: TestCase[],
  results: Record<string, TestRunResult>,
): string {
  const DEFAULT_THRESHOLD = 0.7
  const rows = testCases.map(tc => {
    const r = results[tc.id]
    if (!r) return null
    const score = r.score?.value ?? null
    const passed = score !== null && score >= (tc.passThreshold ?? DEFAULT_THRESHOLD)
    return { tc, r, score, passed }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const scores = rows.filter(x => x.score !== null).map(x => x.score as number)
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const passCount = rows.filter(x => x.passed).length

  // Build per-queryType pass/fail summary for pattern analysis
  const byType: Record<string, { pass: number; total: number }> = {}
  for (const x of rows) {
    const qt = x.r.score?.queryType ?? 'unknown'
    if (!byType[qt]) byType[qt] = { pass: 0, total: 0 }
    byType[qt].total++
    if (x.passed) byType[qt].pass++
  }
  const typeBreakdown = Object.entries(byType)
    .map(([qt, s]) => `${qt}: ${s.pass}/${s.total} passed`)
    .join(', ')

  const resultLines = rows.map((x, i) => {
    const label = x.tc.label || x.tc.query.slice(0, 50)
    const status = x.r.error ? 'ERROR' : x.passed ? 'PASS' : 'FAIL'
    const scoreStr = x.score !== null ? x.score.toFixed(2) : 'n/a'
    const meta = [x.r.score?.queryType, x.r.score?.topic].filter(Boolean).join(' · ')
    return `Test ${i + 1} [${status} ${scoreStr}]${meta ? ` (${meta})` : ''} "${label}"
Query: ${x.tc.query}
Target: ${x.tc.targetAnswer}
Response: ${x.r.response.slice(0, 400)}${x.r.response.length > 400 ? '…' : ''}${x.r.score?.reasoning ? `\nJudge reasoning: ${x.r.score.reasoning}` : ''}`
  }).join('\n\n')

  return `You are analyzing regression test results for a system prompt.

System prompt under test:
${systemPrompt || '(none)'}

Summary: ${passCount}/${rows.length} passed${mean !== null ? `, mean score ${mean.toFixed(2)}` : ''}
By query type: ${typeBreakdown || 'n/a'}

${resultLines}

Analyze these results in three parts:
1. Overall performance (pass rate and mean score in one sentence)
2. Patterns — use the query type and topic labels to name which categories the prompt handles well vs. poorly; be specific about which query types fail
3. One or two specific, actionable changes to the system prompt that would most improve the failures — quote the relevant test labels

Be concise and direct. One short paragraph per part.`
}
