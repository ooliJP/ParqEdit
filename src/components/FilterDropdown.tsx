import { useEffect, useRef, useState } from 'react'
import { Search, ArrowUpAZ, ArrowDownAZ, Check, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

interface Props {
  column: string
  anchorRect: DOMRect
  onClose: () => void
}

export function FilterDropdown({ column, anchorRect, onClose }: Props) {
  const { columnFilters, setSortCol, sortCol, sortDir, setColumnFilter } = useAppStore()
  const [search, setSearch] = useState('')
  const [allValues, setAllValues] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(
    new Set(columnFilters[column] ?? [])
  )
  const [loading, setLoading] = useState(true)
  const ref = useRef<HTMLDivElement>(null)

  // Fetch distinct values
  useEffect(() => {
    setLoading(true)
    window.api.getDistinctValues(column).then((vals: any) => {
      if (Array.isArray(vals)) setAllValues(vals)
      setLoading(false)
    })
  }, [column])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => document.addEventListener('mousedown', handler), 10)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const filtered = allValues.filter((v) => {
    const label = v === '__null__' ? '(null)' : v
    return label.toLowerCase().includes(search.toLowerCase())
  })

  const allSelected = filtered.length > 0 && filtered.every((v) => selected.has(v))

  function toggleAll() {
    if (allSelected) {
      const next = new Set(selected)
      filtered.forEach((v) => next.delete(v))
      setSelected(next)
    } else {
      const next = new Set(selected)
      filtered.forEach((v) => next.add(v))
      setSelected(next)
    }
  }

  function apply() {
    setColumnFilter(column, [...selected])
    onClose()
  }

  function clear() {
    setSelected(new Set())
    setColumnFilter(column, [])
    onClose()
  }

  // Position the dropdown below the column header
  const top = anchorRect.bottom + 2
  const left = Math.min(anchorRect.left, window.innerWidth - 250)

  return (
    <div
      ref={ref}
      className="filter-dropdown animate-fade-in"
      style={{ top, left }}
    >
      {/* Sort buttons */}
      <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2 text-xs transition-colors"
          style={{
            color: sortCol === column && sortDir === 'asc' ? 'var(--accent)' : 'var(--text-muted)',
            background: sortCol === column && sortDir === 'asc' ? 'var(--bg-hover)' : 'transparent',
          }}
          onClick={() => { if (!(sortCol === column && sortDir === 'asc')) setSortCol(column); onClose() }}
        >
          <ArrowUpAZ size={13} />
          Sort A → Z
        </button>
        <div className="w-px" style={{ background: 'var(--border)' }} />
        <button
          className="flex-1 flex items-center justify-center gap-2 py-2 text-xs transition-colors"
          style={{
            color: sortCol === column && sortDir === 'desc' ? 'var(--accent)' : 'var(--text-muted)',
            background: sortCol === column && sortDir === 'desc' ? 'var(--bg-hover)' : 'transparent',
          }}
          onClick={() => { setSortCol(column); onClose() }}
        >
          <ArrowDownAZ size={13} />
          Sort Z → A
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            className="input pl-7 py-1"
            placeholder="Search values…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* Select all */}
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer border-b text-xs font-medium transition-colors"
        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        onClick={toggleAll}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
      >
        <div
          className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
          style={{
            borderColor: allSelected ? 'var(--accent)' : 'var(--border)',
            background: allSelected ? 'var(--accent)' : 'transparent',
          }}
        >
          {allSelected && <Check size={9} color="white" />}
        </div>
        Select all ({filtered.length})
      </div>

      {/* Values list */}
      <div className="overflow-y-auto" style={{ maxHeight: 240 }}>
        {loading ? (
          <div className="flex items-center justify-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            No values
          </div>
        ) : (
          filtered.map((val) => {
            const isNull = val === '__null__'
            const label = isNull ? '(null)' : val
            const checked = selected.has(val)
            return (
              <div
                key={val}
                className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs transition-colors"
                onClick={() => {
                  const next = new Set(selected)
                  if (checked) next.delete(val)
                  else next.add(val)
                  setSelected(next)
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
              >
                <div
                  className="w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0"
                  style={{
                    borderColor: checked ? 'var(--accent)' : 'var(--border)',
                    background: checked ? 'var(--accent)' : 'transparent',
                  }}
                >
                  {checked && <Check size={9} color="white" />}
                </div>
                <span
                  className="truncate"
                  style={{ color: isNull ? 'var(--text-muted)' : 'var(--text)', fontStyle: isNull ? 'italic' : 'normal' }}
                >
                  {label}
                </span>
              </div>
            )
          })
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 p-2 border-t" style={{ borderColor: 'var(--border)' }}>
        <button className="btn flex-1 justify-center text-xs" onClick={clear}>
          <X size={12} /> Clear
        </button>
        <button className="btn-primary flex-1 justify-center text-xs" onClick={apply}>
          Apply
        </button>
      </div>
    </div>
  )
}
