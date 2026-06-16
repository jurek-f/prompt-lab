import { useState, useCallback, useEffect, useRef } from 'react'
import type { TestCase, TestRunResult, Score, ModelKey } from '../types'
import { storage } from '../lib/storage'
import { callAnthropic } from '../lib/api'
import { MODELS } from '../types'
import { buildPrompt, buildJudgePrompt, parseJudgeResponse, buildRegressionAnalysisPrompt } from '../lib/prompts'
import { pushRegressionHistory } from '../lib/overhang'

interface WorkspaceOpts {
  workspaceId?: string | null
  workspaceResponseModel?: string
  workspaceEvalModel?: string
}

export function useRegressionTests(
  systemPrompt: string,
  responseModel: ModelKey,
  evalModel: ModelKey,
  tutorEnabled: boolean,
  ollamaResponseModel: string,
  ollamaEvalModel: string,
  ollamaBaseUrl: string,
  onTutorAnalysis?: (text: string) => void,
  ws: WorkspaceOpts = {},
  onRegressionPushed?: () => void,
) {
  const [testCases, setTestCasesState] = useState<TestCase[]>(() => storage.getTestCases())
  const [results, setResults] = useState<Record<string, TestRunResult>>({})
  const [running, setRunning] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [tutorAnalysis, setTutorAnalysis] = useState<string | null>(null)
  const [tutorAnalysisLoading, setTutorAnalysisLoading] = useState(false)

  const standaloneResponseModelId = MODELS[responseModel]
  const standaloneEvalModelId = MODELS[evalModel]
  const responseModelId = ws.workspaceId && ws.workspaceResponseModel ? ws.workspaceResponseModel : standaloneResponseModelId
  const evalModelId = ws.workspaceId && ws.workspaceEvalModel ? ws.workspaceEvalModel : standaloneEvalModelId
  const workspaceId = ws.workspaceId ?? null
  const ollamaResponseOpts = { ollamaModel: ollamaResponseModel, ollamaBaseUrl }
  const ollamaEvalOpts = { ollamaModel: ollamaEvalModel, ollamaBaseUrl }

  // Sync test cases to localStorage; skip initial mount
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    storage.setTestCases(testCases)
  }, [testCases])

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
          workspaceId,
          ...ollamaResponseOpts,
        })

        let score: Score | null = null
        if (tc.targetAnswer.trim()) {
          try {
            const judgeText = await callAnthropic({
              model: evalModelId,
              messages: [{ role: 'user', content: buildJudgePrompt(response, tc.targetAnswer, tc.query, systemPrompt) }],
              max_tokens: 256,
              workspaceId,
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

    let tutorAnalysisText: string | null = null
    if (tutorEnabled && cases.length > 0) {
      setTutorAnalysisLoading(true)
      try {
        const analysis = await callAnthropic({
          model: evalModelId,
          messages: [{ role: 'user', content: buildRegressionAnalysisPrompt(systemPrompt, cases, finalResults) }],
          max_tokens: 1024,
          workspaceId,
          ...ollamaEvalOpts,
        })
        tutorAnalysisText = analysis
        setTutorAnalysis(analysis)
        onTutorAnalysis?.(analysis)
      } catch {
        // non-blocking
      } finally {
        setTutorAnalysisLoading(false)
      }
    }

    if (workspaceId) {
      pushRegressionHistory(workspaceId, {
        systemPrompt,
        completedAt: new Date().toISOString(),
        testCases: cases.map(tc => ({ id: tc.id, query: tc.query, targetAnswer: tc.targetAnswer })),
        results: finalResults,
        tutorAnalysis: tutorAnalysisText,
      }).then(() => onRegressionPushed?.()).catch(() => {})
    }
  }, [running, systemPrompt, responseModelId, evalModelId, workspaceId, tutorEnabled, onTutorAnalysis, onRegressionPushed, ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl])

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
