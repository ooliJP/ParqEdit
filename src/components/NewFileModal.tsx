import { useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

const COLUMN_TYPES = [
  'VARCHAR', 'INTEGER', 'BIGINT', 'DOUBLE',
  'FLOAT', 'BOOLEAN', 'DATE', 'TIMESTAMP',
]

interface ColumnDef {
  name: string
  type: string
}

interface Props {
  onClose: () => void
}

export function NewFileModal({ onClose }: Props) {
  const { createNew } = useAppStore()
  const [columns, setColumns] = useState<ColumnDef[]>([
    { name: 'id', type: 'INTEGER' },
    { name: 'name', type: 'VARCHAR' },
    { name: 'value', type: 'DOUBLE' },
  ])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function addColumn() {
    setColumns((prev) => [...prev, { name: `col${prev.length + 1}`, type: 'VARCHAR' }])
  }

  function removeColumn(i: number) {
    setColumns((prev) => prev.filter((_, j) => j !== i))
  }

  function updateColumn(i: number, field: 'name' | 'type', value: string) {
    setColumns((prev) => prev.map((c, j) => (j === i ? { ...c, [field]: value } : c)))
  }

  async function handleCreate() {
    if (columns.length === 0) { setError('Add at least one column.'); return }
    const names = columns.map((c) => c.name.trim())
    if (names.some((n) => !n)) { setError('All columns must have a name.'); return }
    if (new Set(names).size !== names.length) { setError('Column names must be unique.'); return }

    setLoading(true)
    setError(null)
    const err = await createNew(columns.map((c) => ({ name: c.name.trim(), type: c.type })))
    setLoading(false)
    if (err) { setError(err); return }
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 h-12 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>New File</span>
          <button className="btn-ghost p-1.5" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="px-5 py-4">
          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
            Define your columns. An empty table with 5 rows will be created — add more with the Add Row button.
          </p>

          <div className="space-y-2 mb-3" style={{ maxHeight: 320, overflowY: 'auto' }}>
            {columns.map((col, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="flex-1 text-xs rounded px-2 py-1.5 outline-none"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  value={col.name}
                  onChange={(e) => updateColumn(i, 'name', e.target.value)}
                  placeholder="column name"
                  spellCheck={false}
                />
                <select
                  className="text-xs rounded px-2 py-1.5 outline-none cursor-pointer"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
                  value={col.type}
                  onChange={(e) => updateColumn(i, 'type', e.target.value)}
                >
                  {COLUMN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <button
                  className="btn-ghost p-1"
                  onClick={() => removeColumn(i)}
                  disabled={columns.length <= 1}
                  style={columns.length <= 1 ? { opacity: 0.3, pointerEvents: 'none' } : undefined}
                  title="Remove column"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <button className="btn text-xs gap-1" onClick={addColumn}>
            <Plus size={12} />
            Add column
          </button>

          {error && (
            <p className="mt-3 text-xs" style={{ color: 'var(--unsaved)' }}>{error}</p>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button className="btn text-xs" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary text-xs py-1.5 px-4"
            onClick={handleCreate}
            disabled={loading}
            style={loading ? { opacity: 0.6 } : undefined}
          >
            {loading ? 'Creating…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  )
}
