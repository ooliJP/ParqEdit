import CodeMirror from '@uiw/react-codemirror'
import { sql } from '@codemirror/lang-sql'
import { Play, X } from 'lucide-react'
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
  const { sqlQuery, setSqlQuery, runSqlQuery, setSqlEditorOpen, error } = useAppStore()

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
        <span className="font-medium" style={{ color: 'var(--text)' }}>SQL Query</span>
        <div className="flex items-center gap-2">
          <span style={{ color: 'var(--text-muted)' }}>
            Table name: <code className="font-mono px-1 rounded" style={{ background: 'var(--bg-hover)' }}>current_data</code>
          </span>
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
          theme="dark"
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
            <span className="text-xs truncate" style={{ color: '#f87171' }}>{error}</span>
          ) : (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Ctrl+Enter to run</span>
          )}
          {hint && (
            <span className="text-xs" style={{ color: '#fbbf24' }}>{hint}</span>
          )}
        </div>
        <button className="btn-primary text-xs py-1 px-3 shrink-0" onClick={run}>
          <Play size={11} />
          Run
        </button>
      </div>
    </div>
  )
}
