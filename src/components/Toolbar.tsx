import {
  FolderOpen,
  Save,
  Info,
  Terminal,
  Settings,
  FilterX,
  RotateCcw,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

export function Toolbar() {
  const {
    filePath,
    isLoading,
    hasUnsavedChanges,
    sqlMode,
    sqlEditorOpen,
    columnFilters,
    activePanel,
    setSqlEditorOpen,
    setSqlMode,
    setActivePanel,
    clearColumnFilters,
    resetView,
    openFile,
    saveFile,
  } = useAppStore()

  const hasColumnFilters = Object.keys(columnFilters).length > 0

  async function handleOpen() {
    const path = await window.api.openFileDialog()
    if (path) await openFile(path)
  }

  async function handleSave() {
    const ext = filePath?.endsWith('.csv') ? 'csv' : 'parquet'
    const savePath = await window.api.saveFileDialog(ext)
    if (savePath) await saveFile(savePath)
  }

  function toggleSqlEditor() {
    if (!sqlMode && !sqlEditorOpen) {
      setSqlEditorOpen(true)
    } else {
      setSqlEditorOpen(!sqlEditorOpen)
    }
  }

  function togglePanel(panel: 'metadata' | 'settings') {
    setActivePanel(activePanel === panel ? 'none' : panel)
  }

  return (
    <div
      className="flex items-center gap-1 px-2 h-10 shrink-0 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      {filePath && (
        <button className="btn" onClick={handleOpen} title="Open file (Ctrl+O)">
          <FolderOpen size={14} />
          <span>Open</span>
        </button>
      )}

      {filePath && (
        <>
          <button
            className="btn"
            onClick={handleSave}
            title="Save file (Ctrl+S)"
            style={hasUnsavedChanges ? { color: 'var(--accent)' } : undefined}
          >
            <Save size={14} />
            <span>Save</span>
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

          <button
            className="btn"
            onClick={toggleSqlEditor}
            style={sqlMode || sqlEditorOpen ? { color: 'var(--accent)', background: 'var(--bg-hover)' } : undefined}
            title="SQL query editor"
          >
            <Terminal size={14} />
            <span>SQL</span>
          </button>

          {hasColumnFilters && (
            <button
              className="btn"
              onClick={clearColumnFilters}
              title="Clear column filters"
              style={{ color: 'var(--accent)' }}
            >
              <FilterX size={14} />
              <span>Clear filters</span>
            </button>
          )}

          {sqlMode && (
            <button
              className="btn"
              onClick={resetView}
              title="Reset to original view — clears SQL, filters and sort"
              style={{ color: 'var(--accent)' }}
            >
              <RotateCcw size={14} />
              <span>Reset view</span>
            </button>
          )}

          <div className="flex-1" />

          <button
            className="btn"
            onClick={() => togglePanel('metadata')}
            style={activePanel === 'metadata' ? { color: 'var(--accent)', background: 'var(--bg-hover)' } : undefined}
            title="File metadata & schema"
          >
            <Info size={14} />
            <span>Metadata</span>
          </button>
        </>
      )}

      {!filePath && <div className="flex-1" />}

      {isLoading && (
        <Loader2 size={14} className="animate-spin mr-1" style={{ color: 'var(--text-muted)' }} />
      )}

      <button
        className="btn"
        onClick={() => togglePanel('settings')}
        style={activePanel === 'settings' ? { color: 'var(--accent)', background: 'var(--bg-hover)' } : undefined}
        title="Settings"
      >
        <Settings size={14} />
      </button>
    </div>
  )
}
