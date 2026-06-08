import { X, Sun, Moon, Monitor } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import type { Theme } from '../types'

const themes: { value: Theme; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
]

export function SettingsPanel() {
  const { theme, setTheme, setActivePanel, pageSize } = useAppStore()

  return (
    <div className="panel animate-slide-in">
      <div
        className="flex items-center justify-between px-5 h-12 border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Settings</span>
        <button className="btn-ghost p-1.5" onClick={() => setActivePanel('none')}>
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Theme */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Appearance
          </h3>
          <div className="flex gap-2">
            {themes.map((t) => (
              <button
                key={t.value}
                className="flex-1 flex flex-col items-center gap-2 py-3 rounded-lg border transition-colors"
                style={{
                  borderColor: theme === t.value ? 'var(--accent)' : 'var(--border)',
                  background: theme === t.value ? 'var(--bg-hover)' : 'transparent',
                  color: theme === t.value ? 'var(--accent)' : 'var(--text-muted)',
                }}
                onClick={() => setTheme(t.value)}
              >
                {t.icon}
                <span className="text-xs font-medium">{t.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* About */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            About
          </h3>
          <div className="space-y-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <p><span style={{ color: 'var(--text)' }}>ParqEdit</span> v1.0.0</p>
            <p>Powered by DuckDB — read, query and edit Parquet & CSV files with real SQL.</p>
            <p>Double-click any cell to edit its value.</p>
            <p>Click a column header to sort. Use the filter icon for value-based filtering.</p>
          </div>
        </section>

        {/* Keyboard shortcuts */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
            Keyboard Shortcuts
          </h3>
          <div className="space-y-2">
            {[
              ['Ctrl+Enter', 'Run SQL query'],
              ['Esc', 'Cancel cell edit'],
              ['Enter', 'Commit cell edit'],
              ['Double-click', 'Edit a cell'],
            ].map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
                <kbd
                  className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{ background: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)' }}
                >
                  {key}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
