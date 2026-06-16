import React, { useEffect, useRef, useState } from 'react'
import type { TestCase, TestRunResult, Score, SessionSummary, ModelKey } from '../types'
import { useRegressionTests } from '../hooks/useRegressionTests'
import { downloadTestCases, downloadRegressionResults } from '../lib/download'
import type { ServerTemplate } from '../lib/overhang'

interface SuiteEntry {
  id: string
  label: string
}

const DEFAULT_THRESHOLD = 0.7

interface Props {
  systemPrompt: string
  responseModel: ModelKey
  evalModel: ModelKey
  tutorEnabled: boolean
  pastSessions: SessionSummary[]
  ollamaResponseModel: string
  ollamaEvalModel: string
  ollamaBaseUrl: string
  onTutorAnalysis?: (text: string) => void
  // Workspace (MCP) integration — all optional
  workspaceId?: string | null
  workspaceResponseModel?: string
  workspaceEvalModel?: string
  templateTestCases?: { query: string; targetAnswer?: string; queryType?: string }[]
  serverTemplates?: ServerTemplate[]
  onTemplatesLoaded?: (count: number) => void
  onLoadSystemPrompt?: (sp: string) => void
  onRegressionPushed?: () => void
}

export function RegressionPanel({
  systemPrompt, responseModel, evalModel, tutorEnabled, pastSessions,
  ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl, onTutorAnalysis,
  workspaceId, workspaceResponseModel, workspaceEvalModel, templateTestCases, serverTemplates = [], onTemplatesLoaded,
  onLoadSystemPrompt: _onLoadSystemPrompt, onRegressionPushed,
}: Props) {
  const [open, setOpen] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [confirmRerun, setConfirmRerun] = useState(false)
  const [hasDownloaded, setHasDownloaded] = useState(false)
  const [suites, setSuites] = useState<SuiteEntry[]>([])
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/data/regression_tests/index.json')
      .then(r => r.json())
      .then(setSuites)
      .catch(() => {})
  }, [])

  const {
    testCases, results, running, runningId,
    tutorAnalysis, tutorAnalysisLoading,
    addTestCase, removeTestCase, clearTestCases, runTests,
  } = useRegressionTests(
    systemPrompt, responseModel, evalModel, tutorEnabled,
    ollamaResponseModel, ollamaEvalModel, ollamaBaseUrl, onTutorAnalysis,
    { workspaceId, workspaceResponseModel, workspaceEvalModel },
    onRegressionPushed,
  )

  const ranIds = Object.keys(results)
  const hasResults = ranIds.length > 0
  const passCount = ranIds.filter(id => {
    const tc = testCases.find(t => t.id === id)
    const r = results[id]
    return r.score !== null && r.score.value >= (tc?.passThreshold ?? DEFAULT_THRESHOLD)
  }).length
  const scores = ranIds.map(id => results[id]?.score?.value).filter((v): v is number => v !== undefined)
  const meanScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null

  function handleRunAll() {
    if (hasResults && !hasDownloaded) {
      setConfirmRerun(true)
    } else {
      setHasDownloaded(false)
      runTests()
    }
  }

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        // Accept both legacy array format and new wrapped { source, testCases: [] } format
        const raw: unknown[] = Array.isArray(parsed) ? parsed : (parsed as { testCases?: unknown[] }).testCases ?? []
        if (!Array.isArray(raw)) throw new Error('Expected a JSON array or { testCases: [] }')
        let count = 0
        for (const item of raw) {
          const tc = item as Record<string, unknown>
          if (typeof tc?.query === 'string' && typeof tc?.targetAnswer === 'string') {
            addTestCase({
              label: typeof tc.label === 'string' ? tc.label : (tc.query as string).slice(0, 50),
              query: tc.query as string,
              targetAnswer: tc.targetAnswer as string,
              passThreshold: typeof tc.passThreshold === 'number' ? tc.passThreshold : undefined,
            })
            count++
          }
        }
        setImportStatus(`Imported ${count} test case${count !== 1 ? 's' : ''}`)
        setTimeout(() => setImportStatus(null), 3000)
      } catch {
        setImportStatus('Invalid JSON file')
        setTimeout(() => setImportStatus(null), 3000)
      }
      e.target.value = ''
    }
    reader.readAsText(file)
  }

  function handleLoadSuite(id: string) {
    if (!id) return
    fetch(`/data/regression_tests/${id}.json`)
      .then(r => r.json())
      .then((raw: unknown) => {
        // Support both plain array and wrapped { name, savedAt, testCases } format
        const items: unknown[] = Array.isArray(raw)
          ? raw
          : Array.isArray((raw as Record<string, unknown>)?.testCases)
            ? (raw as Record<string, unknown>).testCases as unknown[]
            : []
        clearTestCases()
        let count = 0
        for (const item of items) {
          const tc = item as Record<string, unknown>
          if (typeof tc?.query === 'string' && typeof tc?.targetAnswer === 'string') {
            addTestCase({
              label: typeof tc.label === 'string' ? tc.label : (tc.query as string).slice(0, 50),
              query: tc.query as string,
              targetAnswer: tc.targetAnswer as string,
              passThreshold: typeof tc.passThreshold === 'number' ? tc.passThreshold : undefined,
            })
            count++
          }
        }
        setImportStatus(`Loaded ${count} test case${count !== 1 ? 's' : ''}`)
        setTimeout(() => setImportStatus(null), 3000)
      })
      .catch(() => {
        setImportStatus('Failed to load suite')
        setTimeout(() => setImportStatus(null), 3000)
      })
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
      <input
        ref={importInputRef}
        type="file"
        accept=".json,application/json"
        onChange={handleImportFile}
        style={{ display: 'none' }}
      />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem' }}>
        <button onClick={() => setOpen(o => !o)} style={headerToggleStyle}>
          {open ? '▲' : '▼'} Regression tests
          {testCases.length > 0 && (
            <span style={{ marginLeft: '0.4rem', opacity: 0.45, fontWeight: 400 }}>({testCases.length})</span>
          )}
        </button>

        {importStatus && (
          <span style={{ fontSize: '0.75rem', opacity: 0.6, whiteSpace: 'nowrap' }}>{importStatus}</span>
        )}

        <button
          onClick={() => downloadTestCases(testCases)}
          disabled={testCases.length === 0}
          style={iconBtnStyle(testCases.length === 0)}
          title="Export test case definitions"
        >↓</button>

        <button
          onClick={() => importInputRef.current?.click()}
          style={iconBtnStyle(false)}
          title="Import test cases from JSON"
        >↑</button>

        {confirmClear ? (
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Clear all?</span>
            <button onClick={() => { clearTestCases(); setConfirmClear(false) }} style={{ ...iconBtnStyle(false), opacity: 1, background: 'var(--text-h)', color: 'var(--bg)', borderColor: 'var(--text-h)' }}>Yes</button>
            <button onClick={() => setConfirmClear(false)} style={iconBtnStyle(false)}>No</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={testCases.length === 0}
            style={iconBtnStyle(testCases.length === 0)}
            title="Clear all test cases"
          >✕</button>
        )}

        {confirmRerun ? (
          <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', opacity: 0.6, whiteSpace: 'nowrap' }}>Results not downloaded. Rerun?</span>
            <button onClick={() => { setConfirmRerun(false); setHasDownloaded(false); runTests() }} style={{ ...iconBtnStyle(false), opacity: 1, background: 'var(--text-h)', color: 'var(--bg)', borderColor: 'var(--text-h)' }}>Yes</button>
            <button onClick={() => setConfirmRerun(false)} style={iconBtnStyle(false)}>No</button>
          </div>
        ) : (
          <button
            onClick={handleRunAll}
            disabled={running || testCases.length === 0}
            style={runBtnStyle(running || testCases.length === 0)}
          >
            {running ? 'Running…' : 'Run all'}
          </button>
        )}
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border)', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          <ImportFromSessions sessions={pastSessions} onImport={addTestCase} />
          <AddTestCaseForm
            onAdd={addTestCase}
            suites={suites}
            onLoadSuite={handleLoadSuite}
            serverTemplates={[
              ...(templateTestCases?.length
                ? [{ name: `Workspace suite (${templateTestCases.length})`, savedAt: '', testCases: templateTestCases }]
                : []),
              ...serverTemplates,
            ]}
            onLoadServerTemplate={tpl => {
              clearTestCases()
              for (const tc of tpl.testCases) addTestCase({ label: tc.label ?? tc.query.slice(0, 50), query: tc.query, targetAnswer: tc.targetAnswer ?? '', passThreshold: tc.passThreshold })
              onTemplatesLoaded?.(tpl.testCases.length)
            }}
          />

          {testCases.length === 0 ? (
            <p style={{ margin: 0, fontSize: '0.82rem', opacity: 0.4, textAlign: 'center' }}>
              No test cases yet — import or add one above
            </p>
          ) : (
            testCases.map(tc => (
              <TestCaseRow
                key={tc.id}
                testCase={tc}
                result={results[tc.id]}
                isRunning={runningId === tc.id}
                onDelete={() => removeTestCase(tc.id)}
              />
            ))
          )}

          {hasResults && (
            <div style={{
              borderTop: '1px solid var(--border)', paddingTop: '0.65rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap',
            }}>
              <span style={{
                fontSize: '0.83rem', fontWeight: 600,
                color: passCount === ranIds.length ? 'var(--text-h)' : 'var(--text)',
              }}>
                {passCount}/{ranIds.length} passed
              </span>
              {meanScore !== null && (
                <span style={{ fontSize: '0.83rem', opacity: 0.6, fontFamily: 'var(--mono)' }}>
                  mean {meanScore.toFixed(2)}
                </span>
              )}
              <button
                onClick={() => {
                  downloadRegressionResults(testCases, results, tutorAnalysis, systemPrompt)
                  setHasDownloaded(true)
                }}
                disabled={tutorAnalysisLoading}
                style={{ ...iconBtnStyle(tutorAnalysisLoading), marginLeft: 'auto' }}
                title={tutorAnalysisLoading ? 'Waiting for tutor analysis…' : 'Download results as JSON'}
              >{tutorAnalysisLoading ? '↓ results (tutor…)' : '↓ results'}</button>
            </div>
          )}

          {(tutorAnalysis || tutorAnalysisLoading) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, opacity: 0.55 }}>Tutor analysis</span>
              {tutorAnalysisLoading ? (
                <p style={{ margin: 0, fontSize: '0.83rem', opacity: 0.4, fontStyle: 'italic' }}>Analysing results…</p>
              ) : (
                <p style={{ margin: 0, fontSize: '0.83rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {tutorAnalysis}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Import from sessions ──────────────────────────────────────────────────────

function ImportFromSessions({
  sessions, onImport,
}: {
  sessions: SessionSummary[]
  onImport: (tc: Omit<TestCase, 'id'>) => void
}) {
  const [open, setOpen] = useState(false)

  const importable = sessions.filter(s => s.targetAnswer.trim() && s.scoreMaxQuery && s.scoreMax !== null)

  if (importable.length === 0) return null

  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={addBtnStyle}>
        {open ? '▲' : '↓'} Import from sessions ({importable.length})
      </button>

      {open && (
        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <button
            onClick={() => importable.forEach(s => onImport({
              label: s.name,
              query: s.scoreMaxQuery!,
              targetAnswer: s.targetAnswer,
              passThreshold: s.scoreMax!,
            }))}
            style={{ ...addBtnStyle, fontSize: '0.78rem' }}
          >
            Import all ({importable.length})
          </button>
          {importable.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.4rem 0.6rem',
              border: '1px solid var(--border)', borderRadius: 7,
              background: 'var(--code-bg)',
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-h)' }}>
                  {s.name}
                </span>
                <span style={{ fontSize: '0.74rem', opacity: 0.45, marginLeft: '0.4rem' }}>
                  {s.date} · best {s.scoreMax!.toFixed(2)}
                </span>
                <p style={{ margin: '0.1rem 0 0', fontSize: '0.74rem', opacity: 0.5, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {s.scoreMaxQuery}
                </p>
              </div>
              <button
                onClick={() => onImport({
                  label: s.name,
                  query: s.scoreMaxQuery!,
                  targetAnswer: s.targetAnswer,
                  passThreshold: s.scoreMax!,
                })}
                style={{ ...addBtnStyle, fontSize: '0.75rem', padding: '0.25rem 0.55rem', whiteSpace: 'nowrap' }}
              >
                + Import
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Test case row ─────────────────────────────────────────────────────────────

function TestCaseRow({
  testCase, result, isRunning, onDelete,
}: {
  testCase: TestCase
  result: TestRunResult | undefined
  isRunning: boolean
  onDelete: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const score = result?.score ?? null
  const hasError = result?.error != null
  const threshold = testCase.passThreshold ?? DEFAULT_THRESHOLD

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.45rem 0.65rem', background: 'var(--code-bg)',
      }}>
        <StatusDot score={score} running={isRunning} error={hasError} threshold={threshold} />

        <button
          onClick={() => setExpanded(o => !o)}
          style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0, color: 'var(--text-h)' }}
        >
          <span style={{ fontSize: '0.83rem', fontWeight: 600 }}>
            {testCase.label || testCase.query.slice(0, 50)}
          </span>
          {testCase.passThreshold !== undefined && (
            <span style={{ marginLeft: '0.4rem', fontSize: '0.72rem', opacity: 0.45 }}>
              ≥{testCase.passThreshold.toFixed(2)}
            </span>
          )}
          {testCase.label && (
            <span style={{ display: 'block', fontSize: '0.74rem', opacity: 0.45, marginTop: '0.1rem' }}>
              {testCase.query.slice(0, 70)}{testCase.query.length > 70 ? '…' : ''}
            </span>
          )}
        </button>

        {isRunning && <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>running…</span>}

        {score !== null && !isRunning && (
          <span style={{
            fontFamily: 'var(--mono)', fontSize: '0.85rem', fontWeight: 600,
            color: score.value >= threshold ? 'var(--text-h)' : '#888',
            whiteSpace: 'nowrap',
          }}>
            {score.value.toFixed(2)}
          </span>
        )}

        {hasError && !isRunning && (
          <span style={{ fontSize: '0.75rem', color: '#888' }} title={result?.error}>error</span>
        )}

        <button onClick={onDelete} style={deleteBtnStyle} title="Remove test case">×</button>
      </div>

      {expanded && (
        <div style={{ padding: '0.55rem 0.65rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <DetailRow label="Query" text={testCase.query} />
          <DetailRow label="Target" text={testCase.targetAnswer} />
          {result?.response && <DetailRow label="Response" text={result.response} />}
          {(score?.queryType || score?.topic) && (
            <p style={{ margin: 0, fontSize: '0.75rem', opacity: 0.45 }}>
              {[score.queryType, score.topic].filter(Boolean).join(' · ')}
            </p>
          )}
          {score && <p style={{ margin: 0, fontSize: '0.78rem', opacity: 0.6 }}>{score.reasoning}</p>}
          {result?.error && <p style={{ margin: 0, fontSize: '0.78rem', color: '#888' }}>Error: {result.error}</p>}
        </div>
      )}
    </div>
  )
}

function StatusDot({ score, running, error, threshold }: { score: Score | null; running: boolean; error: boolean; threshold: number }) {
  let color = '#ccc'
  if (running) color = 'var(--border)'
  else if (error) color = '#aaa'
  else if (score !== null) color = score.value >= threshold ? 'var(--text-h)' : '#aaa'

  return (
    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, opacity: running ? 0.4 : 1 }} />
  )
}

function DetailRow({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <span style={{ fontSize: '0.72rem', opacity: 0.45, display: 'block', marginBottom: '0.1rem' }}>{label}</span>
      <p style={{ margin: 0, fontSize: '0.8rem', opacity: 0.8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{text}</p>
    </div>
  )
}

// ── Add form ──────────────────────────────────────────────────────────────────

function AddTestCaseForm({ onAdd, suites, onLoadSuite, serverTemplates, onLoadServerTemplate }: {
  onAdd: (tc: Omit<TestCase, 'id'>) => void
  suites: SuiteEntry[]
  onLoadSuite: (id: string) => void
  serverTemplates?: ServerTemplate[]
  onLoadServerTemplate?: (tpl: ServerTemplate) => void
}) {
  const [label, setLabel] = useState('')
  const [threshold, setThreshold] = useState('0.70')
  const [selectedSuite, setSelectedSuite] = useState('')
  const [query, setQuery] = useState('')
  const [target, setTarget] = useState('')
  const [open, setOpen] = useState(false)

  function handleAdd() {
    if (!query.trim() || !target.trim()) return
    const parsed = parseFloat(threshold)
    onAdd({
      label: label.trim() || query.slice(0, 50),
      query: query.trim(),
      targetAnswer: target.trim(),
      passThreshold: !isNaN(parsed) ? Math.max(0, Math.min(1, parsed)) : undefined,
    })
    setLabel(''); setThreshold('0.70'); setQuery(''); setTarget('')
    setOpen(false)
  }

  if (!open) {
    const selectStyle: React.CSSProperties = {
      fontSize: '0.82rem', padding: '0.4rem 0.6rem',
      border: '1px solid var(--border)', borderRadius: 6,
      background: 'var(--code-bg)', color: 'var(--text)', cursor: 'pointer',
    }
    const allSuites = [
      ...suites.map(s => ({ type: 'static' as const, id: s.id, label: s.label })),
      ...(serverTemplates ?? []).map(t => ({ type: 'agent' as const, id: t.name, label: `${t.name} (${t.testCases.length})`, tpl: t })),
    ]
    return (
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setOpen(true)} style={addBtnStyle}>+ Add test case</button>
        {allSuites.length > 0 && (
          <select
            value={selectedSuite}
            onChange={e => {
              const idx = parseInt(e.target.value)
              setSelectedSuite(e.target.value)
              const entry = allSuites[idx]
              if (entry.type === 'static') onLoadSuite(entry.id)
              else onLoadServerTemplate?.(entry.tpl)
            }}
            style={selectStyle}
          >
            <option value="" disabled>Load test suite…</option>
            {allSuites.map((s, idx) => (
              <option key={s.id} value={String(idx)}>{s.label}</option>
            ))}
          </select>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
        <input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Label (optional)"
          style={{ ...inputStyle, flex: 1 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.75rem', opacity: 0.5 }}>pass ≥</span>
          <input
            type="number"
            value={threshold}
            onChange={e => setThreshold(e.target.value)}
            min={0} max={1} step={0.01}
            style={{ ...inputStyle, width: 60, textAlign: 'center' }}
          />
        </div>
      </div>
      <textarea
        value={query}
        onChange={e => setQuery(e.target.value)}
        placeholder="Query"
        rows={2}
        style={textareaStyle}
        autoFocus
      />
      <textarea
        value={target}
        onChange={e => setTarget(e.target.value)}
        placeholder="Target answer — what a good response should contain"
        rows={2}
        style={textareaStyle}
      />
      <div style={{ display: 'flex', gap: '0.4rem' }}>
        <button onClick={handleAdd} disabled={!query.trim() || !target.trim()} style={addBtnStyle}>Add</button>
        <button
          onClick={() => { setOpen(false); setLabel(''); setThreshold('0.70'); setQuery(''); setTarget('') }}
          style={{ ...addBtnStyle, background: 'none', opacity: 0.5 }}
        >Cancel</button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const headerToggleStyle: React.CSSProperties = {
  flex: 1, background: 'none', border: 'none', cursor: 'pointer',
  textAlign: 'left', padding: 0, fontSize: '0.85rem', fontWeight: 600,
  color: 'var(--text-h)', display: 'flex', alignItems: 'center',
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.25rem 0.5rem',
    fontSize: '0.78rem',
    background: 'var(--code-bg)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.3 : 0.7,
    color: 'var(--text)',
    lineHeight: 1,
    flexShrink: 0,
    whiteSpace: 'nowrap' as const,
  }
}

function runBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: '0.3rem 0.7rem', fontSize: '0.78rem',
    background: 'var(--accent)', color: 'var(--bg)',
    border: 'none', borderRadius: 6,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.35 : 1, whiteSpace: 'nowrap' as const,
  }
}

const deleteBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--text)', opacity: 0.35, fontSize: '1.1rem',
  lineHeight: 1, padding: '0 0.1rem', flexShrink: 0,
}

const addBtnStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  background: 'var(--code-bg)', border: '1px solid var(--border)',
  borderRadius: 6, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text)',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '0.4rem 0.6rem',
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-h)',
  fontSize: '0.85rem', boxSizing: 'border-box' as const,
}

const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '0.4rem 0.6rem',
  border: '1px solid var(--border)', borderRadius: 6,
  background: 'var(--bg)', color: 'var(--text-h)',
  fontSize: '0.85rem', resize: 'vertical' as const,
  fontFamily: 'var(--sans)', lineHeight: 1.5, boxSizing: 'border-box' as const,
}
