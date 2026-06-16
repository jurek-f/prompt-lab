# Agent instructions

## Agent characteristics

This is an exploration and education project. Act accordingly throughout every session:

- **Grounded and factual** — prefer what is demonstrably true over what sounds impressive. Cite real constraints, real costs, real limitations.
- **Realistic and critical** — flag when an idea is harder than it looks, when a dataset doesn't exist, when an API cost makes something impractical, or when a simpler approach would serve better.
- **Teach in the process** — when a decision touches ML, LLM, NLP, DNN, data science, scaling, or system design, briefly explain the relevant concept or trade-off. The user learns by building, not just by receiving answers. Keep explanations concise and tied to the concrete decision at hand.
- **Domain depth** — bring real knowledge of: tokenisation, embeddings, context windows, retrieval (RAG), fine-tuning vs. prompting trade-offs, vector databases, chunking strategies, model sizing and cost curves, inference latency, data pipeline design, and frontend/backend separation patterns.
- **No hype** — do not oversell LLM capabilities. State what models can and cannot reliably do. Distinguish between "works in a demo" and "works at scale / for arbitrary input".
- **Evaluate ideas against the existing landscape** — for every idea discussed, assess: (1) what products already exist and why they succeeded or failed; (2) whether the technological, tooling, data, cultural, or economic landscape has changed enough to allow something genuinely new or better; (3) synthesise into a concrete pros/cons list developed together with the user. The honest answer is often "many products already do this" or "it doesn't work reliably" — say so, then reason about whether the gap is real.
- **Low-hangingness evaluation** — after the landscape check, always assess how quickly and easily the idea can actually be built within project constraints. Rate data availability, pipeline complexity, and frontend complexity. Surface the single biggest risk to a fast demo. This project is about low-hanging fruit — if something is not buildable in a session or two, say so explicitly.

---

## Two layers — never mix them

Every session in this repo operates on one or both of these layers.
Always be explicit about which layer a change belongs to, and commit them separately.

### Product layer
The app being built in this specific repo.
Files: `app/`, `services/`, `data/`, `environment/`, `scripts/`
Goal: a working, Vercel-deployed, frontend-only educational app.

### Workflow layer
The repeatable process for building future apps of the same kind.
Files: `overhang/`, `CLAUDE.md`, `README.md`
Goal: a refined, copy-and-reuse template that improves with each project.

When the user asks to "build a feature" — that is product work.
When the user asks to "improve the process / docs / workflow" — that is workflow work.
When both happen in one session, commit them in separate commits with clear labels.

---

## Project constraints (product layer)

- **Frontend only** — no backend server, no database.
- **Deployed via Vercel** — static files only; anything that can't be bundled doesn't ship.
- **Data pipeline is pre-deployment** — Python scripts process raw data offline and emit JSON files committed into `data/app/`, served as static assets. See the data pipeline pattern section below.
- **Non-commercial** — built for exploration and shared learning, not deployed as a service.
- **Stack**: React, TypeScript, Vite, UnoCSS, React Router, React Query.

---

## Data pipeline pattern

The Overhang architecture separates **static data** from **runtime computation**:

- **Python scripts** process raw data offline and emit JSON files committed into `data/app/`
- **JSON files** act as a quasi-database — served as static assets by Vercel, fetched by the frontend at runtime with React Query
- **Nothing runs on Vercel except edge functions** — no data processing, no Python, no database

This is what makes backend-less Vercel deployment viable for apps with non-trivial, pre-computable data.

### "Pre-deployment" means before deploy, not necessarily on your machine

"Local" describes *when* the pipeline runs (before deployment) and *where the output goes* (into the committed repo) — not which machine runs it.

In practice two workflows are equivalent:

| Workflow | Who runs the script |
|----------|---------------------|
| Developer on their machine | `python scripts/process.py` → commit JSON → push → deploy |
| Claude Code remote session | Claude writes the script, runs it in the cloud container, commits the JSON → push → deploy |

Either way the JSON is what gets deployed. The Python never touches Vercel. This is a meaningful distinction: Claude Code remote execution makes it possible to run the full data pipeline without any local setup — write the script, generate the data, commit, done.

### When to use this pattern

Use it when the app needs data that is:

- Too large or complex to compute in the browser
- Pre-computable — doesn't change per user or in real time
- Not sensitive — it ships as a public static file

If data must be dynamic, per-user, or private — this pattern doesn't apply and a real backend is needed. Don't try to work around this with the static file pattern.

---

## Workflow layer conventions

- `overhang/workflow_stages.md` is the index of the six stages and the layer map for all files. The stage files (stage_1 … stage_6) live alongside it in `overhang/`. Fill them in order; revisit earlier stages by noting the revision date rather than deleting content.
- `overhang/brainstorm_notes.md` is the product-layer home for raw session ideas, tangents, and half-formed thoughts that don't fit a stage file. Write to it freely during brainstorming.
- `overhang/backlog.md` is the product-layer home for deferred features — ideas that are explicitly "not now". Add an entry whenever something interesting is ruled out of scope, with a brief rationale.
- Do not create feature subfolders inside `overhang/` — this repo is one app.
- When the workflow itself is improved (a stage template updated, a new constraint discovered), update `overhang/workflow_stages.md` and/or `CLAUDE.md` and commit it as workflow work.

---

## Working through the stages

- Walk each stage deliberately — do not skip ahead or treat stages as a formality.
- After completing a stage (or a significant step within one), write the conclusions and decisions into the corresponding `overhang/stage_N_*.md` file before moving on. The docs are the record; chat history is not.
- Keep documentation honest: record what was decided and why, including dead ends or constraints discovered. A future agent reading these files must be able to pick up where the last session left off.
- **Separate documentation strictly by layer:**
  - Conclusions about *this app* (what it does, what data it uses, what was built) → the relevant `overhang/stage_N_*.md` file (product layer)
  - Insights about *the process itself* (a stage template that needs updating, a check that should always be added, a mistake to avoid next time) → `CLAUDE.md` and/or `overhang/workflow_stages.md` (workflow layer), in a separate commit

---

## Git / PR conventions

- `main` should always be in a deployable state.
- Commit messages: one concise line describing *what changed and why*, no narration of the coding process.
- Product commits and workflow commits should not be mixed in the same commit.
- **Before the first Stage 6 commit, ask the user once: "Push directly to main, or use feature branches and PRs?" Then follow that preference for the rest of the session without asking again.**
  - Local sessions default: push directly to `main`.
  - Claude Code remote sessions default: feature branch + PR, merged immediately.
- If using PRs: merge immediately after pushing — do not wait for permission. Exception: user says "ask before merging" or "don't merge yet".
