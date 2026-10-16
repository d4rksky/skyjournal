import type { FieldType } from '@/lib/types'
import { cn } from '@/lib/utils'

export type FieldTypePaletteProps = {
  onAdd: (type: Exclude<FieldType, 'combobox'>) => void
}

type PaletteEntry = {
  type: Exclude<FieldType, 'combobox'>
  name: string
  hint: string
}

const PALETTE: PaletteEntry[] = [
  {
    type: 'segmented',
    name: 'دکمه‌های چسبیده',
    hint: 'دکمه‌های چسبیده در یک خط. با کلیک همان دکمه فعال می‌شود؛ مثل خرید و فروش.'
  },
  {
    type: 'stackedButtons',
    name: 'دکمه خط جدا',
    hint: 'هر گزینه یک دکمه تمام‌عرض در خط جداگانه است.'
  },
  {
    type: 'radioRow',
    name: 'رادیو ردیفی',
    hint: 'فقط یک گزینه، به صورت رادیو در یک ردیف.'
  },
  {
    type: 'checkboxRow',
    name: 'چک‌باکس ردیفی',
    hint: 'چند گزینه همزمان، چک‌باکس‌ها در یک ردیف.'
  },
  {
    type: 'checkboxColumn',
    name: 'چک‌لیست ستونی',
    hint: 'چند گزینه زیر هم، مثل چک‌لیست.'
  },
  {
    type: 'select',
    name: 'سلکت تک‌گزینه',
    hint: 'انتخاب فقط یک گزینه از فهرست.'
  },
  {
    type: 'multiSelect',
    name: 'سلکت چندگزینه',
    hint: 'انتخاب چند گزینه از فهرست.'
  },
  {
    type: 'input',
    name: 'ورودی متن',
    hint: 'متن کوتاه یک‌خطی.'
  },
  {
    type: 'textarea',
    name: 'متن بلند',
    hint: 'متن بلند چندخطی.'
  }
]

const FieldTypePreview = ({ type }: { type: Exclude<FieldType, 'combobox'> }) => {
  if (type === 'segmented') {
    return (
      <div className="rounded-lg bg-track p-0.5" aria-hidden>
        <div className="flex gap-0.5">
          <span className="rounded-md bg-white px-2 py-0.5 text-[10px] text-ink shadow-sm">الف</span>
          <span className="rounded-md px-2 py-0.5 text-[10px] text-muted">ب</span>
        </div>
      </div>
    )
  }

  if (type === 'stackedButtons') {
    return (
      <div className="flex w-full flex-col gap-1" aria-hidden>
        <span className="block rounded-lg bg-accent px-2 py-1 text-center text-[10px] text-white">۱</span>
        <span className="block rounded-lg border border-line bg-card px-2 py-1 text-center text-[10px] text-ink">
          ۲
        </span>
      </div>
    )
  }

  if (type === 'radioRow') {
    return (
      <div className="flex gap-2" aria-hidden>
        <span className="inline-flex items-center gap-1 text-[10px] text-ink">
          <span className="size-2 rounded-full border-2 border-accent bg-accent" />
          الف
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="size-2 rounded-full border border-line" />
          ب
        </span>
      </div>
    )
  }

  if (type === 'checkboxRow') {
    return (
      <div className="flex gap-2" aria-hidden>
        <span className="inline-flex items-center gap-1 text-[10px] text-ink">
          <span className="size-2 rounded border border-accent bg-accent" />
          الف
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="size-2 rounded border border-line" />
          ب
        </span>
      </div>
    )
  }

  if (type === 'checkboxColumn') {
    return (
      <div className="flex flex-col gap-1" aria-hidden>
        <span className="inline-flex items-center gap-1 text-[10px] text-ink">
          <span className="size-2 rounded border border-accent bg-accent" />
          الف
        </span>
        <span className="inline-flex items-center gap-1 text-[10px] text-muted">
          <span className="size-2 rounded border border-line" />
          ب
        </span>
      </div>
    )
  }

  if (type === 'select') {
    return (
      <div
        className="flex h-6 w-full items-center justify-between rounded-lg border border-line bg-card px-2 text-[10px] text-muted"
        aria-hidden
      >
        <span>▼</span>
        <span>انتخاب</span>
      </div>
    )
  }

  if (type === 'multiSelect') {
    return (
      <div
        className="flex h-6 w-full items-center justify-between rounded-lg border border-line bg-card px-2 text-[10px] text-ink"
        aria-hidden
      >
        <span>▼</span>
        <span className="truncate">۲ مورد</span>
      </div>
    )
  }

  if (type === 'input') {
    return (
      <div
        className="h-6 w-full rounded-lg border border-line bg-card px-2 text-[10px] leading-6 text-muted"
        aria-hidden
      >
        …
      </div>
    )
  }

  return (
    <div
      className="h-10 w-full rounded-lg border border-line bg-card px-2 py-1 text-[10px] text-muted"
      aria-hidden
    >
      …
      <br />
      …
    </div>
  )
}

export const FieldTypePalette = ({ onAdd }: FieldTypePaletteProps) => {
  return (
    <div className="flex flex-wrap gap-2">
      {PALETTE.map((entry) => {
        const hintId = `field-type-hint-${entry.type}`

        const handleClick = () => {
          onAdd(entry.type)
        }

        return (
          <button
            key={entry.type}
            type="button"
            aria-describedby={hintId}
            onClick={handleClick}
            className={cn(
              'group relative flex min-w-[7.5rem] flex-col gap-2 rounded-2xl border border-line bg-card p-3 text-right transition-colors',
              'hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
            )}
          >
            <FieldTypePreview type={entry.type} />
            <span className="text-xs font-medium text-ink">{entry.name}</span>
            <span
              id={hintId}
              role="tooltip"
              className={cn(
                'pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-48 -translate-x-1/2 rounded-xl border border-line bg-card px-2 py-1.5 text-[11px] leading-snug text-muted shadow-sm',
                'opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'
              )}
            >
              {entry.hint}
            </span>
          </button>
        )
      })}
    </div>
  )
}
