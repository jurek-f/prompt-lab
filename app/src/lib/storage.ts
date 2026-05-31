import type { Session, SessionSummary, Settings, TestCase } from '../types'

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
  getSettings: (): Settings => ({ ...DEFAULT_SETTINGS, ...get<Partial<Settings>>(KEYS.settings, {}) }),
  setSettings: (s: Settings) => set(KEYS.settings, s),

  getSession: (): Session | null => get<Session | null>(KEYS.session, null),
  setSession: (s: Session) => set(KEYS.session, s),
  clearSession: () => localStorage.removeItem(KEYS.session),

  getPastSessions: (): SessionSummary[] => get<SessionSummary[]>(KEYS.pastSessions, []),
  setPastSessions: (list: SessionSummary[]) => set(KEYS.pastSessions, list),

  getSystemPrompt: (): string => localStorage.getItem(KEYS.systemPrompt) ?? '',
  setSystemPrompt: (v: string) => localStorage.setItem(KEYS.systemPrompt, v),

  getTestCases: (): TestCase[] => get<TestCase[]>(KEYS.testCases, []),
  setTestCases: (list: TestCase[]) => set(KEYS.testCases, list),
}
