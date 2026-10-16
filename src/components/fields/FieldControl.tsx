import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { FieldDefinition, SymbolItem } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  SegmentedControl,
  type SegmentedControlTone
} from '@/components/fields/SegmentedControl'

export type FieldControlProps = {
  field: FieldDefinition
  value: string | string[] | undefined
  onChange: (value: string | string[]) => void
  symbols?: SymbolItem[]
  onCreateSymbol?: (label: string) => void
}

const normalizeArray = (value: string | string[] | undefined): string[] =>
  Array.isArray(value) ? value : []

const normalizeString = (value: string | string[] | undefined): string => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value[0] ?? ''
  return ''
}

export const FieldControl = ({
  field,
  value,
  onChange,
  symbols = [],
  onCreateSymbol
}: FieldControlProps) => {
  const listId = useId()
  const comboboxRef = useRef<HTMLDivElement>(null)
  const [multiOpen, setMultiOpen] = useState(false)
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [comboboxQuery, setComboboxQuery] = useState('')

  const stringValue = normalizeString(value)
  const arrayValue = normalizeArray(value)

  useEffect(() => {
    if (field.type !== 'combobox') return

    const handlePointerDown = (event: MouseEvent) => {
      if (!comboboxRef.current?.contains(event.target as Node)) {
        setComboboxOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [field.type])

  useEffect(() => {
    if (field.type !== 'combobox') return
    setComboboxQuery(stringValue)
  }, [field.type, stringValue])

  if (field.type === 'segmented') {
    const suffix = field.builtinKey === 'risk' ? '%' : undefined
    const tone: SegmentedControlTone =
      field.builtinKey === 'side'
        ? 'side'
        : field.builtinKey === 'result'
          ? 'result'
          : 'primary'

    return (
      <SegmentedControl
        options={field.options}
        value={stringValue || undefined}
        onChange={(id) => onChange(id)}
        ariaLabel={field.label}
        suffix={suffix}
        tone={tone}
      />
    )
  }

  if (field.type === 'stackedButtons') {
    return (
      <div className="flex flex-col gap-2">
        {field.options.map((option) => {
          const selected = stringValue === option.id

          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.id)}
              className={cn(
                'w-full rounded-2xl px-4 py-3 text-sm font-medium transition-colors',
                selected
                  ? 'bg-accent text-white'
                  : 'border border-line bg-card text-ink'
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'radioRow') {
    const groupName = `field-${field.id}`

    return (
      <div className="flex flex-wrap gap-4" role="radiogroup" aria-label={field.label}>
        {field.options.map((option) => {
          const selected = stringValue === option.id

          return (
            <label
              key={option.id}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
            >
              <input
                type="radio"
                name={groupName}
                value={option.id}
                checked={selected}
                onChange={() => onChange(option.id)}
                className="size-4 accent-[var(--accent,theme(colors.accent.DEFAULT))]"
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (field.type === 'checkboxRow') {
    return (
      <div className="flex flex-wrap gap-4" role="group" aria-label={field.label}>
        {field.options.map((option) => {
          const checked = arrayValue.includes(option.id)

          const handleCheckedChange = (next: boolean | 'indeterminate') => {
            if (next === true) {
              onChange([...arrayValue, option.id])
              return
            }
            onChange(arrayValue.filter((id) => id !== option.id))
          }

          return (
            <label
              key={option.id}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={handleCheckedChange}
                aria-label={option.label}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (field.type === 'checkboxColumn') {
    return (
      <div className="flex flex-col gap-3" role="group" aria-label={field.label}>
        {field.options.map((option) => {
          const checked = arrayValue.includes(option.id)

          const handleCheckedChange = (next: boolean | 'indeterminate') => {
            if (next === true) {
              onChange([...arrayValue, option.id])
              return
            }
            onChange(arrayValue.filter((id) => id !== option.id))
          }

          return (
            <label
              key={option.id}
              className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={handleCheckedChange}
                aria-label={option.label}
              />
              <span>{option.label}</span>
            </label>
          )
        })}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <select
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label={field.label}
        className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
      >
        <option value="">انتخاب نشده</option>
        {field.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'multiSelect') {
    const selectedLabels = field.options
      .filter((option) => arrayValue.includes(option.id))
      .map((option) => option.label)

    const triggerLabel =
      selectedLabels.length > 0 ? selectedLabels.join('، ') : 'انتخاب کنید'

    const handleToggle = (optionId: string) => {
      if (arrayValue.includes(optionId)) {
        onChange(arrayValue.filter((id) => id !== optionId))
        return
      }
      onChange([...arrayValue, optionId])
    }

    return (
      <div className="relative">
        <Button
          type="button"
          variant="secondary"
          aria-expanded={multiOpen}
          aria-haspopup="listbox"
          aria-label={field.label}
          onClick={() => setMultiOpen((open) => !open)}
          className="h-11 w-full justify-between rounded-xl border-line bg-card px-3 font-normal text-ink"
        >
          <span className="truncate text-sm">{triggerLabel}</span>
          <ChevronDown className="size-4 shrink-0 text-muted" aria-hidden />
        </Button>
        {multiOpen && (
          <div
            role="listbox"
            aria-label={field.label}
            aria-multiselectable
            className="absolute z-20 mt-2 w-full rounded-2xl border border-line bg-card p-3 shadow-sm"
          >
            <div className="flex flex-col gap-3">
              {field.options.map((option) => {
                const checked = arrayValue.includes(option.id)

                return (
                  <label
                    key={option.id}
                    className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => handleToggle(option.id)}
                      aria-label={option.label}
                    />
                    <span>{option.label}</span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  if (field.type === 'input') {
    return (
      <Input
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label={field.label}
        className="h-11 rounded-xl border-line bg-card"
      />
    )
  }

  if (field.type === 'date') {
    return (
      <Input
        type="date"
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label={field.label}
        className="h-11 rounded-xl border-line bg-card"
      />
    )
  }

  if (field.type === 'textarea') {
    return (
      <Textarea
        value={stringValue}
        onChange={(event) => onChange(event.target.value)}
        aria-label={field.label}
        className="min-h-[96px] rounded-xl border-line bg-card"
      />
    )
  }

  if (field.type === 'combobox') {
    const trimmed = comboboxQuery.trim()
    const filtered = symbols.filter((symbol) =>
      symbol.label.toLowerCase().includes(trimmed.toLowerCase())
    )
    const exactMatch = symbols.some(
      (symbol) => symbol.label.toLowerCase() === trimmed.toLowerCase()
    )
    const showCreate = trimmed.length > 0 && !exactMatch && onCreateSymbol

    const handleInputChange = (next: string) => {
      setComboboxQuery(next)
      onChange(next)
      setComboboxOpen(true)
    }

    const handlePickSymbol = (label: string) => {
      setComboboxQuery(label)
      onChange(label)
      setComboboxOpen(false)
    }

    const handleCreate = () => {
      if (!onCreateSymbol || !trimmed) return
      onCreateSymbol(trimmed)
      setComboboxOpen(false)
    }

    return (
      <div ref={comboboxRef} className="relative w-full">
        <Input
          value={comboboxQuery}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={() => setComboboxOpen(true)}
          aria-label={field.label}
          aria-expanded={comboboxOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          role="combobox"
          className="h-11 w-full rounded-xl border-line bg-card"
        />
        {comboboxOpen && (filtered.length > 0 || showCreate) && (
          <ul
            id={listId}
            role="listbox"
            aria-label={field.label}
            className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto rounded-2xl border border-line bg-card py-1 shadow-sm"
          >
            {filtered.map((symbol) => (
              <li key={symbol.id} role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-right text-sm text-ink hover:bg-accent-soft"
                  onClick={() => handlePickSymbol(symbol.label)}
                >
                  {symbol.label}
                </button>
              </li>
            ))}
            {showCreate && (
              <li role="option">
                <button
                  type="button"
                  className="w-full px-3 py-2 text-right text-sm text-accent hover:bg-accent-soft"
                  onClick={handleCreate}
                >
                  {`افزودن «${trimmed}»`}
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    )
  }

  return null
}
