# Overhang

**A workflow and repo template for building frontend AI apps with Claude Code.**

Overhang is a structured development framework — a `CLAUDE.md` agent configuration and stage-by-stage documentation templates — designed to be the starting point for any new AI-powered frontend application.

The name reflects the goal: systematically reach for low-hanging fruit in the LLM landscape.

Built with [Claude Code](https://claude.ai/code).

---

## What it is

A template repo, not a library. Copy it, walk through six documented stages with Claude Code as your agent, and end up with a deployed Vercel app. The framework enforces a two-layer discipline that keeps product code and development process clearly separated.

**Built with this framework:** [Prompt Lab](https://github.com/jurek-f/prompt-lab) — an open-source prompt engineering and evaluation tool. The `overhang/stage_*.md` files in this repo are a complete example of the framework in use.

---

## Two layers — always separate

| Layer | What it is | Files |
|---|---|---|
| **Product** | The app being built | `app/`, `services/`, `data/`, `environment/`, `README.md` |
| **Workflow** | The repeatable process for building future apps | `overhang/`, `CLAUDE.md`, `overhang/README.md` |

Never mix these in the same commit. Product work and workflow improvements get separate commits with separate labels.

---

## The six stages

| Stage | File | Purpose |
|---|---|---|
| 1 | `stage_1_brainstorm.md` | Raw ideas, landscape check, low-hangingness assessment |
| 2 | `stage_2_funnel.md` | Narrow to one concrete, buildable idea |
| 3 | `stage_3_requirements.md` | Functionality, data shape, component breakdown |
| 4 | `stage_4_feasibility.md` | API costs, data availability, legal checks |
| 5 | `stage_5_product_definition.md` | Authoritative spec — locked before coding starts |
| 6 | `stage_6_execution.md` | Build log and progress |

Walk them in order. Record decisions in the stage files — chat history is not a record. A stage can be revisited; note the revision date when you do.

---

## Dedicated tracking files

| File | Purpose |
|---|---|
| `brainstorm_notes.md` | Raw session ideas, tangents, half-formed thoughts that don't fit a stage file |
| `backlog.md` | Deferred features — ideas explicitly ruled out of scope, with rationale |

---

## Architecture patterns

### Frontend-only, deployed to Vercel

```
User input (live, in-browser)
  → React + Vite frontend
  → Vercel edge functions  (thin API proxies — keys server-side only)
  → External APIs          (LLMs, data sources)
State → localStorage
```

No backend server, no database. All user state is local to the browser.

### Data pipeline (for apps with pre-computable data)

```
Raw input  (text, PDF, CSV, …)
  → Python scripts in services/   (pre-deployment — runs once, offline)
  → data/                          (working area — scripts write here)
  → app/public/data/               (committed — copied from data/ before push)
  → React frontend                 (fetches JSON at runtime with React Query)
```

Use this pattern when the app needs data that is too large or complex to compute in the browser, pre-computable, and public (safe to ship as a static file). The Python never runs on Vercel — it runs before deployment.

Keep two separate data folders: `data/` is the working area where scripts write during development; `app/public/data/` is what gets deployed. Copy `data/` → `app/public/data/` before committing and pushing.

"Pre-deployment" is more accurate than "local": a Claude Code remote session can write and run the pipeline scripts in its cloud container, commit the JSON, and push — no local machine required.

---

## Key folders

| Folder | What it contains |
|---|---|
| `app/` | React + Vite frontend — the deployed app |
| `app/public/data/` | Static JSON and text files served by Vercel; fetched at runtime |
| `data/` | Working area for pipeline scripts — not deployed directly |
| `services/` | Python scripts that generate or transform data before deployment |
| `environment/app/` | Convenience scripts to install and start the app locally |
| `environment/python/` | `venvCreate.bat` / `venvCreate.sh` — create `.venv` at repo root and install `requirements.txt` |
| `overhang/` | Framework documentation — stages, workflow, backlog |

### `app/public/data/`

Vite serves everything in `public/` at the root URL, so `app/public/data/foo.json` is reachable at `/data/foo.json`. This is where finished artefacts from `data/` are copied before deploying.

Subdirectory convention used in this repo:

| Subfolder | Contents |
|---|---|
| `data/system_prompts/` | System prompt templates (`.txt`); `index.json` lists available files |
| `data/regression_tests/` | Regression test suites (`.json`); `index.json` lists available suites |

### `data/`

Working area for pipeline scripts — separate from `app/public/data/` so that in-progress output doesn't get deployed prematurely. Typical sub-folders:

| Subfolder | Contents |
|---|---|
| `data/raw/` | Original source files (PDFs, CSVs, text) |
| `data/processed/` | Intermediate pipeline output |
| `data/system_prompts/` | System prompts under active development |
| `data/regression_tests/` | Test suites under active development |

Scripts in `services/` write here. Copy finished artefacts to `app/public/data/` before pushing. In simple projects both folders can hold the same files.

### `services/`

Python scripts that run before deployment to generate or transform data. They write output to `data/`; copy to `app/public/data/` when ready to deploy.

Scripts use only the Python standard library — no packages required for the current scripts. Add third-party dependencies to `environment/python/requirements.txt`.

### `environment/`

| Subfolder | Purpose |
|---|---|
| `environment/app/` | `install_app` + `start_app` scripts — local React dev without memorising npm commands |
| `environment/python/` | `venvCreate` scripts — create `.venv` at repo root, activate, install `requirements.txt` |

Claude Code and Vercel each manage their own environments automatically. These scripts exist only as a convenience for developers running things locally.

---

## How to use

1. Copy or fork this repo
2. Delete `app/` and `overhang/stage_*.md` — keep `CLAUDE.md`, `overhang/workflow_stages.md`, `overhang/brainstorm_notes.md`, and `overhang/backlog.md`
3. Open the repo with Claude Code
4. Start at Stage 1

The `CLAUDE.md` file configures agent behaviour, domain knowledge, and the two-layer discipline. Read it before starting a session.

---

## The `environment/` folder

The `environment/` folder contains convenience scripts for setting up local development environments. It is **secondary** in the modern Overhang workflow:

- **Claude Code** sets up whatever it needs inside its own remote container — no local environment scripts required for an agent session
- **Vercel** manages the deployment environment entirely — nothing in `environment/` affects it
- **`environment/app/`** provides shell and bat scripts (install + start) as a convenience for developers who want to run the app locally without memorising npm commands

Include only the `environment/` subfolders relevant to your project. Apps that have no local Python data pipeline need no `environment/python/` folder.

---

## Stack

React · TypeScript · Vite · UnoCSS · React Router · React Query · Vercel

---

## License

MIT — see [LICENSE](../LICENSE).

© 2026 Jurek Föllmer
