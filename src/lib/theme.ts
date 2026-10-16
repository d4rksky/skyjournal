export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'skyjournal-theme'

export const getSystemTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const getStoredTheme = (): Theme | null => {
  if (typeof window === 'undefined') return null
  const value = localStorage.getItem(STORAGE_KEY)
  if (value === 'light' || value === 'dark') return value
  return null
}

export const resolveTheme = (): Theme => getStoredTheme() ?? getSystemTheme()

export const applyTheme = (theme: Theme) => {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const setTheme = (theme: Theme) => {
  localStorage.setItem(STORAGE_KEY, theme)
  applyTheme(theme)
}

export const toggleTheme = (): Theme => {
  const next: Theme = resolveTheme() === 'dark' ? 'light' : 'dark'
  setTheme(next)
  return next
}
