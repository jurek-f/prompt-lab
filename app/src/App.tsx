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
import { McpPanel } from './components/McpPanel'
import { useSession } from './hooks/useSession'
import { useMcpSession } from './hooks/useMcpSession'
import { useBeforeUnload } from './hooks/useBeforeUnload'
import { storage } from './lib/storage'
import { setActiveInput } from './lib/overhang'
import { downloadSummaries } from './lib/download'
import { MODEL_LABELS, MODEL_PROVIDER, PROVIDER_GROUPS } from './types'
import type { ModelKey, ApiProvider } from './types'

const TOPBAR_H = 44
type LegalPage = 'faq' | 'about' | 'privacy' | 'impressum' | 'datenschutz'

export default function App() {
  const [newSessionOpen, setNewSessionOpen] = useState(false)
  const [templatesSynced, setTemplatesSynced] = useState(0)
  const [sessionPushedAt, setSessionPushedAt] = useState<number | null>(null)
  const [regressionPushedAt, setRegressionPushedAt] = useState<number | null>(null)
  const [legalPage, setLegalPage] = useState<LegalPage | null>(null)
  const [systemPrompt, setSystemPrompt] = useState(() => storage.getSystemPrompt())
  const [query, setQuery] = useState('')
  const [panelOrder, setPanelOrder] = useState<Array<'settings' | 'mcp' | 'tutor'>>([])
  const settingsOpen = panelOrder.includes('settings')
  const mcpOpen = panelOrder.includes('mcp')
  const tutorPanelOpen = panelOrder.includes('tutor')
  const [availableProviders, setAvailableProviders] = useState<Set<ApiProvider> | null>(null)
  const rightColRef = useRef<HTMLDivElement>(null)
  const settingsBtnRef = useRef<HTMLButtonElement>(null)
  const mcpBtnRef = useRef<HTMLButtonElement>(null)
  const tutorBtnRef = useRef<HTMLButtonElement>(null)
  const sendBtnRef = useRef<HTMLButtonElement>(null)
  const [sendInView, setSendInView] = useState(true)

  // MCP workspace
  const mcp = useMcpSession()
  const wsActive = mcp.connected && mcp.hasApiKey  // full workspace mode: connected + has API key
  const wsConnected = mcp.connected                // workspace connected (no key needed for reading)
  // Sync indicator: agent prompt non-null and differs from local textarea (immediate, no poll lag)
  // No empty-string guard: empty agent prompt still differs from user's typed content
  const hasSyncPending = wsConnected &&
    mcp.agentSystemPrompt !== null &&
    mcp.agentSystemPrompt !== systemPrompt

  // Auto-sync query/target from agent once per workspace connection (at connect time only)
  const autoSyncedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (!wsConnected || !mcp.workspaceId) { autoSyncedForRef.current = null; return }
    if (autoSyncedForRef.current === mcp.workspaceId) return
    if (mcp.agentActiveQuery === null && mcp.agentActiveTarget === null) return
    autoSyncedForRef.current = mcp.workspaceId
    if (mcp.agentActiveQuery) setQuery(mcp.agentActiveQuery)
    if (mcp.agentActiveTarget) setTarget(mcp.agentActiveTarget)
  }, [wsConnected, mcp.workspaceId, mcp.agentActiveQuery, mcp.agentActiveTarget])
  // Infer a default model from registered keys if availableModels/selectedModel aren't set yet
  function inferWsModel(): string {
    const fromServer = mcp.selectedModel || mcp.availableModels[0]
    if (fromServer) return fromServer
    if (mcp.hasApiKeys.google) return 'gemini-2.5-flash-lite'
    if (mcp.hasApiKeys.anthropic) return 'claude-haiku-4-5-20251001'
    if (mcp.hasApiKeys.openai) return 'gpt-4o-mini'
    return ''
  }

  // Separate workspace model selections for prompt and eval
  const [wsResponseModel, setWsResponseModel] = useState('')
  const [wsEvalModel, setWsEvalModel] = useState('')

  // Sync both selectors when the server provides a default model or workspace changes
  useEffect(() => {
    if (!wsActive) { setWsResponseModel(''); setWsEvalModel(''); return }
    const m = inferWsModel()
    if (m) {
      setWsResponseModel(prev => prev || m)
      setWsEvalModel(prev => prev || m)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsActive, mcp.selectedModel, mcp.availableModels.join(',')])

  function togglePanel(p: 'settings' | 'mcp' | 'tutor') {
    setPanelOrder(prev => prev.includes(p) ? prev.filter(x => x !== p) : [p, ...prev])
  }

  const {
    session, pastSessions, loading, tutorLoading, summarizing, sendError,
    responseModel, setResponseModel, evalModel, setEvalModel,
    ollamaResponseModel, setOllamaResponseModel, ollamaEvalModel, setOllamaEvalModel, ollamaBaseUrl, setOllamaBaseUrl,
    setTarget, setName, setTutorEnabled, clearSession, clearPastSessions,
    sendPrompt, sendTutorMessage, addTutorMessage, summarizeAndStartNew,
  } = useSession(wsActive ? {
    workspaceId: mcp.workspaceId,
    workspaceResponseModel: wsResponseModel || inferWsModel(),
    workspaceEvalModel: wsEvalModel || inferWsModel(),
    onSessionPushed: () => setSessionPushedAt(Date.now()),
  } : {})

  // Fetch Vercel env key availability for standalone model selection
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
      })
      .catch(() => {})
  }, [])

  // Auto-correct model selection when provider availability becomes known
  useEffect(() => {
    if (!availableProviders || wsActive) return
    const isAvail = (m: ModelKey) => availableProviders.has(MODEL_PROVIDER[m])
    const firstAvail = () => PROVIDER_GROUPS.flatMap(g => g.keys).find(isAvail)
    if (!isAvail(responseModel)) { const f = firstAvail(); if (f) setResponseModel(f) }
    if (!isAvail(evalModel)) { const f = firstAvail(); if (f) setEvalModel(f) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableProviders, wsActive])

  // Sticky send button observer
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
          !mcpBtnRef.current?.contains(t) &&
          !tutorBtnRef.current?.contains(t)) {
        setPanelOrder([])
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [panelOrder.length])

  useBeforeUnload(session.exchanges.length > 0)

  // Auto-push active query and target to workspace (debounced 800ms)
  const activeInputTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!wsActive || !mcp.workspaceId) return
    if (activeInputTimerRef.current) clearTimeout(activeInputTimerRef.current)
    activeInputTimerRef.current = setTimeout(() => {
      setActiveInput(mcp.workspaceId!, query || undefined, session.targetAnswer || undefined).catch(() => {})
    }, 800)
    return () => { if (activeInputTimerRef.current) clearTimeout(activeInputTimerRef.current) }
  }, [query, session.targetAnswer, wsActive, mcp.workspaceId])

  function handleSystemPromptChange(v: string) {
    setSystemPrompt(v)
    storage.setSystemPrompt(v)
    mcp.pushSystemPromptToMcp(v)
  }

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

  // Providers for settings panel
  const wsAvailableProviders: Set<ApiProvider> | null = wsActive ? new Set<ApiProvider>([
    'ollama',
    ...(mcp.hasApiKeys.anthropic ? (['anthropic'] as ApiProvider[]) : []),
    ...(mcp.hasApiKeys.google ? (['google'] as ApiProvider[]) : []),
    ...(mcp.hasApiKeys.openai ? (['openai'] as ApiProvider[]) : []),
  ]) : null
  const effectiveProviders = wsActive ? wsAvailableProviders : availableProviders

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh' }}>

      {/* ── Fixed top bar ── */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20,
        height: TOPBAR_H, background: 'var(--bg)', borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: 720, width: '100%', margin: '0 auto', height: '100%',
          padding: '0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem',
          boxSizing: 'border-box' as const,
        }}>
          <span style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '-0.3px', color: 'var(--text-h)', flexShrink: 0 }}>
            Prompt Lab
          </span>

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

            {/* MCP workspace button */}
            <button
              ref={mcpBtnRef}
              onClick={() => togglePanel('mcp')}
              style={{ ...topbarBtn(mcpOpen), display: 'flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}
              title="Workspace (MCP)"
            >
              MCP
              <span title={mcp.checking ? 'Connecting…' : !mcp.connected ? 'Disconnected' : hasSyncPending ? 'System prompt differs — open to sync' : 'Connected · in sync'} style={{
                width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                background: mcp.checking ? 'var(--border)' : !mcp.connected ? '#888' : hasSyncPending ? '#f5a623' : '#4caf50',
                opacity: mcp.checking ? 0.5 : 1,
              }} />
              {(sessionPushedAt || regressionPushedAt) && (
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>↑</span>
              )}
              <span style={{ opacity: 0.5, fontSize: '0.72rem' }}>{mcpOpen ? '▲' : '▼'}</span>
            </button>

            <button ref={settingsBtnRef} onClick={() => togglePanel('settings')} style={{ ...topbarBtn(settingsOpen), flexShrink: 0 }} title="Model settings" aria-label="Model settings">⚙</button>
          </div>
        </div>
      </div>

      <div style={{ height: TOPBAR_H, flexShrink: 0 }} />

      {/* ── Main content ── */}
      <div style={{
        flex: 1, padding: '1rem',
        display: 'flex', flexDirection: 'column', gap: '1rem',
        maxWidth: 720, width: '100%', margin: '0 auto', boxSizing: 'border-box' as const,
      }}>

        {/* Send — snaps to top bar when scrolled past */}
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

        <PromptArea query={query} loading={loading} onQueryChange={setQuery} onSend={handleSend} />

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

        <TargetAnswerSection targetAnswer={session.targetAnswer} onChange={setTarget} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)' }}>Session</span>
          <SessionControlBar
            session={session}
            onNameChange={setName}
            onNewSession={() => setNewSessionOpen(true)}
            onClear={clearSession}
          />
        </div>

        <HistoryPanel
          summaries={pastSessions}
          onDownload={() => downloadSummaries(pastSessions)}
          onClearHistory={clearPastSessions}
        />

        <SystemPromptPanel systemPrompt={systemPrompt} onChange={handleSystemPromptChange} serverSystemPromptTemplates={mcp.serverSystemPromptTemplates} />

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
          workspaceId={wsConnected ? mcp.workspaceId : null}
          workspaceResponseModel={wsActive ? (wsResponseModel || inferWsModel()) : undefined}
          workspaceEvalModel={wsActive ? (wsEvalModel || inferWsModel()) : undefined}
          templateTestCases={mcp.templateTestCases}
          serverTemplates={mcp.serverTemplates}
          onTemplatesLoaded={setTemplatesSynced}
          onLoadSystemPrompt={handleSystemPromptChange}
          onRegressionPushed={() => setRegressionPushedAt(Date.now())}
        />
      </div>

      {/* Footer */}
      <div style={{
        borderTop: '1px solid var(--border)', padding: '0.6rem 1rem',
        display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap',
      }}>
        {(['faq', 'about', 'privacy', 'datenschutz', 'impressum'] as LegalPage[]).map(p => (
          <button key={p} onClick={() => setLegalPage(p)} style={legalBtn}>
            {p === 'faq' ? 'FAQ' : p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>

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
                  {wsActive && mcp.availableModels.length > 0 ? (
                    <>
                      <WorkspaceModelSelect
                        label="Prompt model"
                        models={mcp.availableModels}
                        value={wsResponseModel || inferWsModel()}
                        onChange={m => { setWsResponseModel(m); mcp.setSelectedModel(m) }}
                      />
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <WorkspaceModelSelect
                          label="Eval model"
                          models={mcp.availableModels}
                          value={wsEvalModel || inferWsModel()}
                          onChange={setWsEvalModel}
                        />
                        <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.45 }}>used for scoring &amp; tutor</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <ModelSelect label="Prompt model" value={responseModel} onChange={setResponseModel} availableProviders={effectiveProviders} />
                      <div style={{ height: 1, background: 'var(--border)' }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <ModelSelect label="Evaluation AI" value={evalModel} onChange={setEvalModel} availableProviders={effectiveProviders} />
                        <p style={{ margin: 0, fontSize: '0.72rem', opacity: 0.45 }}>used for scoring &amp; tutor</p>
                      </div>
                    </>
                  )}
                  {(responseModel === 'ollama' || evalModel === 'ollama') && !wsActive && (
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
            if (panel === 'mcp') return (
              <div key="mcp" style={{ ...panelCardStyle, maxHeight: 'min(480px, 60vh)', overflowY: 'auto' }}>
                <McpPanel
                  workspaceId={mcp.workspaceId}
                  connected={mcp.connected}
                  checking={mcp.checking}
                  hasApiKey={mcp.hasApiKey}
                  hasApiKeys={mcp.hasApiKeys}
                  suggestions={mcp.suggestions}
                  regressionStatus={mcp.regressionStatus}
                  agentSystemPrompt={mcp.agentSystemPrompt}
                  syncing={mcp.syncing}
                  syncError={mcp.syncError}
                  systemPrompt={systemPrompt}
                  sessionPushedAt={sessionPushedAt}
                  regressionPushedAt={regressionPushedAt}
                  onCreateSession={mcp.createSession}
                  onConnectToSession={mcp.connectToSession}
                  onClearSession={() => { mcp.clearSession(); setSessionPushedAt(null); setRegressionPushedAt(null) }}
                  onApproveSuggestion={mcp.approveSuggestion}
                  onRejectSuggestion={mcp.rejectSuggestion}
                  onSystemPromptChange={handleSystemPromptChange}
                  templatesSynced={templatesSynced}
                  hasSyncPending={hasSyncPending}
                />
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

// ── Top bar helpers ────────────────────────────────────────────────────────────

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

// ── Model selectors ────────────────────────────────────────────────────────────

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

function WorkspaceModelSelect({ label, models, value, onChange }: {
  label: string
  models: string[]
  value: string
  onChange: (v: string) => void | Promise<void>
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-h)' }}>{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '0.35rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6,
          background: 'var(--code-bg)', color: 'var(--text-h)',
          fontSize: '0.85rem', cursor: 'pointer', width: '100%',
        }}
      >
        {models.map(m => <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}

function OllamaConfig({
  ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl,
  onResponseModelChange, onEvalModelChange, onBaseUrlChange,
  showResponseModel, showEvalModel,
}: {
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
          <input value={ollamaResponseModel} onChange={e => onResponseModelChange(e.target.value)} placeholder="gemma3:1b" style={settingsInputStyle} />
        </div>
      )}
      {showEvalModel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.72rem', opacity: 0.55 }}>Eval / tutor model</label>
          <input value={ollamaEvalModel} onChange={e => onEvalModelChange(e.target.value)} placeholder="gemma3:1b" style={settingsInputStyle} />
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        <label style={{ fontSize: '0.72rem', opacity: 0.55 }}>Base URL</label>
        <input value={ollamaBaseUrl} onChange={e => onBaseUrlChange(e.target.value)} placeholder="http://localhost:11434" style={settingsInputStyle} />
      </div>
      <p style={{ margin: 0, fontSize: '0.7rem', opacity: 0.4 }}>
        Calls Ollama directly from your browser. Ollama must allow CORS from this origin.
      </p>
    </div>
  )
}

const panelCardStyle: React.CSSProperties = {
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
  overflow: 'hidden',
}

const settingsInputStyle: React.CSSProperties = {
  padding: '0.3rem 0.5rem', border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-h)', fontSize: '0.82rem',
  width: '100%', boxSizing: 'border-box' as const, fontFamily: 'var(--mono)',
}

const legalBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'inherit', opacity: 0.45, fontSize: '0.7rem', padding: '0.1rem 0.2rem',
}

// ── Legal modal ────────────────────────────────────────────────────────────────

function LegalModal({ page, onClose }: { page: LegalPage; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 50,
      background: 'rgba(15,18,30,0.6)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '2rem 1rem', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '2rem 2.25rem',
        width: '100%', maxWidth: '720px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        position: 'relative', color: 'var(--text-h)',
      }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: '1rem', right: '1rem',
          background: 'transparent', border: '1px solid var(--border)',
          borderRadius: '6px', cursor: 'pointer', color: 'inherit',
          padding: '0.2rem 0.55rem', fontSize: '1rem', lineHeight: 1, opacity: 0.6,
        }}>✕</button>
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

const H2 = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ color: 'var(--text-h)', marginTop: '1.75rem', marginBottom: '0.5rem' }}>{children}</h2>
)

const codeStyle: React.CSSProperties = {
  background: 'var(--code-bg)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '0.1rem 0.35rem', fontSize: '0.82em', fontFamily: 'var(--mono)',
}

const preStyle: React.CSSProperties = {
  background: 'var(--code-bg)', border: '1px solid var(--border)',
  borderRadius: 6, padding: '0.6rem 0.8rem',
  fontSize: '0.8rem', fontFamily: 'var(--mono)',
  overflowX: 'auto', margin: '0.4rem 0 0.8rem', lineHeight: 1.55, whiteSpace: 'pre',
}

function FAQ() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>FAQ</h1>
      <H2>Getting started</H2>
      <p><strong>What is Prompt Lab?</strong><br />
      A browser-based tool for iterating on system prompts. Enter a query, see the response, score it against a target, and refine your prompt. Connect a Claude Code agent via the Workspace panel to run automated optimisation loops.</p>
      <p><strong>Do I need an API key?</strong><br />
      In standalone mode: an Anthropic, Google, or OpenAI API key must be configured in the deployment environment. In workspace mode: your Claude Code agent registers its own keys — no key entry in the browser.</p>
      <H2>Workspace (MCP)</H2>
      <p><strong>How do I connect my Claude Code agent?</strong><br />
      Create a workspace in the Workspace panel, then pass the ID to your agent: <code style={codeStyle}>start_optimization &lt;id&gt;</code>. Or use <code style={codeStyle}>start_web_app</code> to create a workspace and get a URL in one step.</p>
      <p><strong>Which models are available in workspace mode?</strong><br />
      The agent calls <code style={codeStyle}>list_models</code> with its API keys, which registers the keys and available models. The ⚙ settings panel shows whichever models the agent registered.</p>
      <H2>Ollama — local models</H2>
      <p><strong>How do I use Ollama?</strong><br />
      Download from <a href="https://ollama.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>ollama.com</a>, start with CORS enabled:</p>
      <pre style={preStyle}>{`OLLAMA_ORIGINS="*" ollama serve`}</pre>
      <p>Then select "Ollama (local)" in Settings (⚙) and enter your model name and base URL.</p>
      <H2>Scoring</H2>
      <p><strong>How does the 0–1 score work?</strong><br />
      The evaluation model compares the response to your target answer and assigns a score: 1.0 = fully correct, 0.0 = completely wrong. Scoring only runs when a target answer is set.</p>
    </>
  )
}

function About() {
  useEffect(() => {
    const id = 'li-badge-script'
    if (document.getElementById(id)) return
    const script = document.createElement('script')
    script.id = id; script.src = 'https://platform.linkedin.com/badges/js/profile.js'
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
      <p>App developed by Jurek Föllmer. AI model calls are made by either the selected provider (standalone mode) or your connected Claude Code agent (workspace mode).</p>
      <H2>Contact</H2>
      <p>Original author: <a href="mailto:jurek-f@hotmail.de" style={{ color: 'var(--accent)' }}>jurek-f@hotmail.de</a></p>
    </>
  )
}

function Privacy() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Privacy Policy</h1>
      <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Last updated: 10 June 2026</p>
      <H2>1. Data processed</H2>
      <p>Your prompts and session data are stored locally in your browser (localStorage) only. In workspace mode, system prompts and test cases are stored in the MCP server session (in-memory, not persisted to a database).</p>
      <p>API calls go to your selected AI provider through a server-side proxy. No cookies or tracking.</p>
      <H2>2. Hosting</H2>
      <p>Web UI on Vercel. MCP server on Railway. Standard server logs processed by each provider.</p>
      <H2>3. AI providers</H2>
      <ul>
        <li>Anthropic — <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>anthropic.com/privacy</a></li>
        <li>Google — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>policies.google.com/privacy</a></li>
        <li>OpenAI — <a href="https://openai.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)' }}>openai.com/privacy</a></li>
      </ul>
    </>
  )
}

function Datenschutz() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Datenschutzerklärung</h1>
      <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>Stand: 10. Juni 2026</p>
      <H2>1. Verarbeitete Daten</H2>
      <p>Prompts und Sitzungsdaten werden ausschließlich lokal im Browser (localStorage) gespeichert. Im Workspace-Modus werden System-Prompts und Testfälle in der MCP-Server-Sitzung gespeichert (flüchtig, kein persistenter Speicher).</p>
      <p>Keine Cookies, kein Tracking.</p>
      <H2>2. Hosting</H2>
      <p>Web-UI auf Vercel, MCP-Server auf Railway. Standard-Server-Logs der jeweiligen Anbieter.</p>
    </>
  )
}

function Impressum() {
  return (
    <>
      <h1 style={{ marginTop: 0 }}>Impressum</h1>
      <p>Das Impressum ist eine gesetzliche Pflichtangabe für Betreiber von Websites in Deutschland (§ 5 DDG).</p>
      <H2>Betreiber dieser Instanz</H2>
      <p style={{ opacity: 0.6 }}>Wenn Sie diese Instanz betreiben, fügen Sie hier Ihre Pflichtangaben gemäß § 5 DDG ein.</p>
    </>
  )
}
