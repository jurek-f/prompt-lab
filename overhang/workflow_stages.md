# Development Workflow

This repo is **one app**. To start a new app, copy this entire repo and walk through the stages below with the agent.

---

## overhang/ file map — layer labels

| File | Layer | Purpose |
|------|-------|---------|
| `workflow_stages.md` | **WORKFLOW** | This file — process reference |
| `stage_1_brainstorm.md` | **PRODUCT** | This app's brainstorm record |
| `stage_2_funnel.md` | **PRODUCT** | Idea selection and scope |
| `stage_3_requirements.md` | **PRODUCT** | Functionality, UX, data shape |
| `stage_4_feasibility.md` | **PRODUCT** | Costs, data, legal checks |
| `stage_5_product_definition.md` | **PRODUCT** | Agreed spec before coding |
| `stage_6_execution.md` | **PRODUCT** | Build log and progress |
| `brainstorm_notes.md` | **PRODUCT** | Raw ideas and session notes that don't fit the stage structure |
| `backlog.md` | **PRODUCT** | Deferred features — "save for later" |

**Workflow layer** files: `CLAUDE.md`, `README.md`, `overhang/workflow_stages.md`
All other files in `overhang/` are **product layer** — specific to this app.

---

## Stage sequence

| Stage | File | Purpose |
|-------|------|---------|
| 1 | `stage_1_brainstorm.md` | Open-ended idea exploration, landscape check, low-hangingness rating |
| 2 | `stage_2_funnel.md` | Narrow to one concrete idea |
| 3 | `stage_3_requirements.md` | Detailed functionality, UX, data shape |
| 4 | `stage_4_feasibility.md` | API costs, data availability, legal checks |
| 5 | `stage_5_product_definition.md` | Agreed product brief — locked before coding starts |
| 6 | `stage_6_execution.md` | Implementation plan and progress log |

Move to the next stage only when the current one has a clear output or decision.
A stage can be revisited — note the revision date when you do.

---

## Dedicated product docs (outside the stage sequence)

- **`brainstorm_notes.md`** — capture raw ideas, session tangents, and half-formed thoughts during brainstorming. Anything worth remembering that doesn't fit neatly into a stage file goes here. Written during Stage 1 and updated throughout.
- **`backlog.md`** — ideas that were explicitly deferred: too big for V1, out of scope, or interesting but not now. One entry per item with a brief rationale. Referenced when scoping future iterations.

---

## Data pipeline — when it enters the stages

Not every app needs a data pipeline. When it does, the decision surfaces across multiple stages:

| Stage | What to decide |
|-------|----------------|
| Stage 3 (Requirements) | What data the app needs; what shape the JSON files should take |
| Stage 4 (Feasibility) | Does the source data exist? Can it be processed offline? Is it public (safe to ship as a static file)? |
| Stage 5 (Product definition) | Lock the JSON schema; document which scripts produce which files; agree on `data/app/` structure |
| Stage 6 (Execution) | Write and run the Python scripts; commit the JSON; verify the frontend can fetch and render |

The pipeline lives in `scripts/` (Python source) and `data/app/` (JSON output). Both are committed. The scripts are developer/agent tools — they run before deployment, not on Vercel.

See `CLAUDE.md` → "Data pipeline pattern" for the full architectural rationale, including how Claude Code remote execution fits in.
