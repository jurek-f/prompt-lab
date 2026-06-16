export const QUERY_TYPES = ['explain', 'generate', 'transform', 'extract', 'compare', 'reason', 'classify'] as const
export type QueryType = typeof QUERY_TYPES[number]

export interface Score {
  value: number
  topic?: string
  queryType?: QueryType
  reasoning: string
  judgeModel: string
}

export interface Exchange {
  id: string
  timestamp: string
  responseModel: string
  systemPrompt: string
  query: string
  prompt: string
  response: string
  score: Score | null
  tutorMessage: string | null
}

export interface TutorMessage {
  role: 'tutor' | 'user'
  content: string
  timestamp: string
}

export interface Session {
  id: string
  name: string
  startedAt: string
  targetAnswer: string
  judgeModel: string
  tutorEnabled: boolean
  exchanges: Exchange[]
  tutorChat: TutorMessage[]
}

export interface SessionSummary {
  id: string
  name: string
  date: string
  exchangeCount: number
  targetAnswer: string
  scoreMin: number | null
  scoreMax: number | null
  scoreMaxQuery?: string
  summary: string
}

export interface TestCase {
  id: string
  label: string
  query: string
  targetAnswer: string
  passThreshold?: number
}

export interface TestRunResult {
  testCaseId: string
  responseModel: string
  response: string
  score: Score | null
  error?: string
}

export const MODELS = {
  haiku: 'claude-haiku-4-5-20251001',
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-8',
  flash: 'gemini-2.5-flash-lite',
  flashFull: 'gemini-2.5-flash',
  gpt4omini: 'gpt-4o-mini',
  gpt4o: 'gpt-4o',
  ollama: 'ollama',
} as const

export type ModelKey = keyof typeof MODELS

export const MODEL_LABELS: Record<ModelKey, string> = {
  haiku: 'Claude Haiku 4.5',
  sonnet: 'Claude Sonnet 4.6',
  opus: 'Claude Opus 4.8',
  flash: 'Gemini 2.5 Flash Lite',
  flashFull: 'Gemini 2.5 Flash',
  gpt4omini: 'GPT-4o mini',
  gpt4o: 'GPT-4o',
  ollama: 'Ollama (local)',
}

export type ApiProvider = 'anthropic' | 'google' | 'openai' | 'ollama'

export const MODEL_PROVIDER: Record<ModelKey, ApiProvider> = {
  haiku: 'anthropic',
  sonnet: 'anthropic',
  opus: 'anthropic',
  flash: 'google',
  flashFull: 'google',
  gpt4omini: 'openai',
  gpt4o: 'openai',
  ollama: 'ollama',
}

export const PROVIDER_GROUPS: { provider: ApiProvider; label: string; keys: ModelKey[] }[] = [
  { provider: 'anthropic', label: 'Anthropic', keys: ['haiku', 'sonnet', 'opus'] },
  { provider: 'google',    label: 'Google',    keys: ['flash', 'flashFull'] },
  { provider: 'openai',    label: 'OpenAI',    keys: ['gpt4omini', 'gpt4o'] },
  { provider: 'ollama',    label: 'Local',     keys: ['ollama'] },
]

export interface Settings {
  tutorSessionsUsed: number
  responseModel: ModelKey
  evalModel: ModelKey
  ollamaResponseModel: string
  ollamaEvalModel: string
  ollamaBaseUrl: string
}
