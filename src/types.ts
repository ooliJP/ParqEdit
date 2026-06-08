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
  // File
  filePath: string | null
  fileName: string | null

  // Schema / data
  schema: ColumnInfo[]
  rows: RowData[]
  totalRows: number

  // Pagination
  offset: number
  pageSize: number

  // Sort & filter
  sortCol: string | null
  sortDir: SortDir
  columnFilters: Record<string, string[]>

  // SQL
  sqlQuery: string
  sqlMode: boolean

  // UI
  isLoading: boolean
  error: string | null
  activePanel: ActivePanel
  filterDropdown: string | null // column name

  // Edit
  editingCell: { rowId: number; column: string } | null
  hasUnsavedChanges: boolean

  // Theme
  theme: Theme
}
