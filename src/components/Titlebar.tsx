import { useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import appIconUrl from '../../assets/app_icon.ico'

export function Titlebar() {
  const fileName = useAppStore((s) => s.fileName)
  const hasUnsavedChanges = useAppStore((s) => s.hasUnsavedChanges)
  const [isMax, setIsMax] = useState(false)

  useEffect(() => {
    const unsub = window.api.onMaximized((v) => setIsMax(v))
    return unsub
  }, [])

  return (
    <div
      className="drag-region flex items-center h-10 shrink-0 border-b"
      style={{ borderColor: 'var(--border)', background: 'var(--bg-surface)' }}
    >
      {/* Logo */}
      <div className="no-drag flex items-center gap-2 px-4 h-full shrink-0">
        <img src={appIconUrl} alt="" className="w-4 h-4 object-contain" />
        <span className="text-xs font-semibold tracking-wide" style={{ color: 'var(--text)' }}>
          ParqEdit
        </span>
      </div>

      {/* File name */}
      <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
        {fileName && (
          <span className="text-xs truncate max-w-xs" style={{ color: 'var(--text-muted)' }}>
            {fileName}
            {hasUnsavedChanges && (
              <span className="ml-1.5" style={{ color: 'var(--accent)' }}>●</span>
            )}
          </span>
        )}
      </div>

      {/* Window controls */}
      <div className="no-drag flex items-center h-full shrink-0">
        <button
          onClick={() => window.api.minimize()}
          className="flex items-center justify-center w-10 h-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.api.maximize()}
          className="flex items-center justify-center w-10 h-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <Square size={10} strokeWidth={isMax ? 2.5 : 1.5} />
        </button>
        <button
          onClick={() => window.api.close()}
          className="flex items-center justify-center w-10 h-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = '#ef4444'
            ;(e.currentTarget as HTMLElement).style.color = 'white'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  )
}
