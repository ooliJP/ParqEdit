import { useEffect, useRef, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { X, History, Trash2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const RESERVED_WORDS = new Set([
  'case','order','group','table','select','where','from','join','on','as','by',
  'having','limit','offset','union','all','distinct','insert','update','delete',
  'create','drop','alter','index','view','trigger','procedure','function','end',
  'when','then','else','in','not','and','or','is','null','true','false','between',
  'like','exists','column','set','with','return','window','over','partition',
])

function getReservedWordHint(error: string, query: string): string | null {
  if (!error.toLowerCase().includes('syntax error')) return null
  const words = query.match(/\b([a-z_][a-z0-9_]*)\b/gi) ?? []
  const hits = words.filter(w => RESERVED_WORDS.has(w.toLowerCase()))
  if (hits.length > 0) {
    const unique = [...new Set(hits.map(w => `"${w}"`))]
    return `Tip: "${hits[0]}" is a reserved SQL keyword. Wrap column names in double quotes: ${unique.slice(0, 3).join(', ')}`
  }
  return null
}

export function SQLEditor() {
  const { sqlQuery, setSqlQuery, runSqlQuery, setSqlEditorOpen, error, sqlHistory, clearSqlHistory, theme } = useAppStore()
  const [historyOpen, setHistoryOpen] = useState(false)
  const historyRef = useRef<HTMLDivElement>(null)

  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)

  // Close the history dropdown on outside click
  useEffect(() => {
    if (!historyOpen) return
    function handler(e: MouseEvent) {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) setHistoryOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [historyOpen])

  async function run() {
    if (!sqlQuery.trim() || sqlQuery.trim() === 'SELECT * FROM current_data WHERE') return
    await runSqlQuery()
  }

  function close() {
    setSqlEditorOpen(false)
  }

  const hint = error ? getReservedWordHint(error, sqlQuery) : null

  return (
    <div
      className="shrink-0 border-b flex flex-col"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', maxHeight: 220 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b text-xs"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
      >
        <span className="mono-label font-medium" style={{ color: 'var(--accent)', letterSpacing: '0.08em' }}>SQL QUERY</span>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-muted)' }}>
            Table name: <code className="font-mono px-1 rounded" style={{ background: 'var(--bg-hover)', color: 'var(--text)' }}>current_data</code>
          </span>
          <div className="relative" ref={historyRef}>
            <button
              className="btn py-0.5 px-2"
              onClick={() => setHistoryOpen((v) => !v)}
              title="Query history"
              style={historyOpen ? { color: 'var(--accent)', background: 'var(--bg-hover)' } : undefined}
            >
              <History size={12} />
            </button>
            {historyOpen && (
              <div
                className="absolute right-0 mt-1 rounded-lg shadow-xl overflow-hidden animate-fade-in flex flex-col"
                style={{
                  top: '100%',
                  width: 420,
                  maxWidth: '80vw',
                  zIndex: 60,
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
                  {sqlHistory.length === 0 ? (
                    <div className="px-3 py-4 text-center" style={{ color: 'var(--text-muted)' }}>
                      No queries yet — run one and it will show up here.
                    </div>
                  ) : (
                    sqlHistory.map((q, i) => (
                      <div
                        key={i}
                        className="px-3 py-1.5 font-mono truncate cursor-pointer transition-colors"
                        style={{ color: 'var(--text)' }}
                        title={q}
                        onClick={() => { setSqlQuery(q); setHistoryOpen(false) }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                      >
                        {q}
                      </div>
                    ))
                  )}
                </div>
                {sqlHistory.length > 0 && (
                  <button
                    className="flex items-center justify-center gap-1.5 py-1.5 border-t transition-colors"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    onClick={() => { clearSqlHistory(); setHistoryOpen(false) }}
                  >
                    <Trash2 size={11} />
                    Clear history
                  </button>
                )}
              </div>
            )}
          </div>
          <button className="btn py-0.5 px-2" onClick={close}>
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-auto" style={{ minHeight: 80 }}>
        <CodeMirror
          value={sqlQuery}
          onChange={(v) => setSqlQuery(v)}
          extensions={[sql()]}
          theme={isDark ? 'dark' : 'light'}
          style={{ height: '100%' }}
          basicSetup={{
            lineNumbers: false,
            foldGutter: false,
            highlightActiveLine: true,
            autocompletion: true,
          }}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault()
              run()
            }
          }}
        />
      </div>

      {/* Footer */}
      <div
        className="flex items-start justify-between px-3 py-1.5 border-t gap-3"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex flex-col gap-0.5 flex-1 min-w-0">
          {error ? (
            <span className="text-xs truncate" style={{ color: 'var(--unsaved)' }}>{error}</span>
          ) : (
            <span className="mono-label" style={{ color: 'var(--text-muted)' }}>CTRL+⏎ to run</span>
          )}
          {hint && (
            <span className="text-xs" style={{ color: 'var(--t-str)' }}>{hint}</span>
          )}
        </div>
        <button className="btn-primary text-xs py-1 px-3.5 shrink-0" onClick={run}>
          Run →
        </button>
      </div>
    </div>
  )
}
