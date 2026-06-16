# Stage 6 — Execution

**Feature name**: prompt-lab
**Date started**: 2026-05-29
**Status**: [ ] Not started  [ ] In progress  [x] Done  [x] Deployed

---

## Implementation Plan

No data pipeline — all live API calls. Frontend + Vercel edge functions only.

### Phase 1 — Infrastructure
- [x] `app/vercel.json` — SPA rewrites, exclude `/api/*`
- [x] `app/api/anthropic.ts` — Anthropic proxy
- [x] `app/api/google.ts` — Google Gemini proxy (normalised to Anthropic response format)
- [x] `app/api/openai.ts` — OpenAI proxy (normalised to Anthropic response format)
- [x] `app/api/config.ts` — provider availability check (returns booleans, never keys)
- [x] `app/vite.config.ts` — UnoCSS plugin

### Phase 2 — Types & Utilities
- [x] `src/types.ts` — Exchange, Session, SessionSummary, Settings, TutorMessage, TestCase, TestRunResult, Score, MODELS, MODEL_LABELS, MODEL_PROVIDER, PROVIDER_GROUPS, QUERY_TYPES
- [x] `src/lib/storage.ts` — localStorage read/write with defaults
- [x] `src/lib/api.ts` — `callAnthropic()` routing: Anthropic / Google / OpenAI / Ollama (direct)
- [x] `src/lib/download.ts` — session, summaries, regression results JSON downloads
- [x] `src/lib/prompts.ts` — judge prompt, tutor system prompt, summarization prompt, regression analysis prompt

### Phase 3 — Components
- [x] `src/components/AnswerArea.tsx`
- [x] `src/components/HistoryPanel.tsx`
- [x] `src/components/PromptArea.tsx`
- [x] `src/components/RegressionPanel.tsx`
- [x] `src/components/SessionControlBar.tsx`
- [x] `src/components/SummarizeAndNewDialog.tsx`
- [x] `src/components/SystemPromptPanel.tsx`
- [x] `src/components/TargetAnswerSection.tsx`
- [x] `src/components/TutorFloatingPanel.tsx`

### Phase 4 — Hooks & Wiring
- [x] `src/hooks/useSession.ts` — session state, sendPrompt, tutor, summarize
- [x] `src/hooks/useRegressionTests.ts` — test case state, runTests, tutor analysis
- [x] `src/hooks/useBeforeUnload.ts`
- [x] `src/App.tsx` — full wiring, settings dropdown, Send snap-to-bar, legal modals (FAQ / About / Privacy / Datenschutz / Impressum)

### Phase 5 — Verification
- [x] `npm run build` passes
- [x] Full scored + tutored session works end-to-end
- [x] Regression tests run and produce scored results with query type and topic
- [x] All downloads produce valid JSON
- [x] Ollama direct-call works with CORS enabled

---

## Progress Log

| Date | What was done |
|------|--------------|
| 2026-05-29 | Stage 6 started. Core session loop built: query → response → LLM-as-judge score → tutor feedback. localStorage persistence. |
| 2026-05-29 | Regression test panel: test case CRUD, run-all, pass/fail by configurable threshold. |
| 2026-05-29 | Tutor integration: auto-posts after each exchange and after regression run. Session memory via summarization. |
| 2026-05-29 | UI polish: Send button snaps to title bar when scrolled past. Tutor + Settings right-aligned in top bar. |
| 2026-05-29 | Score extended: `topic` (2–4 word label) and `queryType` (explain / generate / transform / extract / compare / reason / classify) added to judge output. Regression analysis grouped by query type. |
| 2026-05-29 | Regression UX: import from past sessions, import from JSON, mean score display, tutor analysis below results. |
| 2026-05-29 | Open source release: MIT license, README for Prompt Lab and Overhang framework. BYOK Vercel deployment model (no passcode gate). |
| 2026-05-30 | Ollama local model support: direct browser→Ollama call via OpenAI-compat endpoint. Configurable model name and base URL in settings. Separate model names for response and eval roles. |
| 2026-05-30 | Multi-provider support: Google Gemini and OpenAI GPT models added. `/api/config` endpoint detects available keys; model selector filters accordingly. |
| 2026-05-31 | Added Claude Opus 4.8 and Gemini 2.5 Flash. Model selector grouped by provider using disabled option headers. |
| 2026-05-31 | In-app FAQ covering Ollama setup (Windows + macOS/Linux), CORS, mixed-content limitation, scoring mechanics. |
| 2026-05-31 | Privacy Policy and Datenschutz updated to cover all three cloud providers and Ollama data-stays-local note. |

---

## Deployment

- [x] `npm run build` passes
- [x] Pushed and PR merged to `main`
- [x] Deployed to Vercel
- [x] `ANTHROPIC_API_KEY` set in Vercel env
- [x] `GEMINI_API_KEY` set in Vercel env
- [ ] `OPENAI_API_KEY` — optional; add to enable GPT models
