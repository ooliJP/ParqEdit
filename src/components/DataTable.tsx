import { useRef, useState, useCallback, useEffect, KeyboardEvent, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowUp, ArrowDown, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { FilterDropdown } from './FilterDropdown'
import type { ColumnInfo, RowData } from '../types'

const COL_WIDTH = 160
const ROW_HEIGHT = 32

const PAGE_SIZE_OPTIONS = [
  { label: '500', value: 500 },
  { label: '1 000', value: 1000 },
  { label: '2 000', value: 2000 },
  { label: '5 000', value: 5000 },
  { label: '10 000', value: 10000 },
  { label: 'All', value: 999999 },
]

function typeColor(type: string): string {
  const t = type.toUpperCase()
  if (/INT|BIGINT|SMALLINT|TINYINT|HUGEINT/.test(t)) return '#60a5fa'
  if (/DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(t)) return '#34d399'
  if (/VARCHAR|TEXT|STRING|CHAR/.test(t)) return '#f59e0b'
  if (/BOOLEAN/.test(t)) return '#a78bfa'
  if (/DATE|TIME|TIMESTAMP/.test(t)) return '#f87171'
  return '#71717a'
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return ''
  if (val instanceof Date) return val.toISOString()
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function tsvEscape(v: string): string {
  if (v.includes('\t') || v.includes('\n') || v.includes('"'))
    return '"' + v.replace(/"/g, '""') + '"'
  return v
}

interface CellEditorProps {
  value: any
  onCommit: (v: string) => void
  onCancel: () => void
}

function CellEditor({ value, onCommit, onCancel }: CellEditorProps) {
  const [val, setVal] = useState(formatValue(value))
  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') { e.preventDefault(); onCommit(val) }
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    e.stopPropagation()
  }
  return (
    <input
      autoFocus
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onKeyDown={handleKey}
      onBlur={() => onCommit(val)}
      className="selectable"
    />
  )
}

interface TableRowProps {
  row: RowData
  schema: ColumnInfo[]
  colWidths: Record<string, number>
  index: number
  offset: number
  top: number
  isRowSelected: boolean
  selectedCols: Set<number>
  editingCell: { rowId: number; column: string } | null
  onDoubleClick: (rowId: number, col: string) => void
  onCommit: (rowId: number, col: string, val: string) => void
  onCancel: () => void
  onRowNumMouseDown: (e: React.MouseEvent, index: number) => void
  onRowNumMouseEnter: (e: React.MouseEvent, index: number) => void
}

const TableRow = memo(function TableRow({
  row, schema, colWidths, index, offset, top,
  isRowSelected, selectedCols,
  editingCell, onDoubleClick, onCommit, onCancel,
  onRowNumMouseDown, onRowNumMouseEnter,
}: TableRowProps) {
  return (
    <div
      className={`table-row${isRowSelected ? ' row-selected' : ''}`}
      style={{
        position: 'absolute',
        top,
        height: ROW_HEIGHT,
        background: isRowSelected ? undefined : index % 2 === 1 ? 'var(--row-alt)' : undefined,
      }}
    >
      <div
        className="table-cell row-num-cell"
        style={{ width: 56, minWidth: 56, justifyContent: 'flex-end', color: 'var(--text-muted)', fontSize: 10 }}
        onMouseDown={(e) => onRowNumMouseDown(e, index)}
        onMouseEnter={(e) => onRowNumMouseEnter(e, index)}
      >
        {offset + index + 1}
      </div>

      {schema.map((col, colIdx) => {
        const val = row[col.name]
        const isEditing = editingCell?.rowId === row.__rowid__ && editingCell?.column === col.name
        const isNull = val === null || val === undefined
        const isColSel = selectedCols.has(colIdx)
        const w = colWidths[col.name] ?? COL_WIDTH
        return (
          <div
            key={col.name}
            className={`table-cell selectable${isNull ? ' null-value' : ''}${isEditing ? ' editing' : ''}${isColSel ? ' col-selected' : ''}`}
            style={{ width: w, minWidth: w }}
            onDoubleClick={() => onDoubleClick(row.__rowid__, col.name)}
            title={isNull ? 'NULL' : formatValue(val)}
          >
            {isEditing ? (
              <CellEditor
                value={val}
                onCommit={(v) => onCommit(row.__rowid__, col.name, v)}
                onCancel={onCancel}
              />
            ) : (
              <span className="truncate">{isNull ? 'NULL' : formatValue(val)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
})

export function DataTable() {
  const {
    schema, rows, totalRows, offset, pageSize, filePath,
    sortCol, sortDir, columnFilters, editingCell,
    setSortCol, setEditingCell, updateCell, loadPage, setPageSize,
  } = useAppStore()

  const [filterDropdown, setFilterDropdown] = useState<{ col: string; rect: DOMRect } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [colWidths, setColWidths] = useState<Record<string, number>>({})
  const [resizingCol, setResizingCol] = useState<string | null>(null)
  const resizingRef = useRef<{ colName: string; startX: number; startWidth: number } | null>(null)

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!resizingRef.current) return
      const { colName, startX, startWidth } = resizingRef.current
      setColWidths(prev => ({ ...prev, [colName]: Math.max(50, startWidth + (e.clientX - startX)) }))
    }
    function onMouseUp() {
      if (!resizingRef.current) return
      resizingRef.current = null
      setResizingCol(null)
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  useEffect(() => {
    document.body.style.cursor = resizingCol ? 'col-resize' : ''
    return () => { document.body.style.cursor = '' }
  }, [resizingCol])

  function handleResizeMouseDown(e: React.MouseEvent, colName: string) {
    e.stopPropagation()
    e.preventDefault()
    resizingRef.current = { colName, startX: e.clientX, startWidth: colWidths[colName] ?? COL_WIDTH }
    setResizingCol(colName)
  }

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set())
  const rowDragRef = useRef<{ start: number } | null>(null)
  const colDragRef = useRef<{ startCol: number; moved: boolean } | null>(null)

  useEffect(() => { setSelectedRows(new Set()); setSelectedCols(new Set()) }, [filePath, offset])

  useEffect(() => {
    function onUp() {
      rowDragRef.current = null
      if (colDragRef.current) colDragRef.current = null
    }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  const handleRowNumMouseDown = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.preventDefault()
    setSelectedCols(new Set())
    if (e.ctrlKey || e.metaKey) {
      setSelectedRows(prev => {
        const next = new Set(prev)
        next.has(rowIdx) ? next.delete(rowIdx) : next.add(rowIdx)
        return next
      })
    } else {
      setSelectedRows(new Set([rowIdx]))
      rowDragRef.current = { start: rowIdx }
    }
  }, [])

  const handleRowNumMouseEnter = useCallback((e: React.MouseEvent, rowIdx: number) => {
    if (e.buttons !== 1 || !rowDragRef.current) return
    const { start } = rowDragRef.current
    const [min, max] = [Math.min(start, rowIdx), Math.max(start, rowIdx)]
    setSelectedRows(new Set(Array.from({ length: max - min + 1 }, (_, i) => min + i)))
  }, [])

  function handleColHeaderMouseDown(e: React.MouseEvent, colIdx: number) {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation()
      setSelectedRows(new Set())
      setSelectedCols(prev => {
        const next = new Set(prev)
        next.has(colIdx) ? next.delete(colIdx) : next.add(colIdx)
        return next
      })
      return
    }
    colDragRef.current = { startCol: colIdx, moved: false }
  }

  function handleColHeaderMouseEnter(e: React.MouseEvent, colIdx: number) {
    if (e.buttons !== 1 || !colDragRef.current) return
    const { startCol } = colDragRef.current
    if (colIdx === startCol && !colDragRef.current.moved) return
    if (!colDragRef.current.moved) {
      colDragRef.current.moved = true
      setSelectedRows(new Set())
      setSelectedCols(new Set([startCol]))
    }
    const [min, max] = [Math.min(startCol, colIdx), Math.max(startCol, colIdx)]
    setSelectedCols(new Set(Array.from({ length: max - min + 1 }, (_, i) => min + i)))
  }

  function handleColHeaderClick(e: React.MouseEvent, col: ColumnInfo) {
    if (colDragRef.current?.moved) { colDragRef.current = null; return }
    colDragRef.current = null
    if (e.ctrlKey || e.metaKey) return
    setSelectedRows(new Set())
    setSelectedCols(new Set())
    setSortCol(col.name)
  }

  function copyToClipboard() {
    const colsToUse = selectedCols.size > 0 ? schema.filter((_, i) => selectedCols.has(i)) : schema
    const rowsToUse = selectedRows.size > 0 ? rows.filter((_, i) => selectedRows.has(i)) : rows
    if (rowsToUse.length === 0 || colsToUse.length === 0) return
    const header = colsToUse.map(c => tsvEscape(c.name)).join('\t')
    const body = rowsToUse.map(row =>
      colsToUse.map(col => {
        const v = row[col.name]
        return (v === null || v === undefined) ? '' : tsvEscape(formatValue(v))
      }).join('\t')
    ).join('\n')
    navigator.clipboard.writeText(header + '\n' + body)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if (selectedRows.size > 0 || selectedCols.size > 0) {
        copyToClipboard()
        e.preventDefault()
      }
    }
    if (e.key === 'Escape') {
      setSelectedRows(new Set())
      setSelectedCols(new Set())
    }
  }

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => containerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const currentPage = Math.floor(offset / pageSize) + 1
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const startRow = totalRows === 0 ? 0 : offset + 1
  const endRow = Math.min(offset + rows.length, totalRows)

  function prevPage() { if (offset > 0) loadPage(Math.max(0, offset - pageSize)) }
  function nextPage() { if (offset + pageSize < totalRows) loadPage(offset + pageSize) }

  function handleFilterClick(col: ColumnInfo, e: React.MouseEvent) {
    e.stopPropagation()
    const headerCell = (e.currentTarget as HTMLElement).closest('.table-header-cell')
    const rect = (headerCell ?? e.currentTarget as HTMLElement).getBoundingClientRect()
    setFilterDropdown({ col: col.name, rect })
  }

  const handleCellDoubleClick = useCallback(
    (rowId: number, colName: string) => setEditingCell({ rowId, column: colName }),
    [setEditingCell]
  )
  const handleCommit = useCallback(
    async (rowId: number, column: string, val: string) => {
      setEditingCell(null)
      await updateCell(rowId, column, val === '' ? null : val)
    },
    [setEditingCell, updateCell]
  )
  const handleCancel = useCallback(() => setEditingCell(null), [setEditingCell])

  const selCount = selectedRows.size > 0 ? selectedRows.size : selectedCols.size > 0 ? selectedCols.size : 0
  const selLabel = selectedRows.size > 0
    ? `${selectedRows.size} row${selectedRows.size !== 1 ? 's' : ''} selected`
    : selectedCols.size > 0
      ? `${selectedCols.size} col${selectedCols.size !== 1 ? 's' : ''} selected`
      : null

  return (
    <div
      className="flex flex-col h-full min-h-0 outline-none"
      style={{ background: 'var(--bg)' }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Table */}
      <div
        ref={containerRef}
        className="table-container flex-1 min-h-0"
        style={{ willChange: 'transform' }}
      >
        {/* Header */}
        <div className="table-header-row" style={{ userSelect: 'none' }}>
          <div
            className="table-header-cell"
            style={{ width: 56, minWidth: 56, color: 'var(--text-muted)', cursor: 'default', justifyContent: 'flex-end', fontSize: 10 }}
          >
            #
          </div>
          {schema.map((col, colIdx) => {
            const isSorted = sortCol === col.name
            const isFiltered = !!columnFilters[col.name]
            const isColSel = selectedCols.has(colIdx)
            const w = colWidths[col.name] ?? COL_WIDTH
            return (
              <div
                key={col.name}
                className={`table-header-cell${isSorted ? ' sorted' : ''}${isFiltered ? ' filtered' : ''}${isColSel ? ' col-selected' : ''}`}
                style={{ width: w, minWidth: w }}
                title={col.name}
                onMouseDown={(e) => handleColHeaderMouseDown(e, colIdx)}
                onMouseEnter={(e) => handleColHeaderMouseEnter(e, colIdx)}
                onClick={(e) => handleColHeaderClick(e, col)}
              >
                <span className="truncate flex-1">{col.name}</span>
                <span
                  className="text-[10px] px-1 py-0.5 rounded shrink-0 font-mono"
                  style={{ background: 'var(--bg-hover)', color: typeColor(col.type) }}
                >
                  {col.type.split('(')[0].toLowerCase()}
                </span>
                {isSorted && (
                  sortDir === 'asc'
                    ? <ArrowUp size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    : <ArrowDown size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                )}
                <button
                  className="shrink-0 rounded p-0.5 no-drag transition-colors"
                  style={{ color: isFiltered ? 'var(--accent)' : 'var(--text-muted)' }}
                  onClick={(e) => handleFilterClick(col, e)}
                  title="Filter column values"
                >
                  <Filter size={11} />
                </button>
                {/* Resize handle — stopPropagation on click prevents sort from firing */}
                <div
                  className={`resize-handle${resizingCol === col.name ? ' resizing' : ''}`}
                  onMouseDown={(e) => handleResizeMouseDown(e, col.name)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )
          })}
        </div>

        {/* Virtual body */}
        <div className="table-body" style={{ height: rowVirtualizer.getTotalSize() }}>
          {rowVirtualizer.getVirtualItems().map((vRow) => (
            <TableRow
              key={vRow.index}
              row={rows[vRow.index]}
              schema={schema}
              colWidths={colWidths}
              index={vRow.index}
              offset={offset}
              top={vRow.start}
              isRowSelected={selectedRows.has(vRow.index)}
              selectedCols={selectedCols}
              editingCell={editingCell}
              onDoubleClick={handleCellDoubleClick}
              onCommit={handleCommit}
              onCancel={handleCancel}
              onRowNumMouseDown={handleRowNumMouseDown}
              onRowNumMouseEnter={handleRowNumMouseEnter}
            />
          ))}
        </div>
      </div>

      {/* Status / pagination bar */}
      <div
        className="flex items-center justify-between px-3 h-9 shrink-0 border-t text-xs gap-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
      >
        {/* Row count / selection hint */}
        <span className="shrink-0">
          {selCount > 0 ? (
            <span style={{ color: 'var(--accent)' }}>
              {selLabel}
              <span className="ml-2 opacity-60">· Ctrl+C to copy</span>
            </span>
          ) : totalRows === 0 ? 'No rows' : (
            <>Rows {startRow.toLocaleString()}–{endRow.toLocaleString()} of{' '}
              <strong style={{ color: 'var(--text)' }}>{totalRows.toLocaleString()}</strong>
            </>
          )}
        </span>

        {/* Page nav */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button className="btn py-1 px-1.5" onClick={prevPage} disabled={offset === 0}
              style={offset === 0 ? { opacity: 0.3, pointerEvents: 'none' } : undefined}>
              <ChevronLeft size={13} />
            </button>
            <span style={{ color: 'var(--text)' }}>{currentPage} / {totalPages}</span>
            <button className="btn py-1 px-1.5" onClick={nextPage} disabled={offset + pageSize >= totalRows}
              style={offset + pageSize >= totalRows ? { opacity: 0.3, pointerEvents: 'none' } : undefined}>
              <ChevronRight size={13} />
            </button>
          </div>
        )}

        {/* Right side */}
        <div className="flex items-center gap-3 shrink-0">
          <span>{schema.length} col{schema.length !== 1 ? 's' : ''}</span>
          <div className="flex items-center gap-1">
            <span>Rows/page:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="text-xs rounded px-1 py-0.5 outline-none cursor-pointer"
              style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {PAGE_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter dropdown */}
      {filterDropdown && (
        <FilterDropdown
          column={filterDropdown.col}
          anchorRect={filterDropdown.rect}
          onClose={() => setFilterDropdown(null)}
        />
      )}
    </div>
  )
}
