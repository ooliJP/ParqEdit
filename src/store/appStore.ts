import { create } from 'zustand'
import type { AppState, ColumnInfo, RowData, SortDir, Theme, ActivePanel } from '../types'

interface AppActions {
  setTheme: (theme: Theme) => void
  setActivePanel: (panel: ActivePanel) => void
  setFilterDropdown: (col: string | null) => void
  setEditingCell: (cell: { rowId: number; column: string } | null) => void
  setSqlQuery: (q: string) => void
  setSqlMode: (v: boolean) => void
  setSqlEditorOpen: (v: boolean) => void
  setPageSize: (n: number) => void
  clearError: () => void
  clearSqlHistory: () => void

  openFile: (path: string) => Promise<void>
  loadPage: (offset?: number) => Promise<void>
  fetchBlock: (blockIdx: number) => Promise<void>
  ensureRange: (startIdx: number, endIdx: number) => void
  setSortCol: (col: string) => void
  setColumnFilter: (col: string, values: string[]) => void
  clearColumnFilter: (col: string) => void
  clearColumnFilters: () => void
  resetView: () => void
  runSqlQuery: () => Promise<void>
  updateCell: (rowId: number, column: string, value: any) => Promise<boolean>
  saveFile: (path: string, format?: string, compression?: string) => Promise<boolean>
  createNew: (columns: { name: string; type: string }[]) => Promise<string | null>
  appendRow: () => Promise<boolean>
}

type Store = AppState & AppActions

const DEFAULT_PAGE_SIZE = 2000
export const DEFAULT_SQL_QUERY = 'SELECT * FROM current_data WHERE '

// "All" rows mode: the grid virtualizes the entire dataset and rows are
// fetched in blocks on demand, so any dataset size stays responsive.
export const ALL_ROWS = 0
export const BLOCK_SIZE = 2000
const MAX_CACHED_BLOCKS = 40

const SQL_HISTORY_KEY = 'parqedit-sql-history'
const SQL_HISTORY_MAX = 50

function loadSqlHistory(): string[] {
  try {
    const raw = localStorage.getItem(SQL_HISTORY_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((q) => typeof q === 'string') : []
  } catch {
    return []
  }
}

// Block fetches in flight, and an epoch counter so responses that arrive
// after the view changed (new sort/filter/file) are discarded.
const pendingBlocks = new Set<number>()
let fetchEpoch = 0

function friendlyOpenError(raw: string, filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  if (!['parquet', 'csv'].includes(ext)) {
    return `Unsupported file format ".${ext}". Please open a .parquet or .csv file.`
  }
  const r = raw ?? ''
  if (/not found|no such file/i.test(r)) return `File not found: ${filePath}`
  if (/permission|access/i.test(r)) return `Cannot read file — check permissions: ${filePath}`
  if (/invalid|corrupt|magic/i.test(r)) return `File appears corrupt or is not a valid ${ext.toUpperCase()} file.`
  if (/out of memory/i.test(r)) return 'Not enough memory to open this file.'
  return r.split('\n')[0] || 'Failed to open file.'
}

export const useAppStore = create<Store>((set, get) => ({
  filePath: null,
  fileName: null,
  schema: [],
  rows: [],
  totalRows: 0,
  offset: 0,
  pageSize: DEFAULT_PAGE_SIZE,
  blocks: {},
  viewRevision: 0,
  sortCol: null,
  sortDir: 'asc',
  columnFilters: {},
  sqlQuery: DEFAULT_SQL_QUERY,
  sqlMode: false,
  sqlEditorOpen: false,
  sqlHistory: loadSqlHistory(),
  isLoading: false,
  error: null,
  activePanel: 'none',
  filterDropdown: null,
  editingCell: null,
  hasUnsavedChanges: false,
  editedCells: {},
  editCount: 0,
  queryMs: null,
  fileSizeBytes: null,
  isNewFile: false,
  theme: 'system',

  setTheme: (theme) => set({ theme }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setFilterDropdown: (filterDropdown) => set({ filterDropdown }),
  setEditingCell: (editingCell) => set({ editingCell }),
  setSqlQuery: (sqlQuery) => set({ sqlQuery }),
  setSqlMode: (sqlMode) => set({ sqlMode }),
  setSqlEditorOpen: (sqlEditorOpen) => set({ sqlEditorOpen }),
  setPageSize: (pageSize) => { set({ pageSize, offset: 0, blocks: {} }); get().loadPage(0) },
  clearError: () => set({ error: null }),

  clearSqlHistory: () => {
    try { localStorage.removeItem(SQL_HISTORY_KEY) } catch {}
    set({ sqlHistory: [] })
  },

  openFile: async (path) => {
    set({ isLoading: true, error: null })
    const result: any = await window.api.openFile(path)
    if (!result.success) {
      set({ isLoading: false, error: friendlyOpenError(result.error, path) })
      return
    }
    const fileName = path.split(/[\\/]/).pop() ?? path
    set({
      filePath: path,
      fileName,
      isNewFile: false,
      schema: result.schema as ColumnInfo[],
      totalRows: result.totalRows,
      offset: 0,
      blocks: {},
      sortCol: null,
      sortDir: 'asc',
      columnFilters: {},
      sqlQuery: DEFAULT_SQL_QUERY,
      sqlMode: false,
      sqlEditorOpen: false,
      hasUnsavedChanges: false,
      editedCells: {},
      editCount: 0,
      fileSizeBytes: null,
      editingCell: null,
    })
    // File size is display-only (status bar) — fetch it without blocking the grid.
    window.api.getMetadata().then((m: any) => {
      if (get().filePath === path) set({ fileSizeBytes: m?.fileSize ?? null })
    }).catch(() => {})
    await get().loadPage(0)
  },

  loadPage: async (explicitOffset) => {
    const { offset, pageSize, sortCol, sortDir, columnFilters, sqlMode, sqlQuery } = get()

    if (pageSize === ALL_ROWS) {
      // Windowed mode: invalidate the block cache and fetch the first block.
      // The grid pulls further blocks on demand via ensureRange.
      fetchEpoch++
      pendingBlocks.clear()
      set((s) => ({ blocks: {}, offset: 0, isLoading: true, error: null, viewRevision: s.viewRevision + 1 }))
      await get().fetchBlock(0)
      return
    }

    const off = explicitOffset !== undefined ? explicitOffset : offset
    set((s) => ({
      isLoading: true,
      error: null,
      offset: off,
      viewRevision: explicitOffset === 0 ? s.viewRevision + 1 : s.viewRevision,
    }))

    const t0 = performance.now()
    const result: any = await window.api.getPage({
      offset: off,
      limit: pageSize,
      sortCol: sortCol ?? undefined,
      sortDir,
      filters: columnFilters,
      sqlQuery: sqlMode ? sqlQuery : undefined,
    })

    if (result.error) {
      set({ isLoading: false, error: result.error })
      return
    }

    set({
      rows: result.rows as RowData[],
      totalRows: result.total,
      queryMs: Math.round(performance.now() - t0),
      isLoading: false,
    })
  },

  fetchBlock: async (blockIdx) => {
    const epoch = fetchEpoch
    const { sortCol, sortDir, columnFilters, sqlMode, sqlQuery } = get()
    pendingBlocks.add(blockIdx)

    const t0 = performance.now()
    const result: any = await window.api.getPage({
      offset: blockIdx * BLOCK_SIZE,
      limit: BLOCK_SIZE,
      sortCol: sortCol ?? undefined,
      sortDir,
      filters: columnFilters,
      sqlQuery: sqlMode ? sqlQuery : undefined,
    })

    pendingBlocks.delete(blockIdx)
    if (epoch !== fetchEpoch) return

    if (result.error) {
      set({ isLoading: false, error: result.error })
      return
    }

    set((state) => {
      const blocks = { ...state.blocks, [blockIdx]: result.rows as RowData[] }
      const keys = Object.keys(blocks).map(Number)
      if (keys.length > MAX_CACHED_BLOCKS) {
        // Evict blocks farthest from where the user currently is.
        keys.sort((a, b) => Math.abs(a - blockIdx) - Math.abs(b - blockIdx))
        for (const k of keys.slice(MAX_CACHED_BLOCKS)) delete blocks[k]
      }
      return { blocks, totalRows: result.total, queryMs: Math.round(performance.now() - t0), isLoading: false }
    })
  },

  ensureRange: (startIdx, endIdx) => {
    const { pageSize, totalRows, blocks } = get()
    if (pageSize !== ALL_ROWS) return
    const first = Math.max(0, Math.floor(startIdx / BLOCK_SIZE))
    const last = Math.max(first, Math.floor(Math.max(endIdx, 0) / BLOCK_SIZE))
    for (let b = first; b <= last; b++) {
      if (totalRows > 0 && b * BLOCK_SIZE >= totalRows) break
      if (!blocks[b] && !pendingBlocks.has(b)) get().fetchBlock(b)
    }
  },

  setSortCol: (col, forceDir?: SortDir) => {
    const { sortCol, sortDir } = get()
    let newDir: SortDir = forceDir ?? 'asc'
    if (!forceDir) {
      if (sortCol === col) newDir = sortDir === 'asc' ? 'desc' : 'asc'
    }
    set({ sortCol: col, sortDir: newDir, offset: 0 })
    get().loadPage(0)
  },

  setColumnFilter: (col, values) => {
    const filters = { ...get().columnFilters }
    if (values.length === 0) {
      delete filters[col]
    } else {
      filters[col] = values
    }
    set({ columnFilters: filters, offset: 0 })
    get().loadPage(0)
  },

  clearColumnFilter: (col) => {
    const filters = { ...get().columnFilters }
    delete filters[col]
    set({ columnFilters: filters, offset: 0 })
    get().loadPage(0)
  },

  // Clears only column filters — SQL results and sort remain
  clearColumnFilters: () => {
    set({ columnFilters: {}, offset: 0 })
    get().loadPage(0)
  },

  // Resets everything: SQL, filters, sort
  resetView: () => {
    set({
      columnFilters: {},
      sortCol: null,
      sortDir: 'asc',
      offset: 0,
      sqlMode: false,
      sqlEditorOpen: false,
      sqlQuery: DEFAULT_SQL_QUERY,
    })
    get().loadPage(0)
  },

  runSqlQuery: async () => {
    const { sqlQuery } = get()
    if (!sqlQuery.trim()) return
    set({ sqlMode: true, offset: 0 })
    await get().loadPage(0)
    if (!get().error) {
      const q = sqlQuery.trim()
      const sqlHistory = [q, ...get().sqlHistory.filter((h) => h !== q)].slice(0, SQL_HISTORY_MAX)
      try { localStorage.setItem(SQL_HISTORY_KEY, JSON.stringify(sqlHistory)) } catch {}
      set({ sqlHistory })
    }
  },

  updateCell: async (rowId, column, value) => {
    const result: any = await window.api.updateCell(rowId, column, value)
    if (result.error) {
      set({ error: result.error })
      return false
    }
    set((state) => {
      const cellKey = `${rowId}:${column}`
      const editedCells = { ...state.editedCells, [cellKey]: true as const }
      const editCount = state.editedCells[cellKey] ? state.editCount : state.editCount + 1
      if (state.pageSize === ALL_ROWS) {
        const blocks = { ...state.blocks }
        for (const key of Object.keys(blocks)) {
          const idx = blocks[Number(key)].findIndex((r) => r.__rowid__ === rowId)
          if (idx >= 0) {
            const copy = blocks[Number(key)].slice()
            copy[idx] = { ...copy[idx], [column]: value }
            blocks[Number(key)] = copy
          }
        }
        return { blocks, hasUnsavedChanges: true, editedCells, editCount }
      }
      return {
        rows: state.rows.map((r) =>
          r.__rowid__ === rowId ? { ...r, [column]: value } : r
        ),
        hasUnsavedChanges: true,
        editedCells,
        editCount,
      }
    })
    return true
  },

  saveFile: async (path, format?, compression?) => {
    const { sortCol, sortDir, columnFilters, sqlMode, sqlQuery, isNewFile } = get()
    set({ isLoading: true })
    const result: any = await window.api.saveFile({
      filePath: path,
      sortCol: sortCol ?? undefined,
      sortDir,
      filters: columnFilters,
      sqlMode,
      sqlQuery,
      format,
      compression,
    })
    set({ isLoading: false })
    if (result.error) {
      set({ error: result.error })
      return false
    }
    const extra: Partial<AppState> = { hasUnsavedChanges: false, editedCells: {}, editCount: 0 }
    if (isNewFile) {
      extra.filePath = path
      extra.fileName = path.split(/[\\/]/).pop() ?? path
      extra.isNewFile = false
    }
    set(extra as any)
    return true
  },

  createNew: async (columns) => {
    set({ isLoading: true, error: null })
    const result: any = await window.api.createNew(columns)
    if (!result.success) {
      set({ isLoading: false })
      return result.error ?? 'Failed to create file.'
    }
    fetchEpoch++
    pendingBlocks.clear()
    set({
      filePath: null,
      fileName: 'New File',
      isNewFile: true,
      schema: result.schema as ColumnInfo[],
      totalRows: result.totalRows,
      offset: 0,
      blocks: {},
      viewRevision: 0,
      sortCol: null,
      sortDir: 'asc',
      columnFilters: {},
      sqlQuery: DEFAULT_SQL_QUERY,
      sqlMode: false,
      sqlEditorOpen: false,
      hasUnsavedChanges: false,
      editedCells: {},
      editCount: 0,
      fileSizeBytes: null,
      editingCell: null,
      isLoading: false,
    })
    await get().loadPage(0)
    return null
  },

  appendRow: async () => {
    const result: any = await window.api.appendRow()
    if (result.error) {
      set({ error: result.error })
      return false
    }
    set((s) => ({ totalRows: result.totalRows, hasUnsavedChanges: true, editCount: s.editCount + 1 }))
    await get().loadPage(get().offset)
    return true
  },
}))
