/**
 * Muted per-family datatype colors. The actual tones live in index.css as
 * theme-aware CSS variables so both light and dark stay in palette.
 */
export function typeColorVar(type: string): string {
  const t = type.toUpperCase()
  if (/INT|BIGINT|SMALLINT|TINYINT|HUGEINT/.test(t)) return 'var(--t-int)'
  if (/DOUBLE|FLOAT|DECIMAL|NUMERIC|REAL/.test(t)) return 'var(--t-float)'
  if (/VARCHAR|TEXT|STRING|CHAR/.test(t)) return 'var(--t-str)'
  if (/BOOLEAN/.test(t)) return 'var(--t-bool)'
  if (/DATE|TIME|TIMESTAMP/.test(t)) return 'var(--t-ts)'
  return 'var(--text-muted)'
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
