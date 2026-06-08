import { useState } from 'react'
import { FileInput } from 'lucide-react'
import { useAppStore } from '../store/appStore'

export function DropZone() {
  const openFile = useAppStore((s) => s.openFile)
  const [isDragging, setIsDragging] = useState(false)

  // File opening is handled by the App-level native window drop listener.
  // This component only manages the blue-border visual state.
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  async function handleClick() {
    const path = await window.api.openFileDialog()
    if (path) await openFile(path)
  }

  return (
    <div
      className="flex-1 flex flex-col items-center"
      style={{ background: 'var(--bg)', paddingTop: '20vh' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => { if (!e.relatedTarget) setIsDragging(false) }}
      onDrop={handleDrop}
    >
      <button
        onClick={handleClick}
        className="flex flex-col items-center gap-4 p-12 rounded-2xl border-2 border-dashed transition-colors"
        style={{
          borderColor: isDragging ? 'var(--accent)' : 'var(--border)',
          background: isDragging ? 'var(--bg-hover)' : 'transparent',
        }}
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--bg-hover)' }}
        >
          <FileInput size={28} style={{ color: 'var(--accent)' }} />
        </div>
        <div className="text-center">
          <p className="font-medium mb-1" style={{ color: 'var(--text)' }}>
            Open a Parquet or CSV file
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Drop a file here or click to browse
          </p>
        </div>
        <div className="flex gap-2">
          {['.parquet', '.csv'].map((ext) => (
            <span
              key={ext}
              className="text-xs px-2 py-0.5 rounded-full font-mono"
              style={{ background: 'var(--bg-hover)', color: 'var(--text-muted)' }}
            >
              {ext}
            </span>
          ))}
        </div>
      </button>
    </div>
  )
}
