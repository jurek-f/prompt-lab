# Prompt Lab

**An open-source prompt engineering and evaluation tool for AI applications.**

Prompt Lab gives you a structured, repeatable workflow for improving AI responses — with LLM-as-judge scoring, regression testing across multiple queries, and an AI tutor that tracks your progress across sessions.

Designed for developers and domain experts who need to systematically evaluate and improve prompts for real applications, without requiring ML expertise.

Built with [Claude Code](https://claude.ai/code).

---

## What it does

**Iterative prompt refinement**
Write a system prompt, send a query, get a response. Define a target answer and the judge scores the response 0.0–1.0 with structured reasoning. Iterate.

**Regression testing**
Define a suite of test cases (query + target answer pairs). Run them all against your current system prompt in one click. Results are broken down by query type (`explain`, `generate`, `transform`, `extract`, `compare`, `reason`, `classify`) and topic — so you can see exactly where your prompt generalises and where it breaks.

**AI tutor with session memory**
An AI tutor gives feedback after each attempt and after each test run. It reads your past session summaries, so its advice compounds across sessions rather than starting from scratch each time.

**Download results**
Export full session data and regression results as JSON for offline analysis or sharing.

---

## Models supported

The app detects which API keys are configured and shows only available models. Response model and evaluation model are configured independently.

| Model | Provider | API key required |
|---|---|---|
| Claude Haiku 4.5 | Anthropic | `ANTHROPIC_API_KEY` |
| Claude Sonnet 4.6 | Anthropic | `ANTHROPIC_API_KEY` |
| Claude Opus 4.8 | Anthropic | `ANTHROPIC_API_KEY` |
| Gemini 2.5 Flash Lite | Google | `GEMINI_API_KEY` |
| Gemini 2.5 Flash | Google | `GEMINI_API_KEY` |
| GPT-4o mini | OpenAI | `OPENAI_API_KEY` |
| GPT-4o | OpenAI | `OPENAI_API_KEY` |
| Ollama (local) | — | None — runs on your machine |

### Ollama — local models

Ollama is called directly from the browser (no proxy). To use it:

1. Install Ollama from [ollama.com](https://ollama.com) and pull a model: `ollama pull llama3.2:3b`
2. Start Ollama with CORS open: `OLLAMA_ORIGINS="*" ollama serve` (macOS/Linux) or set `OLLAMA_ORIGINS=*` as a system env var on Windows
3. In Prompt Lab settings: select "Ollama (local)" and enter the model name and base URL

Note: the hosted version of Prompt Lab (HTTPS) cannot reach a local HTTP Ollama instance due to browser mixed-content rules. Ollama works when running Prompt Lab locally. See the in-app FAQ for detailed setup instructions.

---

## Deploy your own instance

**Prerequisites:** a Vercel account and at least one API key.

1. Fork this repo on GitHub
2. Import the fork into Vercel — vercel.com → Add New Project → select your fork
3. Set environment variables in Vercel project settings (add only the keys you have):
   - `ANTHROPIC_API_KEY` — enables Claude Haiku, Sonnet, Opus
   - `GEMINI_API_KEY` — enables Gemini 2.5 Flash Lite and Flash
   - `OPENAI_API_KEY` — enables GPT-4o mini and GPT-4o
4. Deploy — Vercel builds and serves automatically

The app calls `/api/config` on load to detect which keys are present, and only shows the corresponding models in the selector. At least one key is required for cloud models.

API keys are used exclusively in Vercel edge functions (`api/anthropic.ts`, `api/google.ts`, `api/openai.ts`) and are never sent to the browser.

### Running locally

Local development requires **two processes running simultaneously**. No Vercel CLI needed — just Node.js 18+ and npm.

**Set API keys as system environment variables before starting** — Node.js reads them from the OS automatically. The API server prints which keys it found on startup.

**Windows — set keys permanently (survives restarts):**
Start → "Edit the system environment variables" → Environment Variables → User variables → New.
Add `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, and/or `OPENAI_API_KEY`.

**Convenience scripts** (in `environment/app`):

| Script | Platform | What it does |
|---|---|---|
| `install_app_windows.bat` | Windows | Runs `npm install` in `app/` |
| `install_app.sh` | macOS / Linux | Runs `npm install` in `app/` |
| `start_app_windows.bat` | Windows | Starts API server + Vite dev server |
| `start_app.sh` | macOS / Linux | Starts API server + Vite dev server |

Run `install_app` once after cloning, then `start_app` each time to develop. Both scripts navigate to `environment/app` automatically — run them from anywhere in the repo.

**Manual commands** (from the `app/` directory):

| Process | Command | What it does |
|---|---|---|
| API server | `npm run dev:api` | Node.js server on port 3000, reads system env vars |
| Frontend | `npm run dev` | Vite dev server with HMR, proxies `/api` to port 3000 |

Do not store API keys in `.env` files — they can be accidentally committed even with a gitignore entry.

---

## Pre-deployment data pipeline

Test cases and system prompts are generated locally by Python scripts before deployment. The app itself is frontend-only and reads static JSON/text files — it has no backend data pipeline.

**Two separate data folders:**

| Folder | Purpose |
|---|---|
| `data/` | Working area — scripts write here during development |
| `app/public/data/` | Deployed assets — what the app actually serves |

**Scripts** (in `services/`, require `ANTHROPIC_API_KEY`):

`generate_test_cases.py` — generate query + target answer pairs and save them as a test suite, Output is written to `data/regression_tests/`.

`generate_system_prompt.py` — derive a system prompt from a test suite or a single example, Output is written to `data/system_prompts/`.

---

## Security

API keys are set as system environment variables and accessed only in server-side edge functions. They are never bundled into the client JavaScript or visible in the browser. Each user's session data (prompts, scores, tutor history) is stored in their own browser's localStorage and never leaves their device.

---

## Framework

This app was built using the [Overhang](overhang/README.md) framework — a structured workflow for building frontend AI apps with Claude Code. See the `overhang/` directory for the full development process, stage-by-stage.

---

## License

MIT — see [LICENSE](LICENSE).

© 2026 Jurek Föllmer
