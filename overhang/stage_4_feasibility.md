# Stage 4 — Feasibility

**Project**: Prompt Lab
**Date**: 2026-05-29
**Status**: Done — moved to Stage 5

---

## API & Cost

### Per-exchange breakdown

| Step | Model | Approx. cost |
|------|-------|-------------|
| Response | Haiku 4.5 | ~$0.002 |
| Scoring (LLM-as-judge) | Haiku 4.5 | ~$0.001 |
| Tutor feedback | Sonnet 4.6 | ~$0.009 |
| Session summary | Haiku 4.5 | ~$0.005 |

*Pricing (2026-05): Haiku $0.80/$4 per MTok input/output; Sonnet $3/$15 per MTok input/output.*

| Scenario | Cost |
|----------|------|
| 10 exchanges, scoring only | ~$0.03 |
| 50 exchanges, scoring + tutor | ~$0.61 |
| 10 full sessions (a month of intensive use) | ~$6 |

**Verdict:** trivially affordable for individual exploration and shared learning. ✓

---

## Data

No dataset required — all content is generated live by the user and the models. No sourcing, licensing, or preprocessing needed. ✓

---

## Legal

### API usage
Anthropic, Google, and OpenAI standard usage policies permit research and non-commercial use. No restrictions relevant to this app. ✓

### User data and GDPR
- User prompts and responses live in the user's localStorage only — no server-side storage
- Vercel proxy functions receive prompts transiently to forward to the LLM API; no logging
- No PII collected or retained
- GDPR exposure: minimal — no user accounts, no server-side data ✓

### AI-generated content
The UI clearly shows which model generated each response and score. ✓

---

## Technical

| Capability | Effort | Notes |
|-----------|--------|-------|
| Vercel edge function proxy | S | ~30 lines each; standard pattern |
| Anthropic / Google / OpenAI API | S | Well-documented REST APIs |
| LLM-as-judge with structured output | S | JSON-format judge prompt + `JSON.parse` with fallback |
| localStorage session management | S | Standard browser API |
| Collapsible UI panels | S | CSS + React state; no library needed |
| JSON download (Blob + anchor) | S | 5-line browser pattern |
| beforeunload unsaved-data warning | S | Standard browser event |

*S = hours, M = days, L = week+*

No M or L items. No unknowns. Every capability is well-understood. ✓

---

## Verdict

**Green — proceed to Stage 5.** Zero technical blockers. Costs negligible for exploratory use. Legal clean — no server-side data, no user accounts. No backend, no data pipeline, no external dependencies beyond the LLM provider APIs.
