import { useEffect, useState } from 'react'
import {
  applyTheme,
  getStoredTheme,
  getSystemTheme,
  resolveTheme,
  setTheme,
  type Theme
} from '@/lib/theme'

export const useTheme = () => {
  const [theme, setThemeState] = useState<Theme>(() => resolveTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const handleSystemChange = () => {
      if (getStoredTheme() !== null) return
      const next = getSystemTheme()
      setThemeState(next)
      applyTheme(next)
    }

    media.addEventListener('change', handleSystemChange)
    return () => media.removeEventListener('change', handleSystemChange)
  }, [])

  const handleSetTheme = (next: Theme) => {
    setTheme(next)
    setThemeState(next)
  }

  const handleToggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    handleSetTheme(next)
  }

  return {
    theme,
    handleSetTheme,
    handleToggleTheme
  }
}
