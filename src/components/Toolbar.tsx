import { Loader2 } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import {
  IconOpen,
  IconSave,
  IconSql,
  IconAddRow,
  IconReset,
  IconMetadata,
  IconSettings,
  IconNewFile,
  IconClearFilter,
} from './icons'

interface Props {
  onNewFile: () => void
  onSave: () => void
}

export function Toolbar({ onNewFile, onSave }: Props) {
  const {
    filePath,
    isNewFile,
    isLoading,
    hasUnsavedChanges,
    sqlMode,
    sqlEditorOpen,
    columnFilters,
    activePanel,
    setSqlEditorOpen,
    setActivePanel,
    clearColumnFilters,
    resetView,
    openFile,
    appendRow,
  } = useAppStore()

  const hasFile = Boolean(filePath || isNewFile)
  const hasColumnFilters = Object.keys(columnFilters).length > 0

  async function handleOpen() {
    const path = await window.api.openFileDialog()
    if (path) await openFile(path)
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
      style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}
    >
      <button className="btn" onClick={handleOpen} title="Open file (Ctrl+O)">
        <IconOpen size={14} />
        <span>Open</span>
      </button>

      {!hasFile && (
        <button className="btn" onClick={onNewFile} title="Create new file">
          <IconNewFile size={14} />
          <span>New</span>
        </button>
      )}

      {hasFile && (
        <>
          <button
            className="btn"
            onClick={onSave}
            title="Save / Export (Ctrl+S)"
            style={hasUnsavedChanges ? { color: 'var(--unsaved)' } : undefined}
          >
            <IconSave size={14} />
            <span>Save</span>
          </button>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--border)' }} />

          <button
            className={`btn${sqlMode || sqlEditorOpen ? ' btn-active' : ''}`}
            onClick={toggleSqlEditor}
            title="SQL query editor"
          >
            <IconSql size={14} />
            <span>SQL</span>
          </button>

          <button
            className="btn"
            onClick={appendRow}
            title="Append an empty row"
          >
            <IconAddRow size={14} />
            <span>Add Row</span>
          </button>

          {hasColumnFilters && (
            <button
              className="btn"
              onClick={clearColumnFilters}
              title="Clear column filters"
              style={{ color: 'var(--accent)' }}
            >
              <IconClearFilter size={14} />
              <span>Clear Filters</span>
            </button>
          )}

          {sqlMode && (
            <button
              className="btn"
              onClick={resetView}
              title="Reset to original view — clears SQL, filters and sort"
              style={{ color: 'var(--accent)' }}
            >
              <IconReset size={14} />
              <span>Reset View</span>
            </button>
          )}

          <div className="flex-1" />

          {filePath && (
            <button
              className={`btn${activePanel === 'metadata' ? ' btn-active' : ''}`}
              onClick={() => togglePanel('metadata')}
              title="File metadata & schema"
            >
              <IconMetadata size={14} />
              <span>Metadata</span>
            </button>
          )}
        </>
      )}

      {!hasFile && <div className="flex-1" />}

      {isLoading && (
        <Loader2 size={14} className="animate-spin mr-1" style={{ color: 'var(--text-muted)' }} />
      )}

      <button
        className={`btn${activePanel === 'settings' ? ' btn-active' : ''}`}
        onClick={() => togglePanel('settings')}
        title="Settings"
      >
        <IconSettings size={14} />
        <span>Settings</span>
      </button>
    </div>
  )
}
