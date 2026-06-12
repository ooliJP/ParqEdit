import { contextBridge, ipcRenderer } from 'electron'

export type ColumnInfo = { name: string; type: string }

export type GetPageParams = {
  offset: number
  limit: number
  sortCol?: string
  sortDir?: 'asc' | 'desc'
  filters?: Record<string, string[]>
  sqlQuery?: string
}

const api = {
  // Window controls
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),
  onMaximized: (cb: (v: boolean) => void) => {
    ipcRenderer.on('window:maximized', (_, v) => cb(v))
    return () => ipcRenderer.removeAllListeners('window:maximized')
  },
  onOpenFile: (cb: (filePath: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, path: string) => cb(path)
    ipcRenderer.on('open-file', handler)
    return () => ipcRenderer.removeListener('open-file', handler)
  },

  // Dialogs
  openFileDialog: () => ipcRenderer.invoke('dialog:open-file'),
  saveFileDialog: (ext: string) => ipcRenderer.invoke('dialog:save-file', ext),

  // Database
  openFile: (path: string) => ipcRenderer.invoke('db:open-file', path),
  getPage: (params: GetPageParams) => ipcRenderer.invoke('db:get-page', params),
  getMetadata: () => ipcRenderer.invoke('db:get-metadata'),
  getDistinctValues: (column: string) => ipcRenderer.invoke('db:get-distinct-values', column),
  updateCell: (rowId: number, column: string, value: any) =>
    ipcRenderer.invoke('db:update-cell', { rowId, column, value }),
  saveFile: (params: {
    filePath: string
    sortCol?: string
    sortDir?: 'asc' | 'desc'
    filters?: Record<string, string[]>
    sqlMode?: boolean
    sqlQuery?: string
    format?: string
    compression?: string
  }) => ipcRenderer.invoke('db:save-file', params),
  createNew: (columns: { name: string; type: string }[]) =>
    ipcRenderer.invoke('db:create-new', columns),
  appendRow: () => ipcRenderer.invoke('db:append-row'),

  // Shell
  showInExplorer: (filePath: string) => ipcRenderer.invoke('shell:show-item', filePath),

  // Open a file in a brand-new window
  openNewWindow: (filePath: string) => ipcRenderer.invoke('window:open-new', filePath),
}

contextBridge.exposeInMainWorld('api', api)

export type ApiType = typeof api
