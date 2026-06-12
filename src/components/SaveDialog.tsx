import { useState } from 'react'
import { X } from 'lucide-react'
import { useAppStore } from '../store/appStore'

type ExportFormat = 'parquet' | 'csv' | 'json' | 'ndjson' | 'tsv' | 'arrow'
type Compression = 'snappy' | 'zstd' | 'gzip'

const FORMATS: { value: ExportFormat; label: string; ext: string; desc: string }[] = [
  { value: 'parquet', label: 'Parquet', ext: 'parquet', desc: 'Columnar, compressed' },
  { value: 'csv', label: 'CSV', ext: 'csv', desc: 'Comma-separated' },
  { value: 'json', label: 'JSON', ext: 'json', desc: 'Array of objects' },
  { value: 'ndjson', label: 'NDJSON', ext: 'ndjson', desc: 'One record per line' },
  { value: 'tsv', label: 'TSV', ext: 'tsv', desc: 'Tab-separated' },
  { value: 'arrow', label: 'Arrow', ext: 'arrow', desc: 'Apache Arrow IPC' },
]

const COMPRESSIONS: { value: Compression; label: string; desc: string }[] = [
  { value: 'snappy', label: 'Snappy', desc: 'Fast, balanced (recommended)' },
  { value: 'zstd', label: 'ZSTD', desc: 'Smaller files, still fast' },
  { value: 'gzip', label: 'GZIP', desc: 'Widest compatibility' },
]

interface Props {
  onClose: () => void
}

export function SaveDialog({ onClose }: Props) {
  const { filePath, saveFile } = useAppStore()
  const [format, setFormat] = useState<ExportFormat>(() =>
    filePath?.endsWith('.csv') ? 'csv' : 'parquet'
  )
  const [compression, setCompression] = useState<Compression>('snappy')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const ext = FORMATS.find((f) => f.value === format)?.ext ?? 'parquet'
    const savePath = await window.api.saveFileDialog(ext)
    if (!savePath) return
    setSaving(true)
    await saveFile(savePath, format, format === 'parquet' ? compression : undefined)
    setSaving(false)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center justify-between px-5 h-12 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Export / Save As</span>
          <button className="btn-ghost p-1.5" onClick={onClose}><X size={15} /></button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Format</p>
            <div className="grid grid-cols-3 gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  className="rounded-lg py-2 px-2 text-left transition-colors"
                  style={{
                    background: format === f.value ? 'var(--btn-bg)' : 'var(--bg-hover)',
                    color: format === f.value ? 'var(--btn-fg)' : 'var(--text)',
                    border: `1px solid ${format === f.value ? 'var(--btn-bg)' : 'var(--border)'}`,
                  }}
                  onClick={() => setFormat(f.value)}
                >
                  <div className="text-xs font-semibold">{f.label}</div>
                  <div className="text-[10px] opacity-70">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {format === 'parquet' && (
            <div>
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Compression</p>
              <div className="flex gap-1.5">
                {COMPRESSIONS.map((c) => (
                  <button
                    key={c.value}
                    className="flex-1 rounded-lg py-2 px-2 text-left transition-colors"
                    style={{
                      background: compression === c.value ? 'var(--accent-wash)' : 'var(--bg-hover)',
                      color: 'var(--text)',
                      border: `1px solid ${compression === c.value ? 'var(--accent)' : 'var(--border)'}`,
                    }}
                    onClick={() => setCompression(c.value)}
                  >
                    <div className="text-xs font-semibold">{c.label}</div>
                    <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{c.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          className="flex items-center justify-end gap-2 px-5 py-3 border-t"
          style={{ borderColor: 'var(--border)' }}
        >
          <button className="btn text-xs" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary text-xs py-1.5 px-4"
            onClick={handleSave}
            disabled={saving}
            style={saving ? { opacity: 0.6 } : undefined}
          >
            {saving ? 'Saving…' : 'Save As…'}
          </button>
        </div>
      </div>
    </div>
  )
}
