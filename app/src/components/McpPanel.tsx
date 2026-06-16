import React, { useState } from 'react'
import type { LabSuggestion, LabRegressionStatus } from '../lib/overhang'

interface Props {
  workspaceId: string | null
  connected: boolean
  checking: boolean
  hasApiKey: boolean
  hasApiKeys: { anthropic: boolean; google: boolean; openai: boolean }
  suggestions: LabSuggestion[]
  regressionStatus: LabRegressionStatus | null
  agentSystemPrompt: string | null
  syncing: boolean
  syncError: string | null
  systemPrompt: string
  sessionPushedAt: number | null
  regressionPushedAt: number | null
  onCreateSession: (systemPrompt: string) => Promise<void>
  onConnectToSession: (id: string) => Promise<void>
  onClearSession: () => void
  onApproveSuggestion: (id: string) => Promise<string | null>
  onRejectSuggestion: (id: string) => Promise<void>
  onSystemPromptChange: (prompt: string) => void
  templatesSynced: number
  hasSyncPending: boolean
}

export function McpPanel({
  workspaceId, connected, checking, hasApiKey, hasApiKeys, suggestions, regressionStatus,
  agentSystemPrompt,
  syncing, syncError, systemPrompt, sessionPushedAt, regressionPushedAt,
  onCreateSession, onConnectToSession, onClearSession,
  onApproveSuggestion, onRejectSuggestion, onSystemPromptChange,
  templatesSynced, hasSyncPending,
}: Props) {
  const [connectInput, setConnectInput] = useState('')
  const [showConnect, setShowConnect] = useState(false)
  const [copied, setCopied] = useState(false)
  const [approvingId, setApprovingId] = useState<string | null>(null)
  const [rejectingId, setRejectingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const shortId = workspaceId ? workspaceId.slice(0, 8) : null

  function copyCommand() {
    if (!workspaceId) return
    navigator.clipboard.writeText(`start_optimization ${workspaceId}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleApprove(id: string) {
    setApprovingId(id)
    const newPrompt = await onApproveSuggestion(id)
    if (newPrompt) onSystemPromptChange(newPrompt)
    setApprovingId(null)
    setExpandedId(null)
  }

  async function handleReject(id: string) {
    setRejectingId(id)
    await onRejectSuggestion(id)
    setRejectingId(null)
    setExpandedId(null)
  }

  async function handleConnect() {
    const id = connectInput.trim()
    if (!id) return
    await onConnectToSession(id)
    setConnectInput('')
    setShowConnect(false)
  }

  return (
    <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

          {/* ── No workspace ── */}
          {!workspaceId && (
            <>
              <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.55, lineHeight: 1.5 }}>
                Connect to your Claude Code agent to enable MCP-assisted prompt optimisation.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <button
                  onClick={() => onCreateSession(systemPrompt)}
                  disabled={syncing}
                  style={primaryBtnStyle(syncing)}
                >
                  {syncing ? 'Creating…' : '+ New workspace'}
                </button>
                <p style={{ margin: 0, fontSize: '0.74rem', opacity: 0.4, lineHeight: 1.5 }}>
                  Creates a workspace on the server and pushes your current test cases to it.
                  System prompt pushes on your next edit.
                  The agent does not receive this automatically — it must call <span style={{ fontFamily: 'var(--mono)' }}>pull_regression</span> / <span style={{ fontFamily: 'var(--mono)' }}>pull_session</span>.
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: '0.72rem', opacity: 0.35 }}>or</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>
              {showConnect ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <input
                      value={connectInput}
                      onChange={e => setConnectInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleConnect() }}
                      placeholder="Paste workspace ID from Claude Code"
                      autoFocus
                      style={inputStyle}
                    />
                    <button onClick={handleConnect} disabled={!connectInput.trim() || syncing} style={secondaryBtnStyle(!connectInput.trim() || syncing)}>
                      Connect
                    </button>
                    <button onClick={() => { setShowConnect(false); setConnectInput('') }} style={ghostBtnStyle}>✕</button>
                  </div>
                  <p style={{ margin: 0, fontSize: '0.74rem', opacity: 0.4, lineHeight: 1.5 }}>
                    Connecting pushes your current test cases to that workspace.
                    The agent must call <span style={{ fontFamily: 'var(--mono)' }}>pull_regression</span> to access them.
                  </p>
                </div>
              ) : (
                <button onClick={() => setShowConnect(true)} style={ghostBtnStyle}>
                  Connect to existing workspace ID
                </button>
              )}
              {syncError && <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>{syncError}</p>}
            </>
          )}

          {/* ── Workspace not found ── */}
          {workspaceId && !connected && !checking && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.55 }}>
                Workspace <code style={codeStyle}>{shortId}…</code> not found — it may have expired.
                Previous workspace data on the server is gone.
                Your local test cases are still here and will be pushed to a new workspace.
              </p>
              <button onClick={() => onCreateSession(systemPrompt)} disabled={syncing} style={primaryBtnStyle(syncing)}>
                {syncing ? 'Creating…' : '+ New workspace'}
              </button>
              <button onClick={onClearSession} style={ghostBtnStyle}>
                Connect to a different workspace ID
              </button>
              {syncError && <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>{syncError}</p>}
            </div>
          )}

          {/* ── Connected ── */}
          {connected && workspaceId && (
            <>
              {/* Connection status summary */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.3rem 0.6rem', borderRadius: 6, background: 'var(--code-bg)', fontSize: '0.74rem', color: 'var(--text-h)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: hasSyncPending ? '#f5a623' : '#4caf50' }} />
                {hasSyncPending ? 'System prompt differs' : 'System prompt synced'}
              </div>

              {/* Workspace ID + copy command */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.74rem', opacity: 0.45 }}>Workspace ID</span>
                  <code style={{ ...codeStyle, flex: 1, padding: '0.3rem 0.5rem', fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {workspaceId}
                  </code>
                  <button onClick={copyCommand} style={secondaryBtnStyle(false)} title="Copy start_optimization command">
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={onClearSession} style={ghostBtnStyle} title="Disconnect">✕</button>
                </div>
              </div>

              {/* API key status — keys registered by the agent via register_api_key */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {(['anthropic', 'google', 'openai'] as const).map(p => (
                  <span key={p} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.74rem', opacity: hasApiKeys[p] ? 1 : 0.35 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: hasApiKeys[p] ? 'var(--accent)' : 'var(--border)', display: 'inline-block' }} />
                    {p}
                  </span>
                ))}
                {!hasApiKey && (
                  <span style={{ fontSize: '0.74rem', opacity: 0.45, marginLeft: '0.25rem' }}>— agent: call <code style={{ fontFamily: 'var(--mono)', fontSize: '0.9em' }}>register_api_key</code></span>
                )}
              </div>

              {/* Sync status */}
              {/* Sync status labels */}
              {sessionPushedAt && (
                <SyncLabel label="Session history synced" toolName="pull_session" />
              )}
              {regressionPushedAt && (
                <SyncLabel label="Regression history synced" toolName="pull_regression" />
              )}

              {/* Template sync notification */}
              {templatesSynced > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.35rem 0.6rem', borderRadius: 7,
                  border: '1px solid var(--accent-border, var(--accent))',
                  background: 'var(--accent-bg, #1a1a2e)', fontSize: '0.75rem',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
                  <span style={{ color: 'var(--accent)' }}>
                    {templatesSynced} test case{templatesSynced !== 1 ? 's' : ''} loaded into regression suite from workspace
                  </span>
                </div>
              )}

              {/* System prompt sync block — shown whenever agent and UI prompts differ */}
              {agentSystemPrompt !== null && agentSystemPrompt !== systemPrompt && (
                <div style={{
                  padding: '0.5rem 0.65rem',
                  background: 'var(--accent-bg, #1a1a2e)', border: '1px solid var(--accent-border, var(--accent))',
                  borderRadius: 7, display: 'flex', flexDirection: 'column', gap: '0.35rem',
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                    System prompt differs
                  </span>
                  {agentSystemPrompt !== '' ? (
                    <>
                      <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.65, fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', maxHeight: 60, overflowY: 'auto' }}>
                        {agentSystemPrompt.slice(0, 200)}{agentSystemPrompt.length > 200 ? '…' : ''}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => onSystemPromptChange(agentSystemPrompt)}
                          style={{ ...secondaryBtnStyle(false), fontSize: '0.75rem' }}>
                          Pull
                        </button>
                        <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>or request the agent to pull</span>
                      </div>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.72rem', opacity: 0.5 }}>Agent has no system prompt — request the agent to pull yours.</span>
                  )}
                </div>
              )}

              {/* Regression status from agent */}
              {regressionStatus && regressionStatus.totalRuns > 0 && (
                <RegressionStatus status={regressionStatus} />
              )}

              {/* Suggestions */}
              {suggestions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)' }}>
                    Agent suggestions
                  </span>
                  {suggestions.map(s => (
                    <SuggestionCard
                      key={s.id} suggestion={s}
                      expanded={expandedId === s.id}
                      approving={approvingId === s.id}
                      rejecting={rejectingId === s.id}
                      onToggle={() => setExpandedId(id => id === s.id ? null : s.id)}
                      onApprove={() => handleApprove(s.id)}
                      onReject={() => handleReject(s.id)}
                    />
                  ))}
                </div>
              )}

      </>
    )}
  </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SuggestionCard({
  suggestion, expanded, approving, rejecting,
  onToggle, onApprove, onReject,
}: {
  suggestion: LabSuggestion
  expanded: boolean
  approving: boolean
  rejecting: boolean
  onToggle: () => void
  onApprove: () => void
  onReject: () => void
}) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.45rem 0.65rem', background: 'var(--code-bg)' }}>
        <button
          onClick={onToggle}
          style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'var(--text-h)' }}
        >
          <span style={{ fontSize: '0.82rem', fontWeight: 600 }}>
            {expanded ? '▲' : '▼'} Iteration {suggestion.iteration + 1} suggestion
          </span>
          {suggestion.expectedGain && (
            <span style={{ display: 'block', fontSize: '0.74rem', opacity: 0.5, marginTop: '0.1rem' }}>
              {suggestion.expectedGain}
            </span>
          )}
        </button>
        <button onClick={onReject} disabled={rejecting || approving} style={secondaryBtnStyle(rejecting || approving)}>
          {rejecting ? '…' : 'Reject'}
        </button>
        <button onClick={onApprove} disabled={approving || rejecting} style={approveBtnStyle(approving || rejecting)}>
          {approving ? 'Applying…' : 'Apply'}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: '0.6rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.45, display: 'block', marginBottom: '0.2rem' }}>Reasoning</span>
            <p style={{ margin: 0, fontSize: '0.8rem', lineHeight: 1.6, opacity: 0.8, whiteSpace: 'pre-wrap' }}>
              {suggestion.reasoning}
            </p>
          </div>
          <div>
            <span style={{ fontSize: '0.72rem', opacity: 0.45, display: 'block', marginBottom: '0.2rem' }}>Proposed system prompt</span>
            <pre style={promptPreStyle}>{suggestion.prompt}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function RegressionStatus({ status }: { status: import('../lib/overhang').LabRegressionStatus }) {
  const [open, setOpen] = useState(false)
  const goal = status.optimizationGoal
  const goalMet = goal && status.passRate >= goal.targetScore

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'var(--code-bg)', border: 'none',
          padding: '0.45rem 0.65rem', cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-h)', flex: 1 }}>
          {open ? '▲' : '▼'} Agent results — iter {status.iteration}
        </span>
        <span style={{
          fontSize: '0.78rem', fontFamily: 'var(--mono)', fontWeight: 600,
          color: goalMet ? 'var(--accent)' : 'var(--text)',
        }}>
          {status.passRate}% ({status.passCount}/{status.passCount + status.failCount})
        </span>
        {goal && (
          <span style={{ fontSize: '0.72rem', opacity: 0.5, whiteSpace: 'nowrap' }}>
            {goalMet ? '✓ goal' : `goal ${goal.targetScore}%`}
          </span>
        )}
      </button>

      {open && (
        <div style={{ padding: '0.5rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', opacity: 0.6, marginBottom: '0.1rem' }}>
            <span>avg {status.averageScore}/100</span>
            {status.untestedCount > 0 && <span>{status.untestedCount} untested</span>}
            {goal && <span>max {goal.maxIterations} iter</span>}
          </div>
          {status.byTestCase.map(tc => (
            <div key={tc.testCaseId} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: tc.status === 'pass' ? 'var(--accent)' : tc.status === 'fail' ? '#888' : 'var(--border)',
              }} />
              <span style={{
                fontSize: '0.78rem', flex: 1, overflow: 'hidden',
                whiteSpace: 'nowrap', textOverflow: 'ellipsis', opacity: 0.8,
              }}>
                {tc.query.slice(0, 60)}{tc.query.length > 60 ? '…' : ''}
              </span>
              <span style={{ fontSize: '0.75rem', fontFamily: 'var(--mono)', opacity: 0.55, flexShrink: 0 }}>
                {tc.latestScore !== null ? `${tc.latestScore}/100` : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function SyncLabel({ label, toolName }: { label: string; toolName: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', opacity: 0.65 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, display: 'inline-block' }} />
      <span>{label} — agent: call <code style={{ fontFamily: 'var(--mono)', fontSize: '0.9em' }}>{toolName}</code></span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const codeStyle: React.CSSProperties = {
  background: 'var(--code-bg)', border: '1px solid var(--border)',
  borderRadius: 4, padding: '0.1rem 0.3rem',
  fontSize: '0.82em', fontFamily: 'var(--mono)',
}

const inputStyle: React.CSSProperties = {
  flex: 1, padding: '0.35rem 0.6rem',
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-h)',
  fontSize: '0.83rem', fontFamily: 'var(--mono)',
  boxSizing: 'border-box' as const,
}

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.4rem 0.75rem', fontSize: '0.83rem',
    background: 'var(--accent)', color: 'var(--bg)',
    border: 'none', borderRadius: 7,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.4 : 1, alignSelf: 'flex-start' as const,
  }
}

function secondaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.65rem', fontSize: '0.8rem',
    background: 'var(--code-bg)', border: '1px solid var(--border)',
    borderRadius: 6, cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 0.8, color: 'var(--text)', whiteSpace: 'nowrap' as const,
  }
}

function approveBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.65rem', fontSize: '0.8rem',
    background: 'var(--accent)', color: 'var(--bg)',
    border: 'none', borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1, whiteSpace: 'nowrap' as const,
  }
}

const ghostBtnStyle: React.CSSProperties = {
  padding: '0.3rem 0.55rem', fontSize: '0.8rem',
  background: 'none', border: '1px solid var(--border)',
  borderRadius: 6, cursor: 'pointer', opacity: 0.6,
  color: 'var(--text)', alignSelf: 'flex-start' as const,
}

const promptPreStyle: React.CSSProperties = {
  margin: 0, padding: '0.5rem 0.6rem',
  background: 'var(--bg)', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: '0.8rem', fontFamily: 'var(--mono)',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  lineHeight: 1.55, maxHeight: 200, overflowY: 'auto',
}
