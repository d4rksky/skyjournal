import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Button } from '@/components/ui/button'

export const ThemeToggle = () => {
  const { theme, handleToggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={handleToggleTheme}
      aria-label={isDark ? 'فعال‌سازی حالت روشن' : 'فعال‌سازی حالت تیره'}
      aria-pressed={isDark}
      className="h-10 w-full justify-start rounded-xl border-line px-3"
    >
      {isDark ? (
        <Sun className="size-4 shrink-0 text-accent" aria-hidden />
      ) : (
        <Moon className="size-4 shrink-0 text-accent" aria-hidden />
      )}
      <span className="text-sm">{isDark ? 'حالت روشن' : 'حالت تیره'}</span>
    </Button>
  )
}
