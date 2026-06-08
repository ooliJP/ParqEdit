import { useEffect, useState } from 'react'
import { useAppStore } from './store/appStore'
import { useTheme } from './hooks/useTheme'
import { Titlebar } from './components/Titlebar'
import { Toolbar } from './components/Toolbar'
import { DropZone } from './components/DropZone'
import { DataTable } from './components/DataTable'
import { SQLEditor } from './components/SQLEditor'
import { MetadataPanel } from './components/MetadataPanel'
import { SettingsPanel } from './components/SettingsPanel'

type DragState = 'none' | 'valid' | 'invalid'

const SUPPORTED = /\.(parquet|csv)$/i

export default function App() {
  useTheme()

  const { filePath, sqlMode, sqlEditorOpen, activePanel, error, clearError, openFile, saveFile } = useAppStore()

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 4000)
    return () => clearTimeout(t)
  }, [error, clearError])

  useEffect(() => {
    async function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 's' || !filePath) return
      e.preventDefault()
      const ext = filePath.endsWith('.csv') ? 'csv' : 'parquet'
      const savePath = await window.api.saveFileDialog(ext)
      if (savePath) await saveFile(savePath)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filePath, saveFile])

  useEffect(() => {
    return window.api.onOpenFile((path) => {
      if (filePath) window.api.openNewWindow(path)
      else openFile(path)
    })
  }, [filePath, openFile])

  const [dragState, setDragState] = useState<DragState>('none')

  useEffect(() => {
    function onDragEnter(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
    }

    function onDragOver(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      // File metadata isn't reliably available during dragover — only show red
      // when we can positively identify an unsupported extension.
      try {
        const item = e.dataTransfer?.items[0]
        if (!item || item.kind !== 'file') { setDragState('valid'); return }
        const f = item.getAsFile()
        const name = ((f as any)?.path as string) || f?.name || ''
        if (!name) { setDragState('valid'); return }
        setDragState(SUPPORTED.test(name) ? 'valid' : 'invalid')
      } catch {
        setDragState('valid')
      }
    }

    function onDragLeave(e: DragEvent) {
      if (!e.relatedTarget) setDragState('none')
    }

    function onDrop(e: DragEvent) {
      e.preventDefault()
      e.stopPropagation()
      setDragState('none')
      const file = e.dataTransfer?.files[0]
      if (!file) return
      // file.path is an Electron extension on the File object
      const path: string = (file as any).path || ''
      if (!path) return
      if (filePath) window.api.openNewWindow(path)
      else openFile(path)
    }

    document.addEventListener('dragenter', onDragEnter)
    document.addEventListener('dragover', onDragOver)
    document.addEventListener('dragleave', onDragLeave)
    document.addEventListener('drop', onDrop)
    return () => {
      document.removeEventListener('dragenter', onDragEnter)
      document.removeEventListener('dragover', onDragOver)
      document.removeEventListener('dragleave', onDragLeave)
      document.removeEventListener('drop', onDrop)
    }
  }, [filePath, openFile])

  const showOverlay = dragState !== 'none' && (filePath !== null || dragState === 'invalid')
  const isValid = dragState === 'valid'

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      style={{ background: 'var(--bg)', position: 'relative' }}
    >
      {/* Drag overlay */}
      {showOverlay && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"
          style={{
            background: isValid ? 'rgba(99,102,241,0.13)' : 'rgba(239,68,68,0.18)',
            border: `2px solid ${isValid ? 'var(--accent)' : '#ef4444'}`,
          }}
        >
          <div
            className="px-5 py-3 rounded-xl text-sm font-semibold animate-fade-in"
            style={{
              background: isValid ? 'var(--accent)' : '#ef4444',
              color: 'white',
            }}
          >
            {isValid ? 'Drop to open file' : 'Unsupported file type'}
          </div>
        </div>
      )}

      <Titlebar />
      <Toolbar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {sqlEditorOpen && filePath && <SQLEditor />}

        <div className="flex-1 min-h-0">
          {filePath ? <DataTable /> : <DropZone />}
        </div>

        {/* Error toast */}
        {error && (
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 max-w-lg px-4 py-2.5 rounded-lg shadow-xl text-xs animate-fade-in"
            style={{ background: '#7f1d1d', color: '#fca5a5', border: '1px solid #dc2626' }}
          >
            {error}
          </div>
        )}
      </div>

      {/* Side panels */}
      {activePanel === 'metadata' && <MetadataPanel />}
      {activePanel === 'settings' && <SettingsPanel />}
    </div>
  )
}
