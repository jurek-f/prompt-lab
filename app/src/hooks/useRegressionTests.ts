import { useState, useCallback, useEffect } from 'react'
import type { TestCase, TestRunResult, Score, ModelKey } from '../types'
import { storage } from '../lib/storage'
import { callAnthropic } from '../lib/api'
import { MODELS } from '../types'
import { buildPrompt, buildJudgePrompt, parseJudgeResponse, buildRegressionAnalysisPrompt } from '../lib/prompts'

export function useRegressionTests(
  systemPrompt: string,
  responseModel: ModelKey,
  evalModel: ModelKey,
  tutorEnabled: boolean,
  ollamaResponseModel: string,
  ollamaEvalModel: string,
  ollamaBaseUrl: string,
  onTutorAnalysis?: (text: string) => void,
) {
  const [testCases, setTestCasesState] = useState<TestCase[]>(() => storage.getTestCases())
  const [results, setResults] = useState<Record<string, TestRunResult>>({})
  const [running, setRunning] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [tutorAnalysis, setTutorAnalysis] = useState<string | null>(null)
  const [tutorAnalysisLoading, setTutorAnalysisLoading] = useState(false)

  const responseModelId = MODELS[responseModel]
  const evalModelId = MODELS[evalModel]
  const ollamaResponseOpts = { ollamaModel: ollamaResponseModel, ollamaBaseUrl }
  const ollamaEvalOpts = { ollamaModel: ollamaEvalModel, ollamaBaseUrl }

  // Sync test cases to storage; kept outside state updaters so it runs once per commit
  useEffect(() => { storage.setTestCases(testCases) }, [testCases])

  const addTestCase = useCallback((tc: Omit<TestCase, 'id'>) => {
    setTestCasesState(prev => [...prev, { ...tc, id: crypto.randomUUID() }])
  }, [])

  const removeTestCase = useCallback((id: string) => {
    setTestCasesState(prev => prev.filter(tc => tc.id !== id))
    setResults(r => { const { [id]: _removed, ...rest } = r; return rest })
  }, [])

  const updateTestCase = useCallback((id: string, patch: Partial<Omit<TestCase, 'id'>>) => {
    setTestCasesState(prev => prev.map(tc => tc.id === id ? { ...tc, ...patch } : tc))
  }, [])

  const runTests = useCallback(async (cases: TestCase[]) => {
    if (running || cases.length === 0) return
    setRunning(true)
    setResults({})
    setTutorAnalysis(null)

    const finalResults: Record<string, TestRunResult> = {}

    for (const tc of cases) {
      setRunningId(tc.id)
      try {
        const prompt = buildPrompt(systemPrompt, tc.query)
        const response = await callAnthropic({
          model: responseModelId,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
          ...ollamaResponseOpts,
        })

        let score: Score | null = null
        if (tc.targetAnswer.trim()) {
          try {
            const judgeText = await callAnthropic({
              model: evalModelId,
              messages: [{ role: 'user', content: buildJudgePrompt(response, tc.targetAnswer, tc.query, systemPrompt) }],
              max_tokens: 256,
              ...ollamaEvalOpts,
            })
            const parsed = parseJudgeResponse(judgeText)
            if (parsed) {
              score = { value: parsed.value, topic: parsed.topic, queryType: parsed.queryType, reasoning: parsed.reasoning, judgeModel: evalModelId }
            }
          } catch {
            // judge failure is non-blocking
          }
        }

        finalResults[tc.id] = { testCaseId: tc.id, responseModel: responseModelId, response, score }
      } catch (err) {
        finalResults[tc.id] = { testCaseId: tc.id, responseModel: responseModelId, response: '', score: null, error: String(err) }
      }
      setResults(r => ({ ...r, [tc.id]: finalResults[tc.id] }))
    }

    setRunningId(null)
    setRunning(false)

    if (tutorEnabled && cases.length > 0) {
      setTutorAnalysisLoading(true)
      try {
        const analysis = await callAnthropic({
          model: evalModelId,
          messages: [{ role: 'user', content: buildRegressionAnalysisPrompt(systemPrompt, cases, finalResults) }],
          max_tokens: 1024,
          ...ollamaEvalOpts,
        })
        setTutorAnalysis(analysis)
        onTutorAnalysis?.(analysis)
      } catch {
        // non-blocking
      } finally {
        setTutorAnalysisLoading(false)
      }
    }
  }, [running, systemPrompt, responseModelId, evalModelId, tutorEnabled, onTutorAnalysis, ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl])

  const clearTestCases = useCallback(() => {
    setTestCasesState([])
    setResults({})
    setTutorAnalysis(null)
  }, [])

  return {
    testCases, results, running, runningId,
    tutorAnalysis, tutorAnalysisLoading,
    addTestCase, removeTestCase, updateTestCase, clearTestCases,
    runTests: (cases?: TestCase[]) => runTests(cases ?? testCases),
  }
}
