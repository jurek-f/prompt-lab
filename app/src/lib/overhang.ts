import type { TestCase } from '../types'

// ── Types mirroring the MCP server's LabState ─────────────────────────────────

export interface LabSuggestion {
  id: string
  prompt: string
  reasoning: string
  expectedGain?: string
  status: 'pending' | 'applied' | 'rejected'
  iteration: number
  createdAt: number
}

export interface LabTutorMessage {
  id: string
  role: 'tutor' | 'user'
  content: string
  createdAt: number
}

export interface LabState {
  systemPrompt: string           // agent's canonical prompt
  uiSystemPrompt?: string        // UI's current prompt
  agentHasWrittenSystemPrompt?: boolean
  uiActiveQuery?: string
  uiActiveTarget?: string
  agentActiveQuery?: string
  agentActiveTarget?: string
  testCases: { id: string; query: string; targetAnswer?: string; queryType?: string; source?: 'ui' | 'agent'; createdAt: number }[]
  testResults: { id: string; testCaseId: string; response: string; score: number; reasoning: string; iteration: number; model: string; createdAt: number }[]
  suggestions: LabSuggestion[]
  currentIteration: number
  optimizationGoal?: { targetScore: number; maxIterations: number }
  availableModels: string[]
  selectedModel: string
  pendingCommand?: { command: string; query?: string; targetAnswer?: string; createdAt: number }
  tutorMessages: LabTutorMessage[]
  hasApiKey?: boolean
  hasApiKeys?: { anthropic: boolean; google: boolean; openai: boolean }
  updatedAt: number
}

export interface LabRegressionStatus {
  workspaceId: string
  systemPrompt: string
  iteration: number
  totalTestCases: number
  totalRuns: number
  averageScore: number
  passCount: number
  failCount: number
  untestedCount: number
  passRate: number
  passingThreshold: number
  optimizationGoal?: { targetScore: number; maxIterations: number }
  byTestCase: {
    testCaseId: string
    query: string
    queryType?: string
    latestScore: number | null
    status: 'pass' | 'fail' | 'untested'
  }[]
}

// ── Relay helpers ─────────────────────────────────────────────────────────────

async function relayGet<T>(workspaceId: string, action?: string): Promise<T> {
  const params = new URLSearchParams({ s: workspaceId })
  if (action) params.set('action', action)
  const r = await fetch(`/api/relay?${params}`)
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `relay GET failed: ${r.status}`)
  }
  return r.json() as Promise<T>
}

async function relayPost<T>(action: string, workspaceId: string, data: Record<string, unknown> = {}): Promise<T> {
  const r = await fetch('/api/relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, workspaceId, ...data }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `relay POST ${action} failed: ${r.status}`)
  }
  return r.json() as Promise<T>
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function createSession(label?: string, systemPrompt = ''): Promise<{ workspaceId: string; url: string }> {
  const r = await fetch('/api/relay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'create-session', label, systemPrompt }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `create-session failed: ${r.status}`)
  }
  return r.json() as Promise<{ workspaceId: string; url: string }>
}

export async function getLabState(workspaceId: string): Promise<LabState> {
  return relayGet<LabState>(workspaceId)
}

export async function isLabReady(workspaceId: string): Promise<boolean> {
  try {
    await getLabState(workspaceId)
    return true
  } catch {
    return false
  }
}

export async function initLab(
  workspaceId: string,
  systemPrompt: string,
  optimizationGoal?: { targetScore: number; maxIterations: number }
): Promise<LabState> {
  return relayPost<LabState>('init-lab', workspaceId, { systemPrompt, ...(optimizationGoal ? { optimizationGoal } : {}) })
}

export async function setSystemPrompt(workspaceId: string, systemPrompt: string): Promise<void> {
  await relayPost('set-prompt', workspaceId, { systemPrompt })
}

export async function syncTestCases(workspaceId: string, testCases: TestCase[]): Promise<void> {
  const payload = testCases.map(tc => ({
    query: tc.query,
    targetAnswer: tc.targetAnswer || undefined,
    source: 'ui' as const,
  }))
  await relayPost('sync-test-cases', workspaceId, { testCases: payload })
}

export async function setActiveInput(workspaceId: string, uiActiveQuery?: string, uiActiveTarget?: string): Promise<void> {
  await relayPost('set-active-input', workspaceId, {
    uiActiveQuery: uiActiveQuery ?? '',
    uiActiveTarget: uiActiveTarget ?? '',
  })
}

export async function getSuggestions(workspaceId: string): Promise<LabSuggestion[]> {
  const data = await relayGet<{ suggestions: LabSuggestion[] }>(workspaceId, 'suggestions')
  return data.suggestions ?? []
}

export async function approveSuggestion(workspaceId: string, suggestionId: string): Promise<LabSuggestion> {
  return relayPost<LabSuggestion>('suggestion-status', workspaceId, { suggestionId, status: 'applied' })
}

export async function rejectSuggestion(workspaceId: string, suggestionId: string): Promise<LabSuggestion> {
  return relayPost<LabSuggestion>('suggestion-status', workspaceId, { suggestionId, status: 'rejected' })
}

export async function getRegressionStatus(workspaceId: string): Promise<LabRegressionStatus> {
  return relayGet<LabRegressionStatus>(workspaceId, 'regression')
}

export async function setSelectedModel(workspaceId: string, model: string): Promise<void> {
  await relayPost('set-model', workspaceId, { selectedModel: model })
}

export async function postTutorMessage(workspaceId: string, content: string): Promise<void> {
  await relayPost('post-tutor-message', workspaceId, { role: 'user', content })
}

export async function pushSessionHistory(workspaceId: string, data: unknown): Promise<void> {
  await relayPost('push-session-history', workspaceId, { entry: data })
}

export interface ServerTemplate {
  name: string
  savedAt: string
  testCases: { label?: string; query: string; targetAnswer?: string; passThreshold?: number; queryType?: string }[]
}

export async function getServerTemplates(): Promise<ServerTemplate[]> {
  const r = await fetch(`/api/relay?action=templates`)
  if (!r.ok) return []
  const data = await r.json() as { templates?: ServerTemplate[] }
  return data.templates ?? []
}

export interface ServerSystemPromptTemplate {
  name: string
  savedAt: string
  content: string
}

export async function getServerSystemPromptTemplates(): Promise<ServerSystemPromptTemplate[]> {
  const r = await fetch(`/api/relay?action=system-prompt-templates`)
  if (!r.ok) return []
  const data = await r.json() as { templates?: ServerSystemPromptTemplate[] }
  return data.templates ?? []
}

export async function pushRegressionHistory(workspaceId: string, data: unknown): Promise<void> {
  await relayPost('push-regression-history', workspaceId, { entry: data })
}

export async function ask(
  workspaceId: string,
  query: string,
  systemPrompt?: string,
  model?: string
): Promise<string> {
  const r = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, query, systemPrompt, model }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `ask failed: ${r.status}`)
  }
  const data = await r.json() as { response: string }
  return data.response
}
