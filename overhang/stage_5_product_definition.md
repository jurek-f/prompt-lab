# Stage 5 — Product Definition

**Project**: Prompt Lab
**Date**: 2026-05-29
**Status**: Done — moved to Stage 6

> Authoritative reference for execution. Supersedes earlier stages where there is any conflict.

---

## One-Liner

A browser-based prompt iteration environment where users refine prompts against a live LLM, score responses against a target answer, and get coaching from an AI tutor that builds knowledge across sessions.

---

## The Product

### What it does

1. Accepts a query (and optional system prompt), fires it at the selected model, shows the response — the core iteration loop.
2. Optionally scores each response against a target answer (0.0–1.0) with reasoning, query type classification, and topic label for regression analysis.
3. Optionally enables an AI tutor that auto-posts actionable coaching after each exchange and after each regression run, and accepts user follow-up questions. Tutor reads past session summaries so advice compounds across sessions.
4. Runs regression test suites — define query/target pairs, run all against the current system prompt, view pass/fail grouped by query type and topic, download results as JSON.
5. Persists the running session and up to 10 past session summaries in localStorage; auto-summarizes on new session start.
6. Exports session data and regression results as JSON at any time.

### Models

Response model and eval model are configured independently. The app detects available providers via `/api/config` and shows only configured models.

| Provider | Models | Key required |
|----------|--------|-------------|
| Anthropic | Claude Haiku 4.5, Sonnet 4.6, Opus 4.8 | `ANTHROPIC_API_KEY` |
| Google | Gemini 2.5 Flash Lite, Gemini 2.5 Flash | `GEMINI_API_KEY` |
| OpenAI | GPT-4o mini, GPT-4o | `OPENAI_API_KEY` |
| Ollama | Any locally-installed model | None |

Ollama calls go directly from the browser — no proxy, no API key.

### What it does NOT do

- No user accounts, cloud sync, or shared sessions — all state is local to the browser
- Does not expose API keys in the browser — cloud calls go through Vercel edge functions
- Does not automate prompt generation or variant testing (deferred V2)
- Does not work offline for cloud models — requires network

---

## Final User Flow

| Step | User action | System response |
|------|-------------|-----------------|
| 1 | Opens the app | Loads immediately — no authentication |
| 2 | (Optional) Opens Settings | Selects response model and eval model independently |
| 3 | (Optional) Enters target answer | Scoring enabled for all subsequent exchanges |
| 4 | (Optional) Toggles Tutor | Tutor floating panel activates |
| 5 | (Optional) Edits system prompt | Saved to localStorage on every keystroke; persists across sessions |
| 6 | Types query, taps Send | Response model generates answer. If target present: eval model scores (0–1) with reasoning, topic, queryType. If tutor on: eval model posts coaching. Exchange saved to localStorage. |
| 7 | Iterates | Edits prompt or query, sends again. Score and tutor update. History grows newest-first. |
| 8 | Starts new session | Eval model generates summary. Session moved to past sessions list (max 10). New empty session starts. |
| 9 | New session, tutor active | Tutor system prompt includes past summaries; advice builds on prior sessions. |
| 10 | (Optional) Runs regression tests | Opens Regression panel, adds/imports test cases, taps "Run all". Each case scored; tutor analysis auto-posted if tutor enabled. Results downloadable. |

---

## API Layer

Four Vercel edge functions (see Stage 3 for full spec):

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/config` | GET | Provider availability check |
| `/api/anthropic` | POST | Anthropic proxy |
| `/api/google` | POST | Google Gemini proxy (normalised to Anthropic format) |
| `/api/openai` | POST | OpenAI proxy (normalised to Anthropic format) |

---

## localStorage Schemas

**`pl_system_prompt`** — string; persists across sessions

**`pl_settings`** — model selection and Ollama config

**`pl_session_current`** — running session with all exchanges and tutor chat

**`pl_sessions_past`** — array of up to 10 session summary objects

**`pl_test_cases`** — regression test case definitions

Full schemas in Stage 3.

---

## Component Tree

```
App
├── TopBar (fixed)
│   ├── "Prompt Lab" wordmark
│   ├── Send button (snap-to-bar — visible when content Send is off-screen)
│   ├── TutorButton → TutorFloatingPanel
│   └── SettingsButton → Settings dropdown
│       ├── ModelSelect (response model) — grouped by provider, filtered by /api/config
│       ├── ModelSelect (eval model)
│       └── OllamaConfig (shown when either model is Ollama)
├── PromptArea (SystemPromptPanel + QueryTextarea + SendButton)
├── AnswerArea (ExchangeList, newest first)
├── TargetAnswerSection (locks after first send)
├── SessionControlBar (name + new session + clear)
├── HistoryPanel (collapsible — past sessions + download summaries)
├── SystemPromptPanel (collapsible)
├── RegressionPanel (collapsible)
│   ├── Test case CRUD + Import from sessions/JSON + Run all
│   ├── Results (pass/fail by query type and topic; mean score; download)
│   └── TutorAnalysis (auto-posted after run if tutor enabled)
├── TutorFloatingPanel (floating)
│   ├── TutorMessageList
│   └── UserMessageInput
├── SummarizeAndNewDialog (modal)
└── LegalModal (FAQ / About / Privacy / Datenschutz / Impressum)
```

---

## Acceptance Criteria

- [x] User can complete a full scored + tutored session end-to-end
- [x] Score appears as a decimal (e.g. `0.71`) with reasoning, query type, and topic
- [x] Tutor auto-posts after each exchange; user can send follow-up messages
- [x] Tutor auto-posts analysis after regression test run
- [x] "Summarize & start new session" produces a readable summary; tutor in new session references it
- [x] Unsaved-data warning fires on page leave
- [x] Regression tests run, score, and display pass/fail by configurable threshold
- [x] Download options produce valid JSON for sessions, summaries, and regression results
- [x] Model selector filtered by detected API key availability
- [x] Ollama (local) works with configurable model name and base URL
- [x] `npm run build` passes with no TypeScript errors
- [x] Deployed to Vercel; confirmed working
