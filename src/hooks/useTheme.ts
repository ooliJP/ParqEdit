import { useEffect } from 'react'
import { useAppStore } from '../store/appStore'
import type { Theme } from '../types'

export function useTheme() {
  const theme = useAppStore((s) => s.theme)
  const setTheme = useAppStore((s) => s.setTheme)

  useEffect(() => {
    const root = document.documentElement
    const apply = (t: Theme) => {
      if (t === 'dark') {
        root.classList.add('dark')
      } else if (t === 'light') {
        root.classList.remove('dark')
      } else {
        // system
        const mq = window.matchMedia('(prefers-color-scheme: dark)')
        if (mq.matches) root.classList.add('dark')
        else root.classList.remove('dark')
      }
    }

    apply(theme)

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      const handler = () => apply('system')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }
  }, [theme])

  // Persist to localStorage
  useEffect(() => {
    const saved = localStorage.getItem('parqedit-theme') as Theme | null
    if (saved) setTheme(saved)
  }, [setTheme])

  useEffect(() => {
    localStorage.setItem('parqedit-theme', theme)
  }, [theme])

  return { theme, setTheme }
}
