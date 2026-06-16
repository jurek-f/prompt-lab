# Stage 2 — Funnel

**Project**: Prompt Lab
**Date**: 2026-05-29
**Status**: Done — moved to Stage 3

---

## Selected Idea

**Prompt Lab** — an in-browser prompt iteration environment where users write prompts, fire them at a model, score responses against a private target answer, and get coaching from an AI tutor with session memory.

No discrete modes — all features are available via toggles. The interface is always: system prompt (optional) + query + target answer (optional) + tutor (optional).

---

## Why This One

- **No comparable tool exists.** Existing products are built for production engineers. Prompt Lab is the first tool that treats the iteration loop as the learning artifact — designed for anyone who can evaluate outputs but wants to improve their prompting systematically, regardless of ML background.
- **Frontend-only stack is a perfect fit.** All state in localStorage, all computation via live API calls. No backend, no data pipeline, no hosting complexity beyond static Vercel deployment.
- **The AI tutor is a genuine differentiator.** Curated prompt engineering best practices embedded in a conversational agent with cross-session memory. Advice compounds over time rather than starting from scratch each session.
- **Cost is negligible at this scale.** A full 50-exchange session with scoring and tutor feedback costs under $0.10 at current model prices.

---

## Discarded

| Idea | Reason |
|------|--------|
| Automated prompt evolution (Idea B) | Stochasticity makes "optimization" noisy. Multi-call orchestration adds complexity not justified for V1. Natural V2 extension using the same judge infrastructure. |

---

## Core Flow

| Step | What happens |
|------|-------------|
| Open app | Loads immediately — no login, no API key prompt |
| Settings | Select response model and eval model independently from all configured providers |
| Write system prompt | Optional; persists across sessions |
| Enter target answer | Optional; activates scoring when present |
| Enable tutor | Optional; opens floating coaching panel |
| Send query | Response model generates answer; eval model scores if target present; tutor posts coaching if enabled |
| Iterate | Edit prompt, send again; history grows; score and tutor update |
| New session | Auto-summarization fires; tutor carries forward session memory via summaries |
| Regression tests | Define query/target pairs; run all against current system prompt; view results by query type and topic |

---

## Scope

**V1 — in scope:** iteration loop · LLM-as-judge scoring with query type + topic · AI tutor with session memory · regression test panel · multi-provider model support (Anthropic / Google / OpenAI / Ollama) · localStorage persistence · JSON export

**V2 — deferred:** automated prompt evolution · multi-model comparison · session sharing · user accounts or cloud sync
