# Stage 1 — Brainstorm

**Project**: Prompt Lab
**Date**: 2026-05-28
**Status**: Done — moved to Stage 2

---

## Problem

Prompt engineering is a high-value skill, but there is no structured learning environment for it. The gap isn't technical — every LLM provider offers a playground. The gap is *pedagogical*: existing tools are built for engineers who already understand what they're doing, not for people who want to understand *why* one prompt works better than another.

### The domain expert insight

The most underserved users aren't developers learning to code — they're professionals in any field who already know what *good output looks like*:

- A **lawyer** knows whether a contract summary is accurate
- A **doctor** knows whether a patient briefing is complete
- A **product manager** knows whether a requirements doc is well-structured
- A **researcher** knows whether a literature summary is rigorous
- A **data analyst** knows whether an insight is correctly framed

These users have excellent evaluative judgment. What they lack is the systematic methodology to turn that judgment into better prompts. The right architecture is **human-in-the-loop**: the domain expert defines the target answer, the tool measures against it, and an AI coach teaches them how to close the gap.

### Terminology note

"Prompt tuning" is a specific ML term (PEFT: parameter-efficient fine-tuning). This project is not that.
Correct terms: **prompt engineering** (the skill), **prompt iteration** (the act), **prompt optimization** (improving toward a measurable target).

Working title: **Prompt Lab**

---

## Existing Landscape

| Product | What it does | Gap |
|---------|-------------|-----|
| Anthropic Console (Evaluate tab) | Prompt testing with scoring | For ML engineers; no learning scaffolding |
| OpenAI Playground | Parameter tweaking + history | Same — for builders, not learners |
| LangSmith | Trace-level evaluation + regression | Deep MLOps tool; steep learning curve |
| PromptLayer | Production prompt versioning | No educational component |
| DSPy / TextGrad | Automated prompt optimization | Code-only; requires ML background |
| OPRO / PromptBreeder | Research-grade prompt search | Academic; no accessible UI |

**What has changed since these tools launched:**
- Haiku costs ~$0.25/MTok — a learner can run 50 iterations for cents
- Frontend-only stack (React + Vite) makes a working demo a 1-session build
- Prompt engineering is now a recognized professional skill with genuine demand for structured learning tools

---

## Two Ideas

### Idea A — Human Prompt Lab (V1 target)

The user iterates manually: write a prompt, fire it at a model, score the response against a private target answer, get AI coaching, iterate. The tool provides:

1. A structured interface: system prompt (optional) + query + target answer (optional, activates scoring)
2. LLM-as-judge scoring (0.0–1.0) with structured reasoning — including query type and topic label for regression pattern analysis
3. An interactive AI tutor that coaches improvement after each exchange and retains session history via auto-summarization
4. A regression test panel: define query/target pairs, run all against the current system prompt, see where it generalises and where it fails

All state in localStorage. No backend. All computation via live API calls.

### Idea B — Automated Prompt Evolution (deferred)

User defines a task; system generates, tests, and scores prompt variants automatically.

Deferred because: (1) stochasticity — the same prompt gives different output, making "optimization" noisy without multiple samples per variant; (2) N×M async API call orchestration adds complexity not justified for V1; (3) the noise risk is especially harmful for learners who may draw wrong conclusions from lucky results. The same judge infrastructure makes it a natural V2 extension.

---

## Low-Hangingness

| Dimension | Rating | Notes |
|-----------|--------|-------|
| Data | 🟢 | No dataset — user supplies prompts, models supply responses |
| Pipeline | 🟢 | No preprocessing — all live API calls |
| Frontend | 🟡 | Standard React; main design challenge is the score + coaching layout |
| **Overall** | 🟢 | |

Estimated time to working demo: **1 session**

Biggest risk: the judge prompt quality. If evaluation criteria are loose, scores are noise that confuse rather than help. The judge prompt needs careful design.

---

## Decision

Proceed to Stage 2 with **Idea A**. Idea B deferred to backlog.
