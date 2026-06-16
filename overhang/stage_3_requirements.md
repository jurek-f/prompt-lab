# Stage 3 — Requirements

**Project**: Prompt Lab
**Date**: 2026-05-29
**Status**: Done — moved to Stage 4

---

## Architecture

Frontend-only app. All user state in localStorage. API calls go through thin Vercel edge functions that inject API keys server-side — keys are never bundled into client JS.

### Edge functions

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Returns which providers are configured: `{ anthropic, google, openai }` — used to filter the model selector on load |
| `/api/anthropic` | POST | Anthropic proxy — injects `ANTHROPIC_API_KEY` |
| `/api/google` | POST | Google Gemini proxy — converts to Anthropic response format |
| `/api/openai` | POST | OpenAI proxy — converts to Anthropic response format |

Ollama calls go **directly from the browser** to `http://localhost:11434` — no proxy, no API key.

Vercel env vars (all optional; at least one required for cloud models): `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`

---

## Per-Exchange Sequence

```
User sends query
  → Response model call → answer text
  → (if target answer present) Eval model call → score (0–1), reasoning, topic, queryType
  → (if tutor enabled)         Eval model call → coaching paragraph
  → Append exchange to localStorage session
```

`queryType` classifies the query as one of: `explain`, `generate`, `transform`, `extract`, `compare`, `reason`, `classify`. Used to group regression results.

---

## Storage Schemas

**`pl_system_prompt`** — string; persists across sessions

**`pl_settings`**
```json
{
  "responseModel": "haiku",
  "evalModel": "haiku",
  "ollamaResponseModel": "llama3.2:3b",
  "ollamaEvalModel": "gemma3:1b",
  "ollamaBaseUrl": "http://localhost:11434"
}
```

**`pl_session_current`** — running session
```json
{
  "id": "sess_1748520000000",
  "name": "Explain recursion",
  "startedAt": "2026-05-29T14:32:00.000Z",
  "targetAnswer": "Recursion is a function calling itself with a base case.",
  "exchanges": [{
    "id": "exch_1748520001000",
    "timestamp": "2026-05-29T14:32:01.000Z",
    "systemPrompt": "You are a CS teacher. {QUERY}",
    "query": "Explain recursion",
    "response": "Recursion is when a function calls itself...",
    "score": {
      "value": 0.71,
      "topic": "recursion base case",
      "queryType": "explain",
      "reasoning": "Accurate but omits the base-case concept from the target."
    },
    "tutorMessage": "Role assignment is working. Next: add 'in 2 sentences' to force concision."
  }],
  "tutorChat": [
    { "role": "tutor", "content": "...", "timestamp": "..." },
    { "role": "user", "content": "...", "timestamp": "..." }
  ]
}
```

**`pl_sessions_past`** — up to 10 session summaries
```json
[{
  "id": "sess_1748520000000",
  "name": "Explain recursion",
  "date": "2026-05-29",
  "exchangeCount": 12,
  "scoreMin": 0.41,
  "scoreMax": 0.87,
  "summary": "Role + length constraint brought score from 0.41 to 0.87. Key prompt: 'You are a CS teacher. In 2 sentences:'"
}]
```

**`pl_test_cases`** — regression test definitions
```json
[{
  "id": "uuid",
  "label": "Recursion basics",
  "query": "Explain recursion",
  "targetAnswer": "A function that calls itself with a base case.",
  "passThreshold": 0.7
}]
```

---

## Component Tree

```
App
├── TopBar (fixed)
│   ├── "Prompt Lab" wordmark
│   ├── Send button (snaps to bar when content Send is off-screen)
│   ├── TutorButton → TutorFloatingPanel
│   └── SettingsButton → Settings dropdown
│       ├── ModelSelect (response model) — grouped by provider, filtered by /api/config
│       ├── ModelSelect (eval model)
│       └── OllamaConfig (shown when either model is Ollama)
├── PromptArea (SystemPromptPanel + QueryTextarea + SendButton)
├── AnswerArea (ExchangeList, newest first)
├── TargetAnswerSection (locks after first send)
├── SessionControlBar (name + new session + clear)
├── HistoryPanel (collapsible — past sessions + download)
├── SystemPromptPanel (collapsible)
├── RegressionPanel (collapsible)
│   ├── Test case CRUD + Import from sessions/JSON + Run all
│   ├── Results (scored by query type and topic)
│   └── TutorAnalysis (auto-posted after run if tutor enabled)
├── TutorFloatingPanel (floating)
└── LegalModal (FAQ / About / Privacy / Datenschutz / Impressum)
```

---

## Non-Functional Requirements

| Concern | Decision |
|---------|---------|
| Performance | Sequential calls; spinner per step; typical round-trip < 15s |
| Mobile | Primary target — single-column layout, 44px min touch targets |
| Accessibility | WCAG AA for core interactions |
| API key safety | Keys server-side only (Vercel env vars); never in browser JS or logs |
| Browser support | Modern evergreen only |
