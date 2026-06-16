function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/-$/, '')
}

function nowTs(): string {
  return new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-')
}

export function downloadExchange(exchange: unknown) {
  const ts = nowTs()
  downloadJson({ source: 'ui', exportedAt: ts, exchange }, `${ts}_ui_exchange.json`)
}

export function downloadSession(session: unknown, name: string) {
  const ts = nowTs()
  downloadJson({ source: 'ui', exportedAt: ts, session }, `${ts}_ui_session_${slugify(name)}.json`)
}

export function downloadSummaries(summaries: unknown) {
  const ts = nowTs()
  downloadJson({ source: 'ui', exportedAt: ts, summaries }, `${ts}_ui_summaries.json`)
}

export function downloadTestCases(testCases: unknown) {
  const ts = nowTs()
  downloadJson({ source: 'ui', exportedAt: ts, testCases }, `${ts}_ui_test_cases.json`)
}

export function downloadRegressionResults(
  testCases: Array<{ id: string; label: string; query: string; targetAnswer: string; passThreshold?: number }>,
  results: Record<string, { responseModel: string; response: string; score: { value: number; topic?: string; queryType?: string; reasoning: string; judgeModel: string } | null; error?: string }>,
  tutorAnalysis: string | null,
  systemPrompt: string,
) {
  const DEFAULT_THRESHOLD = 0.7
  const rows = testCases.map(tc => {
    const r = results[tc.id]
    if (!r) return null
    const score = r.score?.value ?? null
    return {
      label: tc.label,
      query: tc.query,
      targetAnswer: tc.targetAnswer,
      passThreshold: tc.passThreshold ?? DEFAULT_THRESHOLD,
      responseModel: r.responseModel,
      response: r.response,
      score,
      passed: score !== null && score >= (tc.passThreshold ?? DEFAULT_THRESHOLD),
      scoreTopic: r.score?.topic ?? null,
      scoreQueryType: r.score?.queryType ?? null,
      scoreReasoning: r.score?.reasoning ?? null,
      judgeModel: r.score?.judgeModel ?? null,
      error: r.error ?? null,
    }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const scores = rows.filter(r => r.score !== null).map(r => r.score as number)
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  const ts = nowTs()

  downloadJson({
    source: 'ui',
    exportedAt: ts,
    systemPrompt,
    summary: {
      total: rows.length,
      passed: rows.filter(r => r.passed).length,
      meanScore: mean !== null ? parseFloat(mean.toFixed(3)) : null,
    },
    tutorAnalysis: tutorAnalysis ?? null,
    results: rows,
  }, `${ts}_ui_regression.json`)
}
