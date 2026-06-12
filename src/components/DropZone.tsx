import { useState } from 'react'
import { useAppStore } from '../store/appStore'
import { IconFolderOpenBig, IconDocPlusBig } from './icons'
import logoMaskUrl from '../../assets/logo_mask.png'

interface Props {
  onNewFile: () => void
}

const EXTS = ['.parquet', '.csv']

export function DropZone({ onNewFile }: Props) {
  const openFile = useAppStore((s) => s.openFile)
  const [isDragging, setIsDragging] = useState(false)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
  }

  async function handleOpen() {
    const path = await window.api.openFileDialog()
    if (path) await openFile(path)
  }

  return (
    <div
      className="flex-1 flex flex-col items-center h-full"
      style={{ background: 'var(--bg)', paddingTop: '16vh' }}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={(e) => { if (!e.relatedTarget) setIsDragging(false) }}
      onDrop={handleDrop}
    >
      {/* Mark */}
      <div
        className="w-9 h-9 mb-5"
        style={{
          background: 'var(--accent)',
          WebkitMaskImage: `url(${logoMaskUrl})`,
          WebkitMaskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskImage: `url(${logoMaskUrl})`,
          maskRepeat: 'no-repeat',
          maskPosition: 'center',
          maskSize: 'contain',
        }}
      />

      <p className="mono-label mb-2" style={{ color: 'var(--text-muted)', letterSpacing: '0.14em' }}>
        PARQUET · CSV — VIEW, QUERY, EDIT
      </p>
      <h1
        className="font-display font-medium mb-10"
        style={{ color: 'var(--text)', fontSize: 24, letterSpacing: '-0.025em' }}
      >
        Drop a file anywhere<span style={{ color: 'var(--accent)' }}>.</span>
      </h1>

      {/* Two starters */}
      <div
        className="flex gap-3 p-3 rounded-md border transition-colors"
        style={{
          borderColor: isDragging ? 'var(--accent)' : 'transparent',
          borderStyle: 'dashed',
          background: isDragging ? 'var(--accent-wash)' : 'transparent',
        }}
      >
        <StarterCard
          icon={<IconFolderOpenBig size={30} />}
          title="Open File"
          desc="browse for an existing file"
          onClick={handleOpen}
        />
        <StarterCard
          icon={<IconDocPlusBig size={30} />}
          title="New File"
          desc="define a schema from scratch"
          onClick={onNewFile}
        />
      </div>
    </div>
  )
}

function StarterCard({
  icon, title, desc, onClick,
}: {
  icon: React.ReactNode
  title: string
  desc: string
  onClick: () => void
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-3 rounded transition-colors"
      style={{
        width: 208,
        padding: '26px 20px 20px',
        background: hover ? 'var(--bg-surface)' : 'transparent',
        border: `1px solid ${hover ? 'var(--text-sub)' : 'var(--border)'}`,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span style={{ color: hover ? 'var(--accent)' : 'var(--text-sub)', transition: 'color 0.15s' }}>
        {icon}
      </span>
      <span className="flex flex-col items-center gap-1">
        <span className="text-[13px] font-medium" style={{ color: 'var(--text)' }}>{title}</span>
        <span className="mono-label" style={{ color: 'var(--text-muted)' }}>{desc}</span>
      </span>
      <span className="flex gap-1.5 mt-1">
        {EXTS.map((ext) => (
          <span
            key={ext}
            className="mono-label px-2 py-0.5 rounded-sm"
            style={{ background: 'var(--bg-hover)', color: 'var(--text-sub)' }}
          >
            {ext}
          </span>
        ))}
      </span>
    </button>
  )
}
