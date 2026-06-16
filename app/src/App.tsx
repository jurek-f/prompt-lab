import React, { useEffect, useRef, useState } from 'react'
import { SessionControlBar } from './components/SessionControlBar'
import { HistoryPanel } from './components/HistoryPanel'
import { PromptArea } from './components/PromptArea'
import { AnswerArea } from './components/AnswerArea'
import { TargetAnswerSection } from './components/TargetAnswerSection'
import { SystemPromptPanel } from './components/SystemPromptPanel'
import { TutorFloatingPanel } from './components/TutorFloatingPanel'
import { SummarizeAndNewDialog } from './components/SummarizeAndNewDialog'
import { RegressionPanel } from './components/RegressionPanel'
import { useSession } from './hooks/useSession'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { storage } from './lib/storage'
import { downloadSummaries } from './lib/download'
import { MODEL_LABELS, MODEL_PROVIDER, PROVIDER_GROUPS } from './types'
import type { ModelKey, ApiProvider } from './types'

const TOPBAR_H = 44

type LegalPage = 'faq' | 'about' | 'privacy' | 'impressum' | 'datenschutz'

export default function App() {
  const [newSessionOpen, setNewSessionOpen] = useState(false)
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null)
  const [systemPrompt, setSystemPrompt] = useState(() => storage.getSystemPrompt())
  const [query, setQuery] = useState('')
  const [panelOrder, setPanelOrder] = useState<Array<'settings' | 'tutor'>>([])
  const settingsOpen = panelOrder.includes('settings')
  const tutorPanelOpen = panelOrder.includes('tutor')
  const [availableProviders, setAvailableProviders] = useState<Set<ApiProvider> | null>(null)
  const rightColRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const tutorBtnRef = useRef<HTMLButtonElement>(null)
  const sendBtnRef = useRef<HTMLButtonElement>(null)
  const [sendInView, setSendInView] = useState(true)

  function togglePanel(p: 'settings' | 'tutor') {
    setPanelOrder(prev => prev.includes(p) ? prev.filter(x => x !== p) : [p, ...prev])
  }

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.ok ? r.json() : null)
      .then((data: { anthropic?: boolean; google?: boolean; openai?: boolean } | null) => {
        if (!data) return
        const providers = new Set<ApiProvider>(['ollama'])
        if (data.anthropic) providers.add('anthropic')
        if (data.google) providers.add('google')
        if (data.openai) providers.add('openai')
        setAvailableProviders(providers)
        const firstAvailable = PROVIDER_GROUPS
          .filter(g => g.provider !== 'ollama')
          .flatMap(g => g.keys.filter(k => providers.has(MODEL_PROVIDER[k])))[0]
        if (firstAvailable) {
          if (!providers.has(MODEL_PROVIDER[responseModel])) setResponseModel(firstAvailable)
          if (!providers.has(MODEL_PROVIDER[evalModel])) setEvalModel(firstAvailable)
        }
      })
      .catch(() => { /* leave null → show all */ })
  }, [])

  useEffect(() => {
    const el = sendBtnRef.current
    if (!el) return
    const obs = new IntersectionObserver(([entry]) => setSendInView(entry.isIntersecting), { threshold: 0 })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // Close all panels on outside click
  useEffect(() => {
    if (panelOrder.length === 0) return
    function onDown(e: MouseEvent) {
      const t = e.target as Node
      if (!rightColRef.current?.contains(t) &&
          !settingsBtnRef.current?.contains(t) &&
          !tutorBtnRef.current?.contains(t)) {
        setPanelOrder([])
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelOrder.length])

  const {
    session, pastSessions, loading, tutorLoading, summarizing, sendError,
    responseModel, setResponseModel, evalModel, setEvalModel,
    ollamaResponseModel, setOllamaResponseModel, ollamaEvalModel, setOllamaEvalModel, ollamaBaseUrl, setOllamaBaseUrl,
    setTarget, setName, setTutorEnabled, clearSession, clearPastSessions,
    sendPrompt, sendTutorMessage, addTutorMessage, summarizeAndStartNew,
  } = useSession()

  useBeforeUnload(session.exchanges.length > 0)

  async function handleSend() {
    await sendPrompt(systemPrompt, query, storage.getSettings())
  }

  async function handleNewSession() {
    await summarizeAndStartNew()
    setNewSessionOpen(false)
  }

  const tutorBusy = loading || tutorLoading

  // Tutor unread dot: show orange when panel is closed and new messages arrived
  const lastSeenTutorCountRef = useRef(0)
  useEffect(() => {
    if (tutorPanelOpen) lastSeenTutorCountRef.current = session.tutorChat.length
  }, [tutorPanelOpen, session.tutorChat.length])
  const hasTutorNew = !tutorPanelOpen && session.tutorChat.length > lastSeenTutorCountRef.current

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>
      {/* Top bar — fixed so it's always visible (mobile keyboard, scroll, etc.) */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        height: TOPBAR_H,
        background: 'var(--bg)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Inner row constrained to same max-width as main content */}
        <div style={{
          maxWidth: 720, width: '100%', margin: '0 auto',
          height: '100%', padding: '0 0.75rem',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxSizing: 'border-box',
        }}>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '-0.3px', color: 'var(--text-h)', flexShrink: 0 }}>
          Prompt Lab
        </span>

        {/* Send — fills remaining space; hidden while in-view content button is visible */}
        {!sendInView && (
          <button
            onClick={handleSend}
            disabled={loading || !query.trim()}
            style={{
              flex: 1, padding: '0.3rem 0.75rem',
              background: 'var(--accent)', color: 'var(--bg)',
              border: 'none', borderRadius: 6, fontSize: '0.82rem',
              cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !query.trim() ? 0.45 : 1,
              whiteSpace: 'nowrap', minWidth: 0,
            }}
          >
            {loading ? 'Running…' : `Send${session.exchanges.length > 0 ? ` (#${session.exchanges.length + 1})` : ''}`}
          </button>
        )}

        {/* Tutor + Settings — always right-aligned */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <button
          ref={tutorBtnRef}
          onClick={() => togglePanel('tutor')}
          style={{ ...topbarBtn(tutorPanelOpen), display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          title="Open tutor chat"
        >
          Tutor
          {(session.tutorEnabled || hasTutorNew) && (
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: hasTutorNew ? '#f5a623' : tutorBusy ? 'var(--border)' : 'var(--accent)',
              flexShrink: 0, opacity: hasTutorNew || !tutorBusy ? 1 : 0.5,
            }} />
          )}
          <span style={{ opacity: 0.5, fontSize: '0.72rem' }}>{tutorPanelOpen ? '▲' : '▼'}</span>
        </button>

        <button
          ref={settingsBtnRef}
          onClick={() => togglePanel('settings')}
          style={{ ...topbarBtn(settingsOpen), flexShrink: 0 }}
          title="Model settings"
          aria-label="Model settings"
        >⚙</button>
        </div>{/* end tutor+settings group */}

        </div>{/* end inner constrained row */}
      </div>

      {/* Spacer for fixed top bar */}
      <div style={{ height: TOPBAR_H, flexShrink: 0 }} />

      {/* Main content */}
      <div style={{
        flex: 1, padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
        maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box',
      }}>

        {/* 1a. Send button — snaps up to title bar when scrolled past */}
        <button
          ref={sendBtnRef}
          onClick={handleSend}
          disabled={loading || !query.trim()}
          style={{
            width: '100%', padding: '0.45rem 0.75rem',
            background: 'var(--accent)', color: 'var(--bg)',
            border: 'none', borderRadius: 7, fontSize: '0.88rem',
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !query.trim() ? 0.45 : 1,
          }}
        >
          {loading ? 'Running…' : `Send${session.exchanges.length > 0 ? ` (#${session.exchanges.length + 1})` : ''}`}
        </button>

        {/* 1b. Query area */}
        <PromptArea
          query={query}
          loading={loading}
          onQueryChange={setQuery}
          onSend={handleSend}
        />

        {/* 2. Answer area */}
        {sendError && (
          <div style={{
            padding: '0.6rem 0.85rem', borderRadius: 8,
            background: 'var(--code-bg)', border: '1px solid var(--border)',
            fontSize: '0.83rem', color: 'var(--text)', fontFamily: 'var(--mono)',
            wordBreak: 'break-all',
          }}>
            Error: {sendError}
          </div>
        )}
        <AnswerArea exchanges={session.exchanges} loading={loading} />

        {/* 3. Target answer */}
        <TargetAnswerSection targetAnswer={session.targetAnswer} onChange={setTarget} />

        {/* 4. Session controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)' }}>Session</span>
          <SessionControlBar
            session={session}
            onNameChange={setName}
            onNewSession={() => setNewSessionOpen(true)}
            onClear={clearSession}
          />
        </div>

        {/* 5. Past sessions */}
        <HistoryPanel
          summaries={pastSessions}
          onDownload={() => downloadSummaries(pastSessions)}
          onClearHistory={clearPastSessions}
        />

        {/* 6. System prompt */}
        <SystemPromptPanel
          systemPrompt={systemPrompt}
          onChange={v => { setSystemPrompt(v); storage.setSystemPrompt(v) }}
        />

        {/* 7. Regression tests */}
        <RegressionPanel
          systemPrompt={systemPrompt}
          responseModel={responseModel}
          evalModel={evalModel}
          tutorEnabled={session.tutorEnabled}
          pastSessions={pastSessions}
          ollamaResponseModel={ollamaResponseModel}
          ollamaEvalModel={ollamaEvalModel}
          ollamaBaseUrl={ollamaBaseUrl}
          onTutorAnalysis={addTutorMessage}
        />
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: '0.6rem 1rem',
        display: 'flex', gap: '0.5rem',
        justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {(['faq', 'about', 'privacy', 'datenschutz', 'impressum'] as LegalPage[]).map(p => (
          <button key={p} onClick={() => setLegalPage(p)} style={legalBtn}>
            {p === 'faq' ? 'FAQ' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

      {/* Right-aligned docked panels — stacked under one another, latest opened on top */}
      {panelOrder.length > 0 && (
        <div ref={rightColRef} style={{
          position: 'fixed', top: TOPBAR_H + 6, right: '0.75rem',
          width: 380, maxWidth: 'calc(100vw - 1.5rem)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem',
          zIndex: 30,
        }}>
          {panelOrder.map(panel => {
            if (panel === 'settings') return (
              <div key="settings" style={panelCardStyle}>
                <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <ModelSelect label="Prompt model" value={responseModel} onChange={setResponseModel} availableProviders={availableProviders} />
                  <div style={{ height: 1, background: 'var(--border)' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <ModelSelect label="Evaluation AI" value={evalModel} onChange={setEvalModel} availableProviders={availableProviders} />
                    <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.45 }}>used for scoring &amp; tutor</p>
                  </div>
                  {(responseModel === 'ollama' || evalModel === 'ollama') && (
                    <>
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      <OllamaConfig
                        ollamaResponseModel={ollamaResponseModel}
                        ollamaEvalModel={ollamaEvalModel}
                        ollamaBaseUrl={ollamaBaseUrl}
                        onResponseModelChange={setOllamaResponseModel}
                        onEvalModelChange={setOllamaEvalModel}
                        onBaseUrlChange={setOllamaBaseUrl}
                        showResponseModel={responseModel === 'ollama'}
                        showEvalModel={evalModel === 'ollama'}
                      />
                    </>
                  )}
                </div>
              </div>
            )
            if (panel === 'tutor') return (
              <div key="tutor" style={{ ...panelCardStyle, height: 'min(480px, 60vh)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <TutorFloatingPanel
                  messages={session.tutorChat}
                  tutorEnabled={session.tutorEnabled}
                  loading={tutorLoading}
                  responseLoading={loading}
                  onTutorToggle={setTutorEnabled}
                  onUserMessage={sendTutorMessage}
                  onClose={() => togglePanel('tutor')}
                />
              </div>
            )
            return null
          })}
        </div>
      )}

      {newSessionOpen && (
        <SummarizeAndNewDialog
          session={session}
          onConfirm={handleNewSession}
          onCancel={() => setNewSessionOpen(false)}
          summarizing={summarizing}
        />
      )}

      {legalPage && <LegalModal page={legalPage} onClose={() => setLegalPage(null)} />}
    </div>
  )
}

const panelCardStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  overflow: 'hidden',
}

function topbarBtn(active: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.55rem',
    background: active ? 'var(--accent-bg)' : 'var(--code-bg)',
    border: `1px solid ${active ? 'var(--accent-border)' : 'var(--border)'}`,
    borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer',
    color: active ? 'var(--accent)' : 'var(--text)',
    whiteSpace: 'nowrap' as const, flexShrink: 0,
  }
}

function ModelSelect({ label, value, onChange, availableProviders }: {
  label: string
  value: ModelKey
  onChange: (v: ModelKey) => void
  availableProviders: Set<ApiProvider> | null
}) {
  const visibleGroups = PROVIDER_GROUPS
    .map(g => ({
      ...g,
      keys: availableProviders === null ? g.keys : g.keys.filter(k => availableProviders.has(MODEL_PROVIDER[k])),
    }))
    .filter(g => g.keys.length > 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-h)' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value as ModelKey)}
        style={{
          padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--code-bg)', color: 'var(--text-h)',
          fontSize: '0.85rem', cursor: 'pointer', width: '100%',
        }}
      >
        {visibleGroups.flatMap(g => [
          <option key={`__${g.provider}`} disabled>── {g.label}</option>,
          ...g.keys.map(k => (
            <option key={k} value={k}>{MODEL_LABELS[k]}</option>
          )),
        ])}
      </select>
    </div>
  )
}

function OllamaConfig({ ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl, onResponseModelChange, onEvalModelChange, onBaseUrlChange, showResponseModel, showEvalModel }: {
  ollamaResponseModel: string
  ollamaEvalModel: string
  ollamaBaseUrl: string
  onResponseModelChange: (v: string) => void
  onEvalModelChange: (v: string) => void
  onBaseUrlChange: (v: string) => void
  showResponseModel: boolean
  showEvalModel: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-h)' }}>Ollama settings</span>
      {showResponseModel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.72rem', opacity: 0.55 }}>Prompt model</label>
          <input
            value={ollamaResponseModel}
            onChange={e => onResponseModelChange(e.target.value)}
            placeholder="gemma3:1b"
            style={settingsInputStyle}
          />
        </div>
      )}
      {showEvalModel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.72rem', opacity: 0.55 }}>Eval / tutor model</label>
          <input
            value={ollamaEvalModel}
            onChange={e => onEvalModelChange(e.target.value)}
            placeholder="gemma3:1b"
            style={settingsInputStyle}
          />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={{ fontSize: '0.72rem', opacity: 0.55 }}>Base URL</label>
        <input
          value={ollamaBaseUrl}
          onChange={e => onBaseUrlChange(e.target.value)}
          placeholder="http://localhost:11434"
          style={settingsInputStyle}
        />
      </div>
      <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.4 }}>
        Calls Ollama directly from your browser. Ollama must allow CORS from this origin.
      </p>
    </div>
  )
}

const settingsInputStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem',
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-h)',
  fontSize: '0.82rem', width: '100%', boxSizing: 'border-box',
  fontFamily: 'var(--mono)',
}

const legalBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'inherit', opacity: 0.45, fontSize: '0.7rem',
  padding: '0.1rem 0.2rem',
}

function LegalModal({ page, onClose }: { page: LegalPage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(15,18,30,0.6)', backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '2rem 1rem', overflowY: 'auto',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: '12px', padding: '2rem 2.25rem',
          width: '100%', maxWidth: '720px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          position: 'relative', color: 'var(--text-h)',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'transparent', border: '1px solid var(--border)',
            borderRadius: '6px', cursor: 'pointer', color: 'inherit',
            padding: '0.2rem 0.55rem', fontSize: '1rem', lineHeight: 1, opacity: 0.6,
          }}
        >✕</button>
        <div style={{ fontSize: '0.92rem', lineHeight: 1.75 }}>
          {page === 'faq'         && <FAQ />}
          {page === 'about'       && <About />}
          {page === 'privacy'     && <Privacy />}
          {page === 'datenschutz' && <Datenschutz />}
          {page === 'impressum'   && <Impressum />}
        </div>
      </div>
    </div>
  )
}

function FAQ() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>FAQ</h1>

      <H2>General</H2>

      <p><strong>Where is my data stored?</strong><br />
      Everything — your prompts, scores, session history, and test cases — is stored in your browser's localStorage. Nothing leaves your device except the API calls you make (which go through a server-side proxy that does not log your content).</p>

      <p><strong>Do I need an API key?</strong><br />
      Not for the hosted version. The API key is configured in the deployment and shared across users. If you deploy your own instance (see the GitHub repo), you supply your own key as a Vercel environment variable. For Ollama (local models), no API key is needed at all.</p>

      <p><strong>Which model should I use for prompting vs. evaluation?</strong><br />
      Haiku is fast and cheap — good default for both. Use Sonnet as the eval model when you want more precise scoring. Flash (Gemini) is a useful alternative if you want a different "judge" perspective. Mixing models (e.g. Haiku for responses, Sonnet for scoring) is a valid strategy.</p>

      <H2>Ollama — local models</H2>

      <p><strong>How do I install Ollama?</strong><br />
      Download from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>ollama.com</a> and install it. Then pull a model:</p>
      <pre style={preStyle}>{`ollama pull llama3.2:3b   # ~2 GB, good starting point
ollama pull llama3.2:1b   # ~1 GB, very fast
ollama pull llama3.1:8b   # ~5 GB, noticeably better`}</pre>

      <p><strong>Why does the browser get a connection error when calling Ollama?</strong><br />
      Two likely causes:</p>
      <ul>
        <li><strong>Ollama isn't running.</strong> Start it from a terminal and leave it open:
          <pre style={preStyle}>{`# macOS / Linux
OLLAMA_ORIGINS="*" ollama serve

# Windows PowerShell
$env:OLLAMA_ORIGINS="*"; ollama serve`}</pre>
        </li>
        <li><strong>CORS is blocked.</strong> By default Ollama only accepts requests from localhost — not from a browser tab. Setting <code style={codeStyle}>OLLAMA_ORIGINS="*"</code> fixes this. If you set it as a permanent system environment variable, restart Ollama after.</li>
      </ul>

      <p><strong>How do I set the environment variable permanently on Windows?</strong></p>
      <ol>
        <li>Search "environment variables" in the Start menu → "Edit the system environment variables"</li>
        <li>User Variables → New</li>
        <li>Name: <code style={codeStyle}>OLLAMA_ORIGINS</code>, Value: <code style={codeStyle}>*</code></li>
        <li>OK — then quit and restart Ollama (right-click tray icon → Quit, then reopen)</li>
      </ol>

      <p><strong>curl says "Bad hostname" or won't run multi-line on Windows.</strong><br />
      The backslash <code style={codeStyle}>\</code> line-continuation is Unix-only. On Windows, run curl as a single line or use PowerShell's built-in method:</p>
      <pre style={preStyle}>{`# PowerShell — single line
curl.exe http://localhost:11434/v1/chat/completions \`
  -H "Content-Type: application/json" \`
  -d '{"model":"llama3.2:3b","messages":[{"role":"user","content":"hi"}]}'

# Or use Invoke-RestMethod (no escaping needed)
Invoke-RestMethod -Uri http://localhost:11434/v1/chat/completions \`
  -Method Post -ContentType "application/json" \`
  -Body '{"model":"llama3.2:3b","messages":[{"role":"user","content":"hi"}]}'`}</pre>

      <p><strong>I'm using the hosted app (https://…) but Ollama still won't connect.</strong><br />
      Browsers block HTTPS pages from making requests to plain HTTP endpoints (mixed content). The hosted Prompt Lab is served over HTTPS; your local Ollama runs on HTTP. To use Ollama, either run Prompt Lab locally (<code style={codeStyle}>vercel dev</code> or clone and <code style={codeStyle}>npm run dev</code>), or put Ollama behind an HTTPS reverse proxy (e.g. Caddy with a self-signed cert).</p>

      <p><strong>Where do I enter the Ollama model name and base URL?</strong><br />
      Open Settings (⚙ in the top bar) → select "Ollama (local)" as either the prompt model or evaluation model → the Ollama settings section appears below with fields for model name and base URL.</p>

      <H2>Scoring &amp; regression tests</H2>

      <p><strong>How does the 0–1 score work?</strong><br />
      The evaluation model reads your system prompt, query, response, and target answer, then scores how well the response meets the target. 1.0 = fully correct and complete, 0.0 = completely wrong or missing. The score also includes a query type (explain / generate / transform / etc.) and a short topic label — useful for spotting where your prompt generalises vs. breaks.</p>

      <p><strong>No score appears after sending.</strong><br />
      Scoring only runs when a target answer is set. Add one in the "Target answer" section before sending, or set it and re-run.</p>

      <p><strong>What is the pass threshold in regression tests?</strong><br />
      Each test case has a configurable pass threshold (default 0.7). A test passes if its score meets or exceeds that value. Set a lower threshold for open-ended tasks where wording varies, higher for factual or structured output tasks.</p>
    </>
  )
}

const preStyle: React.CSSProperties = {
  background: 'var(--code-bg)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0.6rem 0.8rem',
  fontSize: '0.8rem', fontFamily: 'var(--mono)',
  overflowX: 'auto', margin: '0.4rem 0 0.8rem',
  lineHeight: 1.55, whiteSpace: 'pre',
}

const codeStyle: React.CSSProperties = {
  background: 'var(--code-bg)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '0.1rem 0.35rem',
  fontSize: '0.82em', fontFamily: 'var(--mono)',
}

const H2 = ({ id, children }: { id?: string; children: React.ReactNode }) => (
  <h2 id={id} style={{ color: 'var(--text-h)', marginTop: '1.75rem', marginBottom: '0.5rem' }}>{children}</h2>
)

function About() {
  useEffect(() => {
    const id = 'li-badge-script'
    if (document.getElementById(id)) return
    const script = document.createElement('script')
    script.id = id
    script.src = 'https://platform.linkedin.com/badges/js/profile.js'
    script.async = true; script.defer = true
    document.body.appendChild(script)
  }, [])
  return (
    <>
      <h1 style={{ marginTop: 0 }}>About Prompt Lab</h1>
      <div style={{ marginBottom: '1.5rem' }}>
        <div className="badge-base LI-profile-badge" data-locale="en_US" data-size="medium"
          data-theme="light" data-type="VERTICAL" data-vanity="jurek-foellmer" data-version="v1">
          <a className="badge-base__link LI-simple-link"
            href="https://de.linkedin.com/in/jurek-foellmer?trk=profile-badge"
            target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>
            Jurek Föllmer
          </a>
        </div>
      </div>
      <H2>Content &amp; AI disclaimer</H2>
      <p>App developed by Jurek Föllmer. Responses are generated by your selected AI model — Anthropic Claude, Google Gemini, OpenAI GPT, or a local model via Ollama — depending on your settings.</p>
      <ul>
        <li>AI-generated content may be incorrect, incomplete, or misleading</li>
        <li>Scores and tutor feedback are AI-generated and not infallible</li>
        <li>This tool is for learning and exploration only</li>
      </ul>
      <H2>Hosting disclaimer</H2>
      <p>This is open-source software (MIT licence). If you are operating your own deployment of this tool, you are solely responsible for your own data processing, API key management, and legal compliance — including any applicable privacy notices and legal disclosures required in your jurisdiction.</p>
      <H2>Contact</H2>
      <p>Original author: <a href="mailto:jurek-f@hotmail.de" style={{ color: 'var(--accent)' }}>jurek-f@hotmail.de</a></p>
    </>
  )
}

function Privacy() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Privacy Policy</h1>
      <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Last updated: 31 May 2026</p>
      <H2>1. Controller</H2>
      <p>This is open-source software. The operator of the instance you are using is responsible for data processing under applicable law. If you are operating your own deployment, replace this section with your own name and contact details.</p>
      <H2>2. Data processed</H2>
      <p>Your prompts and session data are stored locally in your browser (localStorage) only. They are not stored on any server operated by this app.</p>
      <p>When you send a prompt, it is forwarded to the AI provider corresponding to your selected model via a server-side proxy. The proxy does not log or retain your prompts. Which provider receives your data depends on your model selection:</p>
      <ul>
        <li><strong>Anthropic Claude models</strong> — sent to api.anthropic.com</li>
        <li><strong>Google Gemini models</strong> — sent to generativelanguage.googleapis.com</li>
        <li><strong>OpenAI GPT models</strong> — sent to api.openai.com</li>
        <li><strong>Ollama (local)</strong> — sent directly from your browser to your local machine only; no data leaves your device</li>
      </ul>
      <p>No cookies are set by this app. No analytics or tracking tools are used.</p>
      <H2>3. Hosting — Vercel Inc.</H2>
      <p>Hosted by Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA. Standard server logs (IP, timestamp, URL) are processed by Vercel. See <a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>vercel.com/legal/privacy-policy</a>.</p>
      <H2>4. AI providers</H2>
      <p>Depending on your model selection, your prompts may be processed by one or more of the following providers. Please review their respective privacy policies:</p>
      <ul>
        <li><strong>Anthropic</strong> — <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>anthropic.com/privacy</a></li>
        <li><strong>Google</strong> — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>policies.google.com/privacy</a></li>
        <li><strong>OpenAI</strong> — <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>openai.com/privacy</a></li>
      </ul>
      <H2>5. Your rights</H2>
      <p>To exercise GDPR rights, contact the operator of the instance you are using. The competent supervisory authority depends on the operator's country of residence.</p>
    </>
  )
}

function Datenschutz() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Datenschutzerklärung</h1>
      <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Stand: 31. Mai 2026</p>
      <H2>1. Verantwortlicher</H2>
      <p>Diese Software ist Open Source. Verantwortlich für die Datenverarbeitung ist der Betreiber der von Ihnen verwendeten Instanz. Wenn Sie eine eigene Instanz betreiben, ersetzen Sie diesen Abschnitt durch Ihren Namen und Ihre Kontaktdaten.</p>
      <H2>2. Verarbeitete Daten</H2>
      <p>Ihre Prompts und Sitzungsdaten werden ausschließlich lokal in Ihrem Browser (localStorage) gespeichert und nicht auf Servern dieser Anwendung abgelegt.</p>
      <p>Beim Absenden eines Prompts wird dieser über einen serverseitigen Proxy an den KI-Anbieter Ihrer gewählten Modellauswahl weitergeleitet. Der Proxy protokolliert oder speichert keine Prompts. Welcher Anbieter Ihre Daten erhält, hängt von Ihrer Modellauswahl ab:</p>
      <ul>
        <li><strong>Anthropic Claude-Modelle</strong> – Übermittlung an api.anthropic.com</li>
        <li><strong>Google Gemini-Modelle</strong> – Übermittlung an generativelanguage.googleapis.com</li>
        <li><strong>OpenAI GPT-Modelle</strong> – Übermittlung an api.openai.com</li>
        <li><strong>Ollama (lokal)</strong> – direkte Übermittlung vom Browser an Ihren lokalen Rechner; keine Daten verlassen Ihr Gerät</li>
      </ul>
      <p>Es werden keine Cookies gesetzt und keine Analyse- oder Tracking-Tools eingesetzt.</p>
      <H2>3. Hosting: Vercel Inc.</H2>
      <p>Hosting durch Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA. Vercel verarbeitet Standard-Server-Logs als Auftragsverarbeiter gem. Art. 28 DSGVO. DPA: <a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>vercel.com/legal/dpa</a>.</p>
      <H2>4. KI-Anbieter</H2>
      <p>Je nach Modellauswahl können Ihre Prompts von einem oder mehreren der folgenden Anbieter verarbeitet werden. Bitte beachten Sie deren Datenschutzerklärungen:</p>
      <ul>
        <li><strong>Anthropic</strong> – <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>anthropic.com/privacy</a></li>
        <li><strong>Google</strong> – <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>policies.google.com/privacy</a></li>
        <li><strong>OpenAI</strong> – <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>openai.com/privacy</a></li>
      </ul>
      <H2>5. Ihre Rechte</H2>
      <p>Zur Geltendmachung Ihrer Rechte nach Art. 15–21 DSGVO wenden Sie sich an den Betreiber der von Ihnen verwendeten Instanz. Die zuständige Aufsichtsbehörde richtet sich nach dem Sitz des Betreibers.</p>
    </>
  )
}

function Impressum() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Impressum</h1>
      <p>Das Impressum ist eine gesetzliche Pflichtangabe für Betreiber von Websites in Deutschland und anderen deutschsprachigen Ländern (§ 5 DDG). Es muss vom jeweiligen Betreiber dieser Anwendung ausgefüllt werden.</p>
      <p>Diese Software ist Open Source (MIT-Lizenz). Die ursprünglichen Entwickler übernehmen keine Verantwortung für den Betrieb einzelner Instanzen durch Dritte.</p>
      <H2>Betreiber dieser Instanz</H2>
      <p style={{ opacity: 0.6 }}>Wenn Sie diese Instanz betreiben, fügen Sie hier Ihre Pflichtangaben gemäß § 5 DDG ein: Name, Adresse, Kontakt, ggf. Umsatzsteuer-ID und Verantwortlicher im Sinne des Presserechts.</p>
    </>
  )
}
