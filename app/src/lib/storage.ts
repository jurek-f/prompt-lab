import type { Session, SessionSummary, Settings, TestCase, ModelKey } from '../types'
import { MODELS } from '../types'

const KEYS = {
  settings: 'pl_settings',
  session: 'pl_session_current',
  pastSessions: 'pl_sessions_past',
  systemPrompt: 'pl_system_prompt',
  testCases: 'pl_test_cases',
} as const

const DEFAULT_SETTINGS: Settings = {
  tutorSessionsUsed: 0,
  responseModel: 'haiku',
  evalModel: 'haiku',
  ollamaResponseModel: 'gemma3:1b',
  ollamaEvalModel: 'gemma3:1b',
  ollamaBaseUrl: 'http://localhost:11434',
}

function get<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function set(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

export const storage = {
  getSettings: (): Settings => {
    const saved = get<Partial<Settings>>(KEYS.settings, {})
    const validKeys = Object.keys(MODELS) as ModelKey[]
    const isValid = (k: unknown): k is ModelKey => validKeys.includes(k as ModelKey)
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      responseModel: isValid(saved.responseModel) ? saved.responseModel : DEFAULT_SETTINGS.responseModel,
      evalModel: isValid(saved.evalModel) ? saved.evalModel : DEFAULT_SETTINGS.evalModel,
    }
  },
  setSettings: (s: Settings) => set(KEYS.settings, s),

  getSession: (): Session | null => {
    const s = get<Session | null>(KEYS.session, null)
    if (!s) return null
    // Migrate sessions saved before tutorChat was added
    if (!Array.isArray(s.tutorChat)) s.tutorChat = []
    return s
  },
  setSession: (s: Session) => set(KEYS.session, s),
  clearSession: () => localStorage.removeItem(KEYS.session),

  getPastSessions: (): SessionSummary[] => get<SessionSummary[]>(KEYS.pastSessions, []),
  setPastSessions: (list: SessionSummary[]) => set(KEYS.pastSessions, list),

  getSystemPrompt: (): string => localStorage.getItem(KEYS.systemPrompt) ?? '',
  setSystemPrompt: (v: string) => localStorage.setItem(KEYS.systemPrompt, v),

  getTestCases: (): TestCase[] => get<TestCase[]>(KEYS.testCases, []),
  setTestCases: (list: TestCase[]) => set(KEYS.testCases, list),
}
