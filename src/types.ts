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
  pageSize: number
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
  theme: Theme
}
