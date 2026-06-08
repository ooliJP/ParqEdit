import {
  FolderOpen,
  Save,
  Info,
  Terminal,
  Settings,
  FilterX,
  Loader2,
} from 'lucide-react'
import { useAppStore } from '../store/appStore'

export function Toolbar() {
  const {
    filePath,
    isLoading,
    hasUnsavedChanges,
    sqlMode,
    columnFilters,
    activePanel,
    setSqlMode,
    setActivePanel,
    clearAllFilters,
    openFile,
    saveFile,
  } = useAppStore()

  const hasActiveFilters = Object.keys(columnFilters).length > 0 || sqlMode

  async function handleOpen() {
    const path = await window.api.openFileDialog()
    if (path) await openFile(path)
  }

  async function handleSave() {
    const ext = filePath?.endsWith('.csv') ? 'csv' : 'parquet'
    const savePath = await window.api.saveFileDialog(ext)
    if (savePath) await saveFile(savePath)
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
            title="Save file"
            style={hasUnsavedChanges ? { color: 'var(--accent)' } : undefined}
          >
            <Save size={14} />
            <span>Save</span>
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

          <button
            className="btn"
            onClick={() => {
              setSqlMode(!sqlMode)
              if (sqlMode) clearAllFilters()
            }}
            style={sqlMode ? { color: 'var(--accent)', background: 'var(--bg-hover)' } : undefined}
            title="SQL Query editor"
          >
            <Terminal size={14} />
            <span>SQL</span>
          </button>

          {hasActiveFilters && (
            <button
              className="btn"
              onClick={clearAllFilters}
              title="Clear all filters & sort"
              style={{ color: 'var(--accent)' }}
            >
              <FilterX size={14} />
              <span>Clear filters</span>
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
