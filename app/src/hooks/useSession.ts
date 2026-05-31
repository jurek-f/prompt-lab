import { useState, useCallback } from 'react'
import type { Session, SessionSummary, Settings, Exchange, TutorMessage, ModelKey } from '../types'
import { storage } from '../lib/storage'
import { callAnthropic } from '../lib/api'
import { MODELS } from '../types'
import {
  buildPrompt, buildJudgePrompt, parseJudgeResponse,
  buildTutorSystemPrompt, buildTutorMessages, buildSummarizationPrompt,
} from '../lib/prompts'

function newSession(modelId: string): Session {
  return {
    id: `sess_${Date.now()}`,
    name: '',
    startedAt: new Date().toISOString(),
    targetAnswer: '',
    judgeModel: modelId,
    tutorEnabled: false,
    exchanges: [],
    tutorChat: [],
  }
}

export function useSession() {
  const [responseModel, setResponseModelState] = useState<ModelKey>(
    () => storage.getSettings().responseModel
  )
  const [evalModel, setEvalModelState] = useState<ModelKey>(
    () => storage.getSettings().evalModel
  )
  const [ollamaResponseModel, setOllamaResponseModelState] = useState<string>(
    () => storage.getSettings().ollamaResponseModel
  )
  const [ollamaEvalModel, setOllamaEvalModelState] = useState<string>(
    () => storage.getSettings().ollamaEvalModel
  )
  const [ollamaBaseUrl, setOllamaBaseUrlState] = useState<string>(
    () => storage.getSettings().ollamaBaseUrl
  )
  const responseModelId = MODELS[responseModel]
  const evalModelId = MODELS[evalModel]
  const ollamaResponseOpts = { ollamaModel: ollamaResponseModel, ollamaBaseUrl }
  const ollamaEvalOpts = { ollamaModel: ollamaEvalModel, ollamaBaseUrl }

  const setResponseModel = useCallback((key: ModelKey) => {
    setResponseModelState(key)
    const s = storage.getSettings()
    storage.setSettings({ ...s, responseModel: key })
  }, [])

  const setEvalModel = useCallback((key: ModelKey) => {
    setEvalModelState(key)
    const s = storage.getSettings()
    storage.setSettings({ ...s, evalModel: key })
  }, [])

  const setOllamaResponseModel = useCallback((v: string) => {
    setOllamaResponseModelState(v)
    const s = storage.getSettings()
    storage.setSettings({ ...s, ollamaResponseModel: v })
  }, [])

  const setOllamaEvalModel = useCallback((v: string) => {
    setOllamaEvalModelState(v)
    const s = storage.getSettings()
    storage.setSettings({ ...s, ollamaEvalModel: v })
  }, [])

  const setOllamaBaseUrl = useCallback((v: string) => {
    setOllamaBaseUrlState(v)
    const s = storage.getSettings()
    storage.setSettings({ ...s, ollamaBaseUrl: v })
  }, [])

  const [session, setSessionState] = useState<Session>(() => {
    const saved = storage.getSession()
    return saved ?? newSession(MODELS.haiku)
  })
  const [pastSessions, setPastSessionsState] = useState<SessionSummary[]>(
    () => storage.getPastSessions()
  )
  const [loading, setLoading] = useState(false)
  const [tutorLoading, setTutorLoading] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  function updateSession(updated: Session) {
    setSessionState(updated)
    storage.setSession(updated)
  }

  function updatePastSessions(list: SessionSummary[]) {
    setPastSessionsState(list)
    storage.setPastSessions(list)
  }

  const setTarget = useCallback((v: string) => {
    updateSession({ ...session, targetAnswer: v })
  }, [session])

  const setName = useCallback((v: string) => {
    updateSession({ ...session, name: v })
  }, [session])

  const setTutorEnabled = useCallback((v: boolean) => {
    updateSession({ ...session, tutorEnabled: v })
  }, [session])

  const clearSession = useCallback(() => {
    const fresh = newSession(responseModelId)
    fresh.tutorEnabled = session.tutorEnabled
    updateSession(fresh)
  }, [session.tutorEnabled])

  const sendPrompt = useCallback(async (systemPrompt: string, query: string, _settings: Settings) => {
    if (loading) return
    setLoading(true)
    setSendError(null)

    try {
      const prompt = buildPrompt(systemPrompt, query)
      const sessionName = session.name || query.slice(0, 60)

      const response = await callAnthropic({
        model: responseModelId,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 4096,
        ...ollamaResponseOpts,
      })

      let score: Exchange['score'] = null
      if (session.targetAnswer.trim()) {
        try {
          const judgeText = await callAnthropic({
            model: evalModelId,
            messages: [{ role: 'user', content: buildJudgePrompt(response, session.targetAnswer, query, systemPrompt) }],
            max_tokens: 256,
            ...ollamaEvalOpts,
          })
          const parsed = parseJudgeResponse(judgeText)
          if (parsed) {
            score = { value: parsed.value, topic: parsed.topic, queryType: parsed.queryType, reasoning: parsed.reasoning, judgeModel: evalModelId }
          }
        } catch {
          // Score failed silently — don't block the exchange
        }
      }

      const exchange: Exchange = {
        id: `exch_${Date.now()}`,
        timestamp: new Date().toISOString(),
        responseModel: responseModelId,
        systemPrompt,
        query,
        prompt,
        response,
        score,
        tutorMessage: null,
      }

      const updatedExchanges = [...session.exchanges, exchange]
      const updatedSession: Session = {
        ...session,
        name: sessionName,
        judgeModel: evalModelId,
        exchanges: updatedExchanges,
      }

      // Save answer immediately so it's visible before tutor starts
      updateSession(updatedSession)

      if (session.tutorEnabled) {
        // Increment tutorSessionsUsed on first tutored exchange
        if (session.exchanges.length === 0) {
          const s = storage.getSettings()
          storage.setSettings({ ...s, tutorSessionsUsed: s.tutorSessionsUsed + 1 })
        }

        setTutorLoading(true)
        try {
          const existingChat = session.tutorChat
          const tutorSystem = buildTutorSystemPrompt(pastSessions, session.targetAnswer, updatedExchanges)
          const tutorResponse = await callAnthropic({
            model: evalModelId,
            system: tutorSystem,
            messages: buildTutorMessages(existingChat, `I just sent attempt #${updatedExchanges.length}. Please give me your feedback.`),
            max_tokens: 1024,
            ...ollamaEvalOpts,
          })
          const tutorMsg: TutorMessage = {
            role: 'tutor',
            content: tutorResponse,
            timestamp: new Date().toISOString(),
          }
          updateSession({
            ...updatedSession,
            tutorChat: [...existingChat, tutorMsg],
            exchanges: updatedExchanges.map((ex, i) =>
              i === updatedExchanges.length - 1 ? { ...ex, tutorMessage: tutorResponse } : ex
            ),
          })
        } catch {
          // Tutor failure is non-blocking
        } finally {
          setTutorLoading(false)
        }
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [session, pastSessions, loading, responseModelId, evalModelId, ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl])

  const addTutorMessage = useCallback((content: string) => {
    const msg: TutorMessage = { role: 'tutor', content, timestamp: new Date().toISOString() }
    setSessionState(prev => {
      const updated = { ...prev, tutorChat: [...prev.tutorChat, msg] }
      storage.setSession(updated)
      return updated
    })
  }, [])

  const sendTutorMessage = useCallback(async (text: string) => {
    if (tutorLoading) return
    setTutorLoading(true)

    const userMsg: TutorMessage = { role: 'user', content: text, timestamp: new Date().toISOString() }
    const updatedChat = [...session.tutorChat, userMsg]
    updateSession({ ...session, tutorChat: updatedChat })

    try {
      const tutorSystem = buildTutorSystemPrompt(pastSessions, session.targetAnswer, session.exchanges)
      const tutorResponse = await callAnthropic({
        model: evalModelId,
        system: tutorSystem,
        messages: buildTutorMessages(updatedChat),
        max_tokens: 1024,
        ...ollamaEvalOpts,
      })
      const tutorMsg: TutorMessage = {
        role: 'tutor',
        content: tutorResponse,
        timestamp: new Date().toISOString(),
      }
      updateSession({ ...session, tutorChat: [...updatedChat, tutorMsg] })
    } catch {
      // Non-blocking
    } finally {
      setTutorLoading(false)
    }
  }, [session, pastSessions, tutorLoading, evalModelId, ollamaEvalModel, ollamaBaseUrl])

  const summarizeAndStartNew = useCallback(async () => {
    setSummarizing(true)
    try {
      const summaryText = await callAnthropic({
        model: evalModelId,
        messages: [{
          role: 'user',
          content: buildSummarizationPrompt(session.name, session.targetAnswer, session.exchanges),
        }],
        max_tokens: 300,
        ...ollamaEvalOpts,
      })

      const scores = session.exchanges.flatMap(e => e.score ? [e.score.value] : [])
      const bestExchange = session.exchanges
        .filter(e => e.score !== null)
        .sort((a, b) => b.score!.value - a.score!.value)[0]
      const summary: SessionSummary = {
        id: session.id,
        name: session.name || 'Untitled session',
        date: new Date().toISOString().slice(0, 10),
        exchangeCount: session.exchanges.length,
        targetAnswer: session.targetAnswer,
        scoreMin: scores.length ? Math.min(...scores) : null,
        scoreMax: scores.length ? Math.max(...scores) : null,
        scoreMaxQuery: bestExchange?.query,
        summary: summaryText.trim(),
      }

      const updated = [summary, ...pastSessions].slice(0, 10)
      updatePastSessions(updated)

      const fresh = newSession(responseModelId)
      fresh.tutorEnabled = session.tutorEnabled
      updateSession(fresh)
    } finally {
      setSummarizing(false)
    }
  }, [session, pastSessions, evalModelId, ollamaEvalModel, ollamaBaseUrl])

  const clearPastSessions = useCallback(() => {
    updatePastSessions([])
  }, [])

  return {
    session, pastSessions, loading, tutorLoading, summarizing, sendError,
    responseModel, setResponseModel, evalModel, setEvalModel,
    ollamaResponseModel, setOllamaResponseModel, ollamaEvalModel, setOllamaEvalModel, ollamaBaseUrl, setOllamaBaseUrl,
    setTarget, setName, setTutorEnabled, clearSession, clearPastSessions,
    sendPrompt, sendTutorMessage, addTutorMessage, summarizeAndStartNew,
  }
}
