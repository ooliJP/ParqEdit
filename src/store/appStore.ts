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

  openFile: (path: string) => Promise<void>
  loadPage: (offset?: number) => Promise<void>
  setSortCol: (col: string) => void
  setColumnFilter: (col: string, values: string[]) => void
  clearColumnFilter: (col: string) => void
  clearColumnFilters: () => void
  resetView: () => void
  runSqlQuery: () => Promise<void>
  updateCell: (rowId: number, column: string, value: any) => Promise<boolean>
  saveFile: (path: string) => Promise<boolean>
}

type Store = AppState & AppActions

const DEFAULT_PAGE_SIZE = 2000
export const DEFAULT_SQL_QUERY = 'SELECT * FROM current_data WHERE '

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
  sortCol: null,
  sortDir: 'asc',
  columnFilters: {},
  sqlQuery: DEFAULT_SQL_QUERY,
  sqlMode: false,
  sqlEditorOpen: false,
  isLoading: false,
  error: null,
  activePanel: 'none',
  filterDropdown: null,
  editingCell: null,
  hasUnsavedChanges: false,
  theme: 'system',

  setTheme: (theme) => set({ theme }),
  setActivePanel: (activePanel) => set({ activePanel }),
  setFilterDropdown: (filterDropdown) => set({ filterDropdown }),
  setEditingCell: (editingCell) => set({ editingCell }),
  setSqlQuery: (sqlQuery) => set({ sqlQuery }),
  setSqlMode: (sqlMode) => set({ sqlMode }),
  setSqlEditorOpen: (sqlEditorOpen) => set({ sqlEditorOpen }),
  setPageSize: (pageSize) => { set({ pageSize, offset: 0 }); get().loadPage(0) },
  clearError: () => set({ error: null }),

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
      schema: result.schema as ColumnInfo[],
      totalRows: result.totalRows,
      offset: 0,
      sortCol: null,
      sortDir: 'asc',
      columnFilters: {},
      sqlQuery: DEFAULT_SQL_QUERY,
      sqlMode: false,
      sqlEditorOpen: false,
      hasUnsavedChanges: false,
      editingCell: null,
    })
    await get().loadPage(0)
  },

  loadPage: async (explicitOffset) => {
    const { offset, pageSize, sortCol, sortDir, columnFilters, sqlMode, sqlQuery } = get()
    const off = explicitOffset !== undefined ? explicitOffset : offset
    set({ isLoading: true, error: null, offset: off })

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
      isLoading: false,
    })
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
  },

  updateCell: async (rowId, column, value) => {
    const result: any = await window.api.updateCell(rowId, column, value)
    if (result.error) {
      set({ error: result.error })
      return false
    }
    set((state) => ({
      rows: state.rows.map((r) =>
        r.__rowid__ === rowId ? { ...r, [column]: value } : r
      ),
      hasUnsavedChanges: true,
    }))
    return true
  },

  saveFile: async (path) => {
    const { sortCol, sortDir, columnFilters, sqlMode, sqlQuery } = get()
    set({ isLoading: true })
    const result: any = await window.api.saveFile({
      filePath: path,
      sortCol: sortCol ?? undefined,
      sortDir,
      filters: columnFilters,
      sqlMode,
      sqlQuery,
    })
    set({ isLoading: false })
    if (result.error) {
      set({ error: result.error })
      return false
    }
    set({ hasUnsavedChanges: false })
    return true
  },
}))
