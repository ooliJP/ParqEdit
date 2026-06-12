export interface ColumnInfo {
  name: string
  type: string
}

export interface RowData {
  __rowid__: number
  [key: string]: any
}

export interface Metadata {
  filePath: string
  fileName: string
  fileSize: number
  totalRows: number
  schema: ColumnInfo[]
  parquetMeta?: {
    kv: any[]
    schema: any[]
  }
}

export type SortDir = 'asc' | 'desc'
export type Theme = 'dark' | 'light' | 'system'
export type ActivePanel = 'none' | 'metadata' | 'settings'

export interface AppState {
  filePath: string | null
  fileName: string | null
  schema: ColumnInfo[]
  rows: RowData[]
  totalRows: number
  offset: number
  // 0 = "All" — windowed mode: the table virtualizes the entire dataset and
  // fetches blocks of rows on demand as the user scrolls.
  pageSize: number
  blocks: Record<number, RowData[]>
  // Bumped whenever the visible dataset changes shape (new file, sort,
  // filter, SQL) — consumers use it to reset scroll position and selection.
  viewRevision: number
  sqlHistory: string[]
  sortCol: string | null
  sortDir: SortDir
  columnFilters: Record<string, string[]>
  sqlQuery: string
  sqlMode: boolean
  sqlEditorOpen: boolean
  isLoading: boolean
  error: string | null
  activePanel: ActivePanel
  filterDropdown: string | null
  editingCell: { rowId: number; column: string } | null
  hasUnsavedChanges: boolean
  // Cells edited since the last save, keyed "rowid:column" — used to ink
  // unsaved values in the grid. editCount also counts appended rows.
  editedCells: Record<string, true>
  editCount: number
  // Duration of the last data query in ms (page load, block fetch, SQL).
  queryMs: number | null
  // On-disk size of the open file; null for new unsaved files.
  fileSizeBytes: number | null
  isNewFile: boolean
  theme: Theme
}
