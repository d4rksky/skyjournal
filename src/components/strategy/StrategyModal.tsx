import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react'
import type {
  FieldDefinition,
  FieldOption,
  FieldType,
  Strategy,
  SymbolItem
} from '@/lib/types'
import { createBuiltinFields } from '@/lib/builtins'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { FieldTypePalette } from '@/components/fields/FieldTypePalette'

const TYPES_WITH_OPTIONS: FieldType[] = [
  'segmented',
  'stackedButtons',
  'radioRow',
  'checkboxRow',
  'checkboxColumn',
  'select',
  'multiSelect'
]

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  segmented: 'دکمه‌های چسبیده',
  stackedButtons: 'دکمه خط جدا',
  radioRow: 'رادیو ردیفی',
  checkboxRow: 'چک‌باکس ردیفی',
  checkboxColumn: 'چک‌لیست ستونی',
  select: 'سلکت تک‌گزینه',
  multiSelect: 'سلکت چندگزینه',
  input: 'ورودی متن',
  textarea: 'متن بلند',
  combobox: 'کامبوباکس',
  date: 'تاریخ'
}

const defaultOptions = (): FieldOption[] => [
  { id: crypto.randomUUID(), label: 'گزینه ۱' },
  { id: crypto.randomUUID(), label: 'گزینه ۲' }
]

const cloneFields = (fields: FieldDefinition[]): FieldDefinition[] =>
  fields.map((field) => ({
    ...field,
    options: field.options.map((option) => ({ ...option }))
  }))

export type StrategyModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  strategy: Strategy | null
  symbols: SymbolItem[]
  onSymbolsChange: () => void
  onSaved: () => void
}

type OptionEditorProps = {
  options: FieldOption[]
  onChange: (options: FieldOption[]) => void
}

const OptionEditor = ({ options, onChange }: OptionEditorProps) => {
  const handleLabelChange = (optionId: string, label: string) => {
    onChange(options.map((option) => (option.id === optionId ? { ...option, label } : option)))
  }

  const handleRemove = (optionId: string) => {
    if (options.length <= 1) return
    onChange(options.filter((option) => option.id !== optionId))
  }

  const handleAdd = () => {
    onChange([...options, { id: crypto.randomUUID(), label: `گزینه ${options.length + 1}` }])
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-track/30 p-3">
      {options.map((option) => (
        <div key={option.id} className="flex items-center gap-2">
          <Input
            value={option.label}
            onChange={(event) => handleLabelChange(option.id, event.target.value)}
            aria-label="برچسب گزینه"
            className="h-9 flex-1 rounded-xl border-line bg-card text-sm"
          />
          <Button
            type="button"
            variant="ghost"
            size="default"
            aria-label="حذف گزینه"
            disabled={options.length <= 1}
            onClick={() => handleRemove(option.id)}
            className="size-9 shrink-0 p-0 text-muted hover:text-ink"
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </div>
      ))}
      <Button type="button" variant="secondary" size="default" onClick={handleAdd} className="self-start">
        افزودن گزینه
      </Button>
    </div>
  )
}

type SymbolEditorProps = {
  symbols: SymbolItem[]
  onSymbolsChange: () => void
}

const SymbolEditor = ({ symbols, onSymbolsChange }: SymbolEditorProps) => {
  const [newLabel, setNewLabel] = useState('')
  const [symbolError, setSymbolError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const handleAdd = async () => {
    const label = newLabel.trim()
    if (!label) return
    setBusy(true)
    setSymbolError(null)
    try {
      await api.symbols.create(label)
      setNewLabel('')
      onSymbolsChange()
    } catch (error) {
      setSymbolError(error instanceof Error ? error.message : 'خطا در افزودن نماد')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string) => {
    setBusy(true)
    setSymbolError(null)
    try {
      await api.symbols.delete(id)
      onSymbolsChange()
    } catch (error) {
      setSymbolError(error instanceof Error ? error.message : 'خطا در حذف نماد')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-line bg-track/30 p-3">
      <div className="flex gap-2">
        <Input
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
          placeholder="نماد جدید"
          aria-label="نماد جدید"
          className="h-9 flex-1 rounded-xl border-line bg-card text-sm"
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              void handleAdd()
            }
          }}
        />
        <Button type="button" variant="secondary" disabled={busy || !newLabel.trim()} onClick={() => void handleAdd()}>
          افزودن
        </Button>
      </div>
      {symbols.length === 0 ? (
        <p className="text-sm text-muted">هنوز نمادی ثبت نشده است.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {symbols.map((symbol) => (
            <li
              key={symbol.id}
              className="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 text-sm text-ink"
            >
              <span>{symbol.label}</span>
              <Button
                type="button"
                variant="ghost"
                aria-label={`حذف ${symbol.label}`}
                disabled={busy}
                onClick={() => void handleDelete(symbol.id)}
                className="size-8 p-0 text-muted hover:text-ink"
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {symbolError && <p className="text-sm text-red-600">{symbolError}</p>}
    </div>
  )
}

type FieldRowProps = {
  field: FieldDefinition
  index: number
  total: number
  symbols: SymbolItem[]
  onSymbolsChange: () => void
  onUpdate: (field: FieldDefinition) => void
  onMove: (from: number, to: number) => void
  onRemove?: () => void
}

const FieldRow = ({
  field,
  index,
  total,
  symbols,
  onSymbolsChange,
  onUpdate,
  onMove,
  onRemove
}: FieldRowProps) => {
  const needsOptions = TYPES_WITH_OPTIONS.includes(field.type)
  const isSymbol = field.builtinKey === 'symbol'

  return (
    <div className="rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          {field.builtin ? (
            <p className="text-sm font-medium text-ink">{field.label}</p>
          ) : (
            <Input
              value={field.label}
              onChange={(event) => onUpdate({ ...field, label: event.target.value })}
              aria-label="نام فیلد"
              className="h-9 rounded-xl border-line bg-track/20 text-sm font-medium"
            />
          )}
          <p className="mt-1 text-xs text-muted">{FIELD_TYPE_LABELS[field.type]}</p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <Checkbox
            checked={field.enabled}
            onCheckedChange={(checked) => onUpdate({ ...field, enabled: checked === true })}
            aria-label="فعال در ژورنال"
          />
          <span>فعال</span>
        </label>
        <div className="flex shrink-0 gap-1">
          <Button
            type="button"
            variant="ghost"
            aria-label="جابجایی به بالا"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            className="size-9 p-0"
          >
            <ArrowUp className="size-4" aria-hidden />
          </Button>
          <Button
            type="button"
            variant="ghost"
            aria-label="جابجایی به پایین"
            disabled={index >= total - 1}
            onClick={() => onMove(index, index + 1)}
            className="size-9 p-0"
          >
            <ArrowDown className="size-4" aria-hidden />
          </Button>
          {!field.builtin && onRemove && (
            <Button
              type="button"
              variant="ghost"
              aria-label="حذف فیلد"
              onClick={onRemove}
              className="size-9 p-0 text-muted hover:text-ink"
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          )}
        </div>
      </div>
      {isSymbol && <SymbolEditor symbols={symbols} onSymbolsChange={onSymbolsChange} />}
      {needsOptions && !isSymbol && (
        <OptionEditor
          options={field.options}
          onChange={(options) => onUpdate({ ...field, options })}
        />
      )}
    </div>
  )
}

export const StrategyModal = ({
  open,
  onOpenChange,
  strategy,
  symbols,
  onSymbolsChange,
  onSaved
}: StrategyModalProps) => {
  const isEdit = strategy !== null
  const [name, setName] = useState('')
  const [fields, setFields] = useState<FieldDefinition[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (strategy) {
      setName(strategy.name)
      setFields(cloneFields(strategy.fields))
      return
    }
    setName('')
    setFields(createBuiltinFields())
  }, [open, strategy])

  const handleMove = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return
    setFields((prev) => {
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  const handleAddCustom = (type: Exclude<FieldType, 'combobox'>) => {
    const id = crypto.randomUUID()
    setFields((prev) => [
      ...prev,
      {
        id,
        key: id,
        label: 'فیلد جدید',
        type,
        options: TYPES_WITH_OPTIONS.includes(type) ? defaultOptions() : [],
        enabled: true,
        builtin: false
      }
    ])
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const payload = { name: trimmed, fields }
      if (isEdit && strategy) {
        await api.strategies.update(strategy.id, payload)
      } else {
        await api.strategies.create(payload)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره استراتژی')
    } finally {
      setSaving(false)
    }
  }

  const builtinFields = fields.filter((field) => field.builtin)
  const customFields = fields.filter((field) => !field.builtin)

  const updateFieldById = useCallback((fieldId: string, next: FieldDefinition) => {
    setFields((prev) => prev.map((field) => (field.id === fieldId ? next : field)))
  }, [])

  const removeFieldById = (fieldId: string) => {
    setFields((prev) => prev.filter((field) => field.id !== fieldId))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش استراتژی' : 'ثبت استراتژی'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="strategy-name">
              نام استراتژی
            </label>
            <Input
              id="strategy-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-xl border-line bg-card"
            />
          </div>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">فیلدهای اولیه</h3>
            <div className="flex flex-col gap-3">
              {builtinFields.map((field) => {
                const index = fields.findIndex((item) => item.id === field.id)
                return (
                  <FieldRow
                    key={field.id}
                    field={field}
                    index={index}
                    total={fields.length}
                    symbols={symbols}
                    onSymbolsChange={onSymbolsChange}
                    onUpdate={(next) => updateFieldById(field.id, next)}
                    onMove={handleMove}
                  />
                )
              })}
            </div>
            <p className="mt-4 rounded-2xl bg-accent-soft px-4 py-3 text-sm text-ink">
              چک‌باکس ریسک ثابت همیشه در فرم ژورنال هست و پیش‌فرض روشن است.
            </p>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-ink">فیلدهای سفارشی</h3>
            <FieldTypePalette onAdd={handleAddCustom} />
            <div className="mt-4 flex flex-col gap-3">
              {customFields.length === 0 ? (
                <p className="text-sm text-muted">فیلد سفارشی اضافه نشده است.</p>
              ) : (
                customFields.map((field) => {
                  const index = fields.findIndex((item) => item.id === field.id)
                  return (
                    <FieldRow
                      key={field.id}
                      field={field}
                      index={index}
                      total={fields.length}
                      symbols={symbols}
                      onSymbolsChange={onSymbolsChange}
                      onUpdate={(next) => updateFieldById(field.id, next)}
                      onMove={handleMove}
                      onRemove={() => removeFieldById(field.id)}
                    />
                  )
                })
              )}
            </div>
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button type="button" disabled={saving || !name.trim()} onClick={() => void handleSave()}>
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
