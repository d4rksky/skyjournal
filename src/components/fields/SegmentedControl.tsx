import type { KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'

export type SegmentedControlOption = { id: string; label: string }

export type SegmentedControlTone = 'primary' | 'side' | 'result'

export type SegmentedControlProps = {
  options: SegmentedControlOption[]
  value: string | undefined
  onChange: (id: string) => void
  ariaLabel: string
  suffix?: string
  tone?: SegmentedControlTone
}

const selectedClassForOption = (tone: SegmentedControlTone, optionId: string): string => {
  if (tone === 'side') {
    if (optionId === 'buy') return 'bg-success text-white shadow-sm'
    if (optionId === 'sell') return 'bg-danger text-white shadow-sm'
    return 'bg-accent text-white shadow-sm'
  }

  if (tone === 'result') {
    if (optionId === 'profit') return 'bg-success text-white shadow-sm'
    if (optionId === 'loss') return 'bg-danger text-white shadow-sm'
    if (optionId === 'risk_free') return 'bg-warning text-white shadow-sm'
    return 'bg-accent text-white shadow-sm'
  }

  return 'bg-accent text-white shadow-sm'
}

export const SegmentedControl = ({
  options,
  value,
  onChange,
  ariaLabel,
  suffix,
  tone = 'primary'
}: SegmentedControlProps) => {
  const handleSelect = (id: string) => {
    if (value === id) return
    onChange(id)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowRight' ? 1 : -1
    const next = (index + delta + options.length) % options.length
    onChange(options[next].id)
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="overflow-x-auto rounded-xl bg-track p-1"
    >
      <div className="flex min-w-min flex-nowrap">
        {options.map((option, index) => {
          const selected = value === option.id
          const displayLabel = suffix ? `${option.label}${suffix}` : option.label

          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => handleSelect(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={cn(
                'shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                selected
                  ? selectedClassForOption(tone, option.id)
                  : 'text-muted hover:text-ink'
              )}
            >
              {displayLabel}
            </button>
          )
        })}
      </div>
    </div>
  )
}
