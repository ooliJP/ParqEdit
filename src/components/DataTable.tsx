import { useRef, useState, useCallback, useEffect, KeyboardEvent, memo } from 'react'
import { useAppStore, ALL_ROWS, BLOCK_SIZE } from '../store/appStore'
import { FilterDropdown } from './FilterDropdown'
import { IconArrowUp, IconArrowDown, IconFilter, IconChevronLeft, IconChevronRight } from './icons'
import { typeColorVar, formatBytes } from '../typeStyle'
import type { ColumnInfo, RowData } from '../types'

const COL_WIDTH = 160
const ROW_HEIGHT = 32
const HEADER_HEIGHT = 36
const OVERSCAN = 10
// Browsers cap element height around 33.5M px (~1M rows at 32px). Above this
// the body height is clamped and scroll position maps to rows proportionally,
// so the scrollbar can address datasets of any size.
const MAX_BODY_HEIGHT = 30_000_000

const PAGE_SIZE_OPTIONS = [
  { label: '500', value: 500 },
  { label: '1 000', value: 1000 },
  { label: '2 000', value: 2000 },
  { label: '5 000', value: 5000 },
  { label: '10 000', value: 10000 },
  { label: 'All', value: ALL_ROWS },
]

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
  editedCells: Record<string, true>
  editingCell: { rowId: number; column: string } | null
  onDoubleClick: (rowId: number, col: string) => void
  onCommit: (rowId: number, col: string, val: string) => void
  onCancel: () => void
  onRowNumMouseDown: (e: React.MouseEvent, index: number) => void
  onRowNumMouseEnter: (e: React.MouseEvent, index: number) => void
}

const TableRow = memo(function TableRow({
  row, schema, colWidths, index, offset, top,
  isRowSelected, selectedCols, editedCells,
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
        const isEdited = editedCells[`${row.__rowid__}:${col.name}`] === true
        const w = colWidths[col.name] ?? COL_WIDTH
        return (
          <div
            key={col.name}
            className={`table-cell selectable${isNull ? ' null-value' : ''}${isEditing ? ' editing' : ''}${isColSel ? ' col-selected' : ''}${isEdited ? ' edited' : ''}`}
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

// Shown in windowed "All" mode while the row's block is being fetched.
function PlaceholderRow({ index, top }: { index: number; top: number }) {
  return (
    <div
      className="table-row"
      style={{
        position: 'absolute',
        top,
        height: ROW_HEIGHT,
        background: index % 2 === 1 ? 'var(--row-alt)' : undefined,
      }}
    >
      <div
        className="table-cell row-num-cell"
        style={{ width: 56, minWidth: 56, justifyContent: 'flex-end', color: 'var(--text-muted)', fontSize: 10 }}
      >
        {index + 1}
      </div>
      <div className="table-cell" style={{ border: 'none', color: 'var(--text-muted)', fontSize: 10 }}>
        …
      </div>
    </div>
  )
}

export function DataTable() {
  const {
    schema, rows, totalRows, offset, pageSize, filePath,
    blocks, viewRevision, ensureRange,
    sortCol, sortDir, columnFilters, editingCell,
    editedCells, editCount, queryMs, fileSizeBytes,
    setSortCol, setEditingCell, updateCell, loadPage, setPageSize,
  } = useAppStore()

  const isAllMode = pageSize === ALL_ROWS

  const getRow = useCallback(
    (index: number): RowData | undefined =>
      isAllMode
        ? blocks[Math.floor(index / BLOCK_SIZE)]?.[index % BLOCK_SIZE]
        : rows[index],
    [isAllMode, blocks, rows]
  )

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
  // Anchors for Shift+click range selection
  const rowAnchorRef = useRef<number | null>(null)
  const colAnchorRef = useRef<number | null>(null)

  useEffect(() => {
    setSelectedRows(new Set())
    setSelectedCols(new Set())
    rowAnchorRef.current = null
    colAnchorRef.current = null
  }, [filePath, offset, viewRevision])

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
    if (e.shiftKey && rowAnchorRef.current !== null) {
      const a = rowAnchorRef.current
      const [min, max] = [Math.min(a, rowIdx), Math.max(a, rowIdx)]
      setSelectedRows(new Set(Array.from({ length: max - min + 1 }, (_, i) => min + i)))
      return
    }
    rowAnchorRef.current = rowIdx
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
    if (e.shiftKey && colAnchorRef.current !== null) {
      e.preventDefault()
      e.stopPropagation()
      const a = colAnchorRef.current
      const [min, max] = [Math.min(a, colIdx), Math.max(a, colIdx)]
      setSelectedRows(new Set())
      setSelectedCols(new Set(Array.from({ length: max - min + 1 }, (_, i) => min + i)))
      // Marking the drag as "moved" stops the click handler from sorting
      colDragRef.current = { startCol: a, moved: true }
      return
    }
    colAnchorRef.current = colIdx
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
    if (e.ctrlKey || e.metaKey || e.shiftKey) return
    setSelectedRows(new Set())
    setSelectedCols(new Set())
    setSortCol(col.name)
  }

  function copyToClipboard() {
    const colsToUse = selectedCols.size > 0 ? schema.filter((_, i) => selectedCols.has(i)) : schema
    const rowIndices = selectedRows.size > 0
      ? [...selectedRows].sort((a, b) => a - b)
      : isAllMode
        ? Object.keys(blocks).map(Number).sort((a, b) => a - b)
            .flatMap((b) => blocks[b].map((_, i) => b * BLOCK_SIZE + i))
        : rows.map((_, i) => i)
    const rowsToUse = rowIndices.map(getRow).filter((r): r is RowData => r !== undefined)
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

  // --- custom windowing ---------------------------------------------------
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportH, setViewportH] = useState(600)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; setScrollTop(el.scrollTop) })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight))
    ro.observe(el)
    setViewportH(el.clientHeight)
    return () => {
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const rowCount = isAllMode ? totalRows : rows.length
  const realHeight = rowCount * ROW_HEIGHT
  const bodyHeight = Math.min(realHeight, MAX_BODY_HEIGHT)
  const scaled = realHeight > bodyHeight
  const visibleCount = Math.max(1, Math.ceil(Math.max(0, viewportH - HEADER_HEIGHT) / ROW_HEIGHT) + 1)

  let firstRow: number
  if (!scaled) {
    firstRow = Math.min(Math.max(0, rowCount - 1), Math.floor(Math.max(0, scrollTop) / ROW_HEIGHT))
  } else {
    // Proportional mapping: scrollbar position picks the row range, rows are
    // anchored to the current scroll offset.
    const maxScroll = Math.max(1, HEADER_HEIGHT + bodyHeight - viewportH)
    const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll))
    firstRow = Math.round(ratio * Math.max(0, rowCount - visibleCount))
  }
  const renderStart = Math.max(0, firstRow - OVERSCAN)
  const renderEnd = Math.min(rowCount - 1, firstRow + visibleCount + OVERSCAN)
  const rowTop = (idx: number) =>
    scaled ? scrollTop + (idx - firstRow) * ROW_HEIGHT : idx * ROW_HEIGHT

  // Windowed mode: pull missing blocks for the rendered range on demand.
  // Debounced slightly so scrubbing the scrollbar doesn't queue fetches for
  // every range it flies past.
  useEffect(() => {
    if (!isAllMode || totalRows === 0) return
    const t = setTimeout(() => ensureRange(renderStart, renderEnd), 60)
    return () => clearTimeout(t)
  }, [isAllMode, renderStart, renderEnd, totalRows, viewRevision, ensureRange])

  // Jump back to the top whenever the dataset shape changes (sort/filter/SQL/file).
  useEffect(() => {
    containerRef.current?.scrollTo({ top: 0 })
    setScrollTop(0)
  }, [viewRevision, filePath])

  const firstVisible = firstRow
  const lastVisible = Math.min(Math.max(0, rowCount - 1), firstRow + visibleCount - 1)

  const currentPage = isAllMode ? 1 : Math.floor(offset / pageSize) + 1
  const totalPages = isAllMode ? 1 : Math.max(1, Math.ceil(totalRows / pageSize))
  const startRow = totalRows === 0 ? 0 : isAllMode ? firstVisible + 1 : offset + 1
  const endRow = isAllMode
    ? Math.min(lastVisible + 1, totalRows)
    : Math.min(offset + rows.length, totalRows)

  function prevPage() { if (!isAllMode && offset > 0) loadPage(Math.max(0, offset - pageSize)) }
  function nextPage() { if (!isAllMode && offset + pageSize < totalRows) loadPage(offset + pageSize) }

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
                <span className="type-badge" style={{ color: typeColorVar(col.type) }}>
                  {col.type.split('(')[0].toLowerCase()}
                </span>
                {isSorted && (
                  sortDir === 'asc'
                    ? <IconArrowUp size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                    : <IconArrowDown size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                )}
                <button
                  className="shrink-0 rounded p-0.5 no-drag transition-colors"
                  style={{ color: isFiltered ? 'var(--accent)' : 'var(--text-muted)', opacity: isFiltered ? 1 : 0.55 }}
                  onClick={(e) => handleFilterClick(col, e)}
                  title="Filter column values"
                >
                  <IconFilter size={11} />
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
        <div className="table-body" style={{ height: bodyHeight }}>
          {rowCount > 0 && Array.from({ length: renderEnd - renderStart + 1 }, (_, i) => {
            const index = renderStart + i
            const top = rowTop(index)
            const row = getRow(index)
            if (!row) {
              return <PlaceholderRow key={index} index={index} top={top} />
            }
            return (
              <TableRow
                key={index}
                row={row}
                schema={schema}
                colWidths={colWidths}
                index={index}
                offset={isAllMode ? 0 : offset}
                top={top}
                isRowSelected={selectedRows.has(index)}
                selectedCols={selectedCols}
                editedCells={editedCells}
                editingCell={editingCell}
                onDoubleClick={handleCellDoubleClick}
                onCommit={handleCommit}
                onCancel={handleCancel}
                onRowNumMouseDown={handleRowNumMouseDown}
                onRowNumMouseEnter={handleRowNumMouseEnter}
              />
            )
          })}
        </div>
      </div>

      {/* Status / pagination bar */}
      <div
        className="mono-label flex items-center justify-between px-3 h-8 shrink-0 border-t gap-3"
        style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)', color: 'var(--text-sub)' }}
      >
        {/* Row counts / selection hint, unsaved edits */}
        <span className="shrink-0 flex items-center gap-3">
          {selCount > 0 ? (
            <span style={{ color: 'var(--accent)' }}>
              {selLabel}
              <span className="ml-2 opacity-60">· Ctrl+C to copy</span>
            </span>
          ) : totalRows === 0 ? 'No rows' : (
            <span>
              Rows <span style={{ color: 'var(--text)' }}>{startRow.toLocaleString()}–{endRow.toLocaleString()}</span> of{' '}
              <span style={{ color: 'var(--text)' }}>{totalRows.toLocaleString()}</span>
              {' '}· <span style={{ color: 'var(--text)' }}>{schema.length}</span> col{schema.length !== 1 ? 's' : ''}
            </span>
          )}
          {editCount > 0 && (
            <>
              <span className="w-px h-3" style={{ background: 'var(--border)' }} />
              <span style={{ color: 'var(--unsaved)' }}>
                ● {editCount} unsaved edit{editCount !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </span>

        {/* Page nav */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1 shrink-0">
            <button className="btn py-0.5 px-1" onClick={prevPage} disabled={offset === 0}
              style={offset === 0 ? { opacity: 0.3, pointerEvents: 'none' } : undefined}>
              <IconChevronLeft size={12} />
            </button>
            <span style={{ color: 'var(--text)' }}>{currentPage.toLocaleString()} / {totalPages.toLocaleString()}</span>
            <button className="btn py-0.5 px-1" onClick={nextPage} disabled={offset + pageSize >= totalRows}
              style={offset + pageSize >= totalRows ? { opacity: 0.3, pointerEvents: 'none' } : undefined}>
              <IconChevronRight size={12} />
            </button>
          </div>
        )}

        {/* Right side: page size, query time, file info, engine */}
        <div className="flex items-center gap-3 shrink-0" style={{ color: 'var(--text-muted)' }}>
          <div className="flex items-center gap-1.5">
            <span>rows/page</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="mono-label rounded px-1 py-0.5 outline-none cursor-pointer"
              style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
            >
              {PAGE_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          {queryMs !== null && (
            <>
              <span className="w-px h-3" style={{ background: 'var(--border)' }} />
              <span>query <span style={{ color: 'var(--text-sub)' }}>{queryMs} ms</span></span>
            </>
          )}
          {filePath && fileSizeBytes !== null && (
            <>
              <span className="w-px h-3" style={{ background: 'var(--border)' }} />
              <span>{filePath.split('.').pop()?.toLowerCase()} · {formatBytes(fileSizeBytes)}</span>
            </>
          )}
          <span className="w-px h-3" style={{ background: 'var(--border)' }} />
          <span title="All reads, queries and writes run on an embedded DuckDB engine">
            engine <span style={{ color: 'var(--text-sub)' }}>duckdb</span>
          </span>
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
