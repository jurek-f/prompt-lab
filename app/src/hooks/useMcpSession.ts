import { useCallback, useEffect, useRef, useState } from 'react'
import type { TestCase } from '../types'
import {
  createSession as apiCreateSession,
  getLabState,
  initLab,
  setSystemPrompt,
  syncTestCases,
  getSuggestions,
  getRegressionStatus,
  approveSuggestion,
  rejectSuggestion,
  setSelectedModel as apiSetSelectedModel,
  postTutorMessage as apiPostTutorMessage,
  getServerTemplates,
  getServerSystemPromptTemplates,
} from '../lib/overhang'
import type { LabSuggestion, LabRegressionStatus, LabTutorMessage, ServerTemplate, ServerSystemPromptTemplate } from '../lib/overhang'

const POLL_INTERVAL_MS = 5000

export type TemplateTestCase = { query: string; targetAnswer?: string; queryType?: string }

export interface McpSessionState {
  workspaceId: string | null
  connected: boolean
  checking: boolean
  hasApiKey: boolean
  hasApiKeys: { anthropic: boolean; google: boolean; openai: boolean }
  suggestions: LabSuggestion[]
  regressionStatus: LabRegressionStatus | null
  agentSystemPrompt: string | null
  uiSystemPrompt: string | null
  agentHasWrittenSystemPrompt: boolean
  agentActiveQuery: string | null
  agentActiveTarget: string | null
  templateTestCases: TemplateTestCase[]
  serverTemplates: ServerTemplate[]
  serverSystemPromptTemplates: ServerSystemPromptTemplate[]
  availableModels: string[]
  selectedModel: string
  tutorMessages: LabTutorMessage[]
  syncing: boolean
  syncError: string | null
  createSession: (systemPrompt: string) => Promise<void>
  connectToSession: (id: string) => Promise<void>
  initLab: (systemPrompt: string) => Promise<void>
  clearSession: () => void
  syncTestCasesToMcp: (testCases: TestCase[]) => Promise<void>
  pushSystemPromptToMcp: (prompt: string) => Promise<void>
  approveSuggestion: (id: string) => Promise<string | null>
  rejectSuggestion: (id: string) => Promise<void>
  setSelectedModel: (model: string) => Promise<void>
  postTutorMessage: (content: string) => Promise<void>
}

function getUrlWorkspaceId(): string | null {
  if (typeof window === 'undefined') return null
  return new URLSearchParams(window.location.search).get('s')
}

function setUrlWorkspaceId(id: string) {
  const url = new URL(window.location.href)
  url.searchParams.set('s', id)
  window.history.pushState({}, '', url.toString())
}

export function useMcpSession(): McpSessionState {
  const [workspaceId, setWorkspaceId] = useState<string | null>(getUrlWorkspaceId)
  const [connected, setConnected] = useState(false)
  const [checking, setChecking] = useState(!!getUrlWorkspaceId())
  const [hasApiKey, setHasApiKey] = useState(false)
  const noKeys = { anthropic: false, google: false, openai: false }
  const [hasApiKeys, setHasApiKeys] = useState(noKeys)
  const [suggestions, setSuggestions] = useState<LabSuggestion[]>([])
  const [regressionStatus, setRegressionStatus] = useState<LabRegressionStatus | null>(null)
  const [agentSystemPrompt, setAgentSystemPrompt] = useState<string | null>(null)
  const [uiSystemPrompt, setUiSystemPrompt] = useState<string | null>(null)
  const [agentHasWrittenSystemPrompt, setAgentHasWrittenSystemPrompt] = useState(false)
  const [agentActiveQuery, setAgentActiveQuery] = useState<string | null>(null)
  const [agentActiveTarget, setAgentActiveTarget] = useState<string | null>(null)
  const [templateTestCases, setTemplateTestCases] = useState<TemplateTestCase[]>([])
  const lastTemplateCaseIdsRef = useRef('')
  const [serverTemplates, setServerTemplates] = useState<ServerTemplate[]>([])
  const [serverSystemPromptTemplates, setServerSystemPromptTemplates] = useState<ServerSystemPromptTemplate[]>([])
  const [availableModels, setAvailableModels] = useState<string[]>([])
  const [selectedModel, setSelectedModelState] = useState<string>('')
  const [tutorMessages, setTutorMessages] = useState<LabTutorMessage[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState<string | null>(null)
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Check connectivity on workspaceId change
  useEffect(() => {
    if (!workspaceId) {
      setChecking(false); setConnected(false); setHasApiKey(false); setHasApiKeys(noKeys)
      lastTemplateCaseIdsRef.current = ''
      // Don't clear templates — they're global and should persist across workspace changes
      return
    }
    setChecking(true)

    function applyLab(lab: Awaited<ReturnType<typeof getLabState>>) {
      setConnected(true)
      setHasApiKey(!!lab.hasApiKey)
      setHasApiKeys(lab.hasApiKeys ?? noKeys)
      setAgentSystemPrompt(lab.systemPrompt)
      setUiSystemPrompt(lab.uiSystemPrompt ?? lab.systemPrompt)
      setAgentHasWrittenSystemPrompt(!!lab.agentHasWrittenSystemPrompt)
      setAgentActiveQuery(lab.agentActiveQuery ?? null)
      setAgentActiveTarget(lab.agentActiveTarget ?? null)
      setAvailableModels(lab.availableModels ?? [])
      setSelectedModelState(lab.selectedModel ?? '')
      setTutorMessages(lab.tutorMessages ?? [])
      // Load all server test cases as templates — UI never pushes test cases, so server is agent-authoritative
      const allCases = lab.testCases ?? []
      if (allCases.length > 0) {
        const idsKey = allCases.map(tc => tc.id).join(',')
        if (idsKey !== lastTemplateCaseIdsRef.current) {
          lastTemplateCaseIdsRef.current = idsKey
          setTemplateTestCases(allCases.map(tc => ({
            query: tc.query,
            targetAnswer: tc.targetAnswer,
            queryType: tc.queryType,
          })))
        }
      }
    }

    getLabState(workspaceId)
      .then(applyLab)
      .catch(async () => {
        // Workspace may have been wiped by a server restart — try to re-initialise it
        try {
          await initLab(workspaceId, '')
          const lab = await getLabState(workspaceId)
          applyLab(lab)
        } catch {
          setConnected(false); setHasApiKey(false)
        }
      })
      .finally(() => setChecking(false))
  }, [workspaceId])

  // Poll global templates independently — no workspace needed, runs always
  useEffect(() => {
    let cancelled = false
    async function fetchTemplates() {
      const [templates, syspTemplates] = await Promise.all([
        getServerTemplates().catch(() => [] as ServerTemplate[]),
        getServerSystemPromptTemplates().catch(() => [] as ServerSystemPromptTemplate[]),
      ])
      if (cancelled) return
      if (templates.length > 0) setServerTemplates(templates)
      if (syspTemplates.length > 0) setServerSystemPromptTemplates(syspTemplates)
    }
    fetchTemplates()
    const tid = setInterval(fetchTemplates, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(tid) }
  }, [])

  // Poll while connected
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current)
    if (!connected || !workspaceId) return
    let cancelled = false

    async function poll() {
      if (!workspaceId) return
      try {
        const [allSuggestions, regression, lab, templates, syspTemplates] = await Promise.all([
          getSuggestions(workspaceId),
          getRegressionStatus(workspaceId).catch(() => null),
          getLabState(workspaceId),
          getServerTemplates().catch(() => [] as ServerTemplate[]),
          getServerSystemPromptTemplates().catch(() => [] as ServerSystemPromptTemplate[]),
        ])
        if (cancelled) return
        setSuggestions(allSuggestions.filter(s => s.status === 'pending'))
        if (regression) setRegressionStatus(regression)
        setAgentSystemPrompt(lab.systemPrompt)
        setUiSystemPrompt(lab.uiSystemPrompt ?? lab.systemPrompt)
        setAgentHasWrittenSystemPrompt(!!lab.agentHasWrittenSystemPrompt)
        setAgentActiveQuery(lab.agentActiveQuery ?? null)
        setAgentActiveTarget(lab.agentActiveTarget ?? null)
        setAvailableModels(lab.availableModels ?? [])
        setSelectedModelState(lab.selectedModel ?? '')
        setTutorMessages(lab.tutorMessages ?? [])
        setHasApiKey(!!lab.hasApiKey)
        setHasApiKeys(lab.hasApiKeys ?? noKeys)
        setServerTemplates(templates)
        setServerSystemPromptTemplates(syspTemplates)
        const allCases = (lab.testCases ?? []) as { id: string; query: string; targetAnswer?: string; queryType?: string }[]
        if (allCases.length > 0) {
          const idsKey = allCases.map(tc => tc.id).join(',')
          if (idsKey !== lastTemplateCaseIdsRef.current) {
            lastTemplateCaseIdsRef.current = idsKey
            setTemplateTestCases(allCases.map(tc => ({
              query: tc.query,
              targetAnswer: tc.targetAnswer,
              queryType: tc.queryType,
            })))
          }
        }
      } catch { /* network hiccup */ }
    }

    poll()
    pollingRef.current = setInterval(poll, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(pollingRef.current!) }
  }, [connected, workspaceId])

  const handleCreateSession = useCallback(async (systemPrompt: string) => {
    setSyncing(true); setSyncError(null)
    try {
      const { workspaceId: id } = await apiCreateSession('Prompt Lab', systemPrompt)
      setUrlWorkspaceId(id)
      setWorkspaceId(id)
      setConnected(true)
    } catch (e) { setSyncError(String(e)) }
    finally { setSyncing(false) }
  }, [])

  const handleConnectToSession = useCallback(async (id: string) => {
    setSyncing(true); setSyncError(null)
    try {
      try { await getLabState(id) } catch { await initLab(id, '') }
      setUrlWorkspaceId(id)
      setWorkspaceId(id)
      setConnected(true)
    } catch (e) { setSyncError(String(e)) }
    finally { setSyncing(false) }
  }, [])

  const handleInitLab = useCallback(async (systemPrompt: string) => {
    if (!workspaceId) return
    setSyncing(true); setSyncError(null)
    try {
      await initLab(workspaceId, systemPrompt)
      setConnected(true)
    } catch (e) { setSyncError(String(e)) }
    finally { setSyncing(false) }
  }, [workspaceId])

  const handleClearSession = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('s')
    window.history.pushState({}, '', url.toString())
    setWorkspaceId(null)
    setConnected(false)
    setSuggestions([])
    setRegressionStatus(null)
    setAgentSystemPrompt(null)
    setUiSystemPrompt(null)
    setAgentHasWrittenSystemPrompt(false)
    setAgentActiveQuery(null)
    setAgentActiveTarget(null)
    setTemplateTestCases([])
    lastTemplateCaseIdsRef.current = ''
    setServerTemplates([])
    setServerSystemPromptTemplates([])
    setTutorMessages([])
    setSyncError(null)
  }, [])

  const handleSyncTestCases = useCallback(async (testCases: TestCase[]) => {
    if (!workspaceId || !connected) return
    setSyncing(true); setSyncError(null)
    try { await syncTestCases(workspaceId, testCases) }
    catch (e) { setSyncError(String(e)) }
    finally { setSyncing(false) }
  }, [workspaceId, connected])

  const handlePushSystemPrompt = useCallback(async (prompt: string) => {
    if (!workspaceId || !connected) return
    try { await setSystemPrompt(workspaceId, prompt) } catch { /* best-effort */ }
  }, [workspaceId, connected])

  const handleApproveSuggestion = useCallback(async (id: string): Promise<string | null> => {
    if (!workspaceId) return null
    try {
      const s = suggestions.find(x => x.id === id)
      await approveSuggestion(workspaceId, id)
      setSuggestions(prev => prev.filter(x => x.id !== id))
      return s?.prompt ?? null
    } catch { return null }
  }, [workspaceId, suggestions])

  const handleRejectSuggestion = useCallback(async (id: string) => {
    if (!workspaceId) return
    try {
      await rejectSuggestion(workspaceId, id)
      setSuggestions(prev => prev.filter(x => x.id !== id))
    } catch { /* best-effort */ }
  }, [workspaceId])

  const handleSetSelectedModel = useCallback(async (model: string) => {
    if (!workspaceId || !connected) return
    setSelectedModelState(model)
    try { await apiSetSelectedModel(workspaceId, model) } catch { /* best-effort */ }
  }, [workspaceId, connected])


  const handlePostTutorMessage = useCallback(async (content: string) => {
    if (!workspaceId || !connected) return
    try { await apiPostTutorMessage(workspaceId, content) } catch { /* best-effort */ }
  }, [workspaceId, connected])

  return {
    workspaceId, connected, checking, hasApiKey, hasApiKeys,
    suggestions, regressionStatus, agentSystemPrompt, uiSystemPrompt, agentHasWrittenSystemPrompt,
    agentActiveQuery, agentActiveTarget, templateTestCases, serverTemplates, serverSystemPromptTemplates,
    availableModels, selectedModel,
    tutorMessages,
    syncing, syncError,
    createSession: handleCreateSession,
    connectToSession: handleConnectToSession,
    initLab: handleInitLab,
    clearSession: handleClearSession,
    syncTestCasesToMcp: handleSyncTestCases,
    pushSystemPromptToMcp: handlePushSystemPrompt,
    approveSuggestion: handleApproveSuggestion,
    rejectSuggestion: handleRejectSuggestion,
    setSelectedModel: handleSetSelectedModel,
    postTutorMessage: handlePostTutorMessage,
  }
}
