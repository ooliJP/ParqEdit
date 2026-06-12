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
import { NewFileModal } from './components/NewFileModal'
import { SaveDialog } from './components/SaveDialog'

type DragState = 'none' | 'valid' | 'invalid'

const SUPPORTED = /\.(parquet|csv)$/i

export default function App() {
  useTheme()

  const { filePath, isNewFile, sqlMode, sqlEditorOpen, activePanel, error, clearError, openFile } = useAppStore()

  useEffect(() => {
    if (!error) return
    const t = setTimeout(clearError, 4000)
    return () => clearTimeout(t)
  }, [error, clearError])

  const [newFileModalOpen, setNewFileModalOpen] = useState(false)
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== 's') return
      if (!filePath && !isNewFile) return
      e.preventDefault()
      setSaveDialogOpen(true)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [filePath, isNewFile])

  useEffect(() => {
    return window.api.onOpenFile((path) => {
      if (filePath || isNewFile) window.api.openNewWindow(path)
      else openFile(path)
    })
  }, [filePath, isNewFile, openFile])

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
      if (filePath || isNewFile) window.api.openNewWindow(path)
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

  const showOverlay = dragState !== 'none' && (filePath !== null || isNewFile || dragState === 'invalid')
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
            background: isValid ? 'var(--accent-wash2)' : 'var(--unsaved-wash)',
            border: `2px dashed ${isValid ? 'var(--accent)' : 'var(--unsaved)'}`,
          }}
        >
          <div
            className="px-5 py-2.5 rounded font-mono text-xs animate-fade-in"
            style={{
              background: isValid ? 'var(--btn-bg)' : 'var(--unsaved)',
              color: isValid ? 'var(--btn-fg)' : '#fff',
              letterSpacing: '0.04em',
            }}
          >
            {isValid ? 'Drop to open file' : 'Unsupported file type'}
          </div>
        </div>
      )}

      {newFileModalOpen && <NewFileModal onClose={() => setNewFileModalOpen(false)} />}
      {saveDialogOpen && <SaveDialog onClose={() => setSaveDialogOpen(false)} />}

      <Titlebar />
      <Toolbar onNewFile={() => setNewFileModalOpen(true)} onSave={() => setSaveDialogOpen(true)} />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {sqlEditorOpen && filePath && <SQLEditor />}

        <div className="flex-1 min-h-0">
          {(filePath || isNewFile) ? <DataTable /> : <DropZone onNewFile={() => setNewFileModalOpen(true)} />}
        </div>

        {/* Error toast */}
        {error && (
          <div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 max-w-lg px-4 py-2.5 rounded shadow-xl text-xs animate-fade-in"
            style={{
              background: 'var(--bg-surface)',
              color: 'var(--text)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--unsaved)',
            }}
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
