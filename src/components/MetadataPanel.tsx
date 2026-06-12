import { useEffect, useState } from 'react'
import { X, FolderOpen, HardDrive, Rows, Columns, ExternalLink, Copy, Check } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { typeColorVar, formatBytes } from '../typeStyle'
import type { Metadata } from '../types'

export function MetadataPanel() {
  const { filePath, setActivePanel } = useAppStore()
  const [meta, setMeta] = useState<Metadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  function copySchema(schema: Metadata['schema']) {
    const text = schema.map(c => `${c.name}: ${c.type}`).join('\n')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  useEffect(() => {
    if (!filePath) return
    setLoading(true)
    window.api.getMetadata().then((m: any) => {
      setMeta(m)
      setLoading(false)
    })
  }, [filePath])

  return (
    <div className="panel animate-slide-in">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 h-12 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
          File Metadata
        </span>
        <button className="btn-ghost p-1.5" onClick={() => setActivePanel('none')}>
          <X size={15} />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Loading…
        </div>
      ) : !meta ? (
        <div className="flex-1 flex items-center justify-center text-sm" style={{ color: 'var(--text-muted)' }}>
          No metadata available
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* File info */}
          <div className="px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              File
            </h3>
            <div className="space-y-2.5">
              <InfoRow icon={<FolderOpen size={13} />} label="Path">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate text-xs font-mono" style={{ color: 'var(--text)' }}>
                    {meta.filePath}
                  </span>
                  <button
                    className="shrink-0"
                    onClick={() => window.api.showInExplorer(meta.filePath)}
                    title="Show in Explorer"
                  >
                    <ExternalLink size={11} style={{ color: 'var(--text-muted)' }} />
                  </button>
                </div>
              </InfoRow>
              <InfoRow icon={<HardDrive size={13} />} label="Size">
                <span style={{ color: 'var(--text)' }}>{formatBytes(meta.fileSize)}</span>
              </InfoRow>
              <InfoRow icon={<Rows size={13} />} label="Rows">
                <span style={{ color: 'var(--text)' }}>{meta.totalRows.toLocaleString()}</span>
              </InfoRow>
              <InfoRow icon={<Columns size={13} />} label="Columns">
                <span style={{ color: 'var(--text)' }}>{meta.schema.length}</span>
              </InfoRow>
            </div>
          </div>

          {/* Schema */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Schema
              </h3>
              <button
                className="btn py-0.5 px-2 gap-1 text-xs"
                onClick={() => copySchema(meta.schema)}
                title="Copy schema to clipboard"
              >
                {copied ? <Check size={11} style={{ color: 'var(--t-float)' }} /> : <Copy size={11} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="space-y-1">
              {meta.schema.map((col, i) => (
                <div
                  key={col.name}
                  className="flex items-center justify-between py-1.5 px-3 rounded-md"
                  style={{ background: i % 2 === 0 ? 'var(--bg-hover)' : 'transparent' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-right shrink-0 font-mono" style={{ color: 'var(--text-muted)', width: 20 }}>
                      {i + 1}
                    </span>
                    <span className="text-xs font-medium truncate" style={{ color: 'var(--text)' }}>
                      {col.name}
                    </span>
                  </div>
                  <span className="type-badge" style={{ color: typeColorVar(col.type) }}>
                    {col.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Parquet KV metadata */}
          {meta.parquetMeta?.kv && meta.parquetMeta.kv.length > 0 && (
            <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
                Parquet Metadata
              </h3>
              <div className="space-y-1">
                {meta.parquetMeta.kv.map((row: any, i: number) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="shrink-0 font-mono" style={{ color: 'var(--text-muted)' }}>
                      {row.key}
                    </span>
                    <span className="truncate font-mono" style={{ color: 'var(--text)' }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span style={{ color: 'var(--text-muted)', marginTop: 1 }}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
        {children}
      </div>
    </div>
  )
}
