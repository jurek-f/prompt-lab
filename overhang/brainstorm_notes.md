# Brainstorm Notes

Raw ideas and session tangents. Not structured — just worth keeping.

---

## 2026-05-29 — Session lifecycle + tutor chatbox session

Four modes crystallized (all optional/stackable, not separate apps):
- Mode 1: query = prompt, raw output, timestamped JSON download
- Mode 2: prompt template with `{QUERY}` variable + separate query input
- Mode 3: adds private target outcome → judge model (Haiku or Sonnet, user-selectable) scores response vs. target (0–10 + reasoning). Score methods considered: LLM-as-judge (best), embedding cosine (rejected — requires separate API), BLEU/ROUGE (rejected — inadequate for open text).
- Mode 4 (Tutor): any mode + teaching agent as a chatbox. Main contribution of the project. Auto-posts feedback after each run; user can also ask questions freely.

Session lifecycle decided:
- One session = one optimization goal (one target answer in modes 3/4)
- Max 50 requests per session, max 10 past sessions stored
- Starting a new session auto-summarizes the running session (Haiku for mode 3, tutor for mode 4)
- Summary contents: min/max score, what worked, what to avoid, target summary, date/mode/count
- Detailed history = running session only. Past sessions = summaries only.
- Warning before new session: "download JSON now or details will be lost"
- Three download options: per-exchange JSON, full session JSON, summaries JSON

Tutor context: current session in full + past session summaries injected as system context. Tutor conversation resets on new session (knowledge continuity via summaries, not chat history growth).

Terminology: "prompt tuning" is a PEFT term in ML. This app is prompt engineering / prompt iteration practice. Name candidates: "Prompt Lab", "Prompt Iteration Trainer". Decide in Stage 2.

---

## 2026-05-29 — UI model finalized + tutor guidelines draft (review before Stage 3)

**UI model**: no mode selector. All fields always visible (system prompt/template, query, target answer). Only toggle is Tutor on/off. "Modes" are just feature combinations, not user-selectable states.

**Tutor guidelines draft** — to be reviewed and written into Stage 3 requirements:

Three jobs per run: (1) diagnose which prompt dimension is limiting quality, (2) teach the principle in one sentence, (3) give exactly one concrete next step.

Diagnostic dimensions: clarity (unambiguous?), specificity (concrete constraints?), format (output structure specified?), context (audience/purpose present?), role/persona (system prompt set?), examples (in-context shots for consistency tasks?), reasoning trigger (step-by-step for analytical?), constraint scope (over-instructing?).

Technique repertoire — always concrete, never generic: role assignment (`You are an expert X`), format constraint (`respond in N bullet points`), audience spec, few-shot examples (input→output pairs), chain-of-thought (`think step by step before answering`), length constraint, negative constraint (`do not include X`), separation of concerns (stable → system prompt, variable → query).

History-aware behavior: name sessions explicitly ("In session 3 on May 15…"), surface recurring patterns, acknowledge progress, warn about regression, transfer techniques across sessions.

Tone rules: teacher not critic; one prescription per response (not a list); always ground in actual prompt text; honest about score noise (stochasticity); honest about model limits (flag when task exceeds Haiku's reliable capability).

---
