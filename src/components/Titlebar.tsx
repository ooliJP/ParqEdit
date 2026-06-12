import { useEffect, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { IconWinMin, IconWinMax, IconWinClose } from './icons'
import logoMaskUrl from '../../assets/logo_mask.png'

export function Titlebar() {
  const fileName = useAppStore((s) => s.fileName)
  const hasUnsavedChanges = useAppStore((s) => s.hasUnsavedChanges)
  const editCount = useAppStore((s) => s.editCount)
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
      {/* Logo — masked so it always matches the theme accent */}
      <div className="no-drag flex items-center gap-2 px-4 h-full shrink-0">
        <div
          className="w-[17px] h-[17px]"
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
        <span className="font-display font-semibold text-[13px]" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
          ParqEdit
        </span>
      </div>

      {/* File name */}
      <div className="flex-1 flex items-center justify-center gap-1.5 min-w-0">
        {fileName && (
          <span className="text-[11.5px] font-mono truncate max-w-xs" style={{ color: 'var(--text-sub)' }}>
            {fileName}
            {hasUnsavedChanges && (
              <span className="ml-2 text-[10px]" style={{ color: 'var(--unsaved)', letterSpacing: '0.06em' }}>
                ● {editCount > 0 ? `${editCount} edit${editCount !== 1 ? 's' : ''}` : 'modified'}
              </span>
            )}
          </span>
        )}
      </div>

      {/* Window controls */}
      <div className="no-drag flex items-center h-full shrink-0">
        <button
          onClick={() => window.api.minimize()}
          aria-label="Minimize"
          className="flex items-center justify-center w-10 h-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <IconWinMin size={12} />
        </button>
        <button
          onClick={() => window.api.maximize()}
          aria-label="Maximize"
          className="flex items-center justify-center w-10 h-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          <IconWinMax size={10} filledStroke={isMax} />
        </button>
        <button
          onClick={() => window.api.close()}
          aria-label="Close"
          className="flex items-center justify-center w-10 h-full transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'var(--unsaved)'
            ;(e.currentTarget as HTMLElement).style.color = '#fff'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLElement).style.background = 'transparent'
            ;(e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'
          }}
        >
          <IconWinClose size={12} />
        </button>
      </div>
    </div>
  )
}
