import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Account, FieldDefinition, Strategy } from '@/lib/types'
import { collectEnabledFields } from '@/lib/strategyFields'
import {
  createEmptyFilterRule,
  getFilterKind,
  getOperatorsForKind,
  type FilterOperator,
  type TradeFilterRule
} from '@/lib/tradeFilters'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export type TradeFiltersDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  strategies: Strategy[]
  rules: TradeFilterRule[]
  onApply: (rules: TradeFilterRule[]) => void
}

const selectClassName =
  'flex h-11 w-full rounded-xl border border-line bg-card px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50'

const needsValueInput = (operator: FilterOperator): boolean =>
  operator !== 'empty' && operator !== 'notEmpty' && operator !== 'oneOf'

const needsSecondValue = (operator: FilterOperator): boolean => operator === 'between'

export const TradeFiltersDialog = ({
  open,
  onOpenChange,
  account,
  strategies,
  rules,
  onApply
}: TradeFiltersDialogProps) => {
  const [draft, setDraft] = useState<TradeFilterRule[]>([])

  const fields = useMemo(
    () => collectEnabledFields(account, strategies),
    [account, strategies]
  )

  const fieldsByKey = useMemo(() => {
    const map = new Map<string, FieldDefinition>()
    for (const field of fields) map.set(field.key, field)
    return map
  }, [fields])

  useEffect(() => {
    if (!open) return
    setDraft(rules.length > 0 ? rules.map((rule) => ({ ...rule, values: [...rule.values] })) : [])
  }, [open, rules])

  const handleAddRule = () => {
    if (fields.length === 0) return
    setDraft((prev) => [...prev, createEmptyFilterRule(fields[0])])
  }

  const handleClearAll = () => {
    setDraft([])
  }

  const handleFieldChange = (ruleId: string, fieldKey: string) => {
    const field = fieldsByKey.get(fieldKey)
    if (!field) return
    setDraft((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...createEmptyFilterRule(field),
              id: rule.id
            }
          : rule
      )
    )
  }

  const handleOperatorChange = (ruleId: string, operator: FilterOperator) => {
    setDraft((prev) =>
      prev.map((rule) =>
        rule.id === ruleId
          ? {
              ...rule,
              operator,
              value: needsValueInput(operator) ? rule.value : '',
              valueTo: needsSecondValue(operator) ? rule.valueTo : '',
              values: operator === 'oneOf' ? rule.values : []
            }
          : rule
      )
    )
  }

  const handleValueChange = (ruleId: string, value: string) => {
    setDraft((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, value } : rule)))
  }

  const handleValueToChange = (ruleId: string, valueTo: string) => {
    setDraft((prev) => prev.map((rule) => (rule.id === ruleId ? { ...rule, valueTo } : rule)))
  }

  const handleToggleOption = (ruleId: string, optionId: string) => {
    setDraft((prev) =>
      prev.map((rule) => {
        if (rule.id !== ruleId) return rule
        const has = rule.values.includes(optionId)
        return {
          ...rule,
          values: has ? rule.values.filter((item) => item !== optionId) : [...rule.values, optionId]
        }
      })
    )
  }

  const handleRemoveRule = (ruleId: string) => {
    setDraft((prev) => prev.filter((rule) => rule.id !== ruleId))
  }

  const handleApply = () => {
    onApply(draft)
    onOpenChange(false)
  }

  const renderValueControls = (rule: TradeFilterRule, field: FieldDefinition) => {
    const kind = getFilterKind(field)

    if (rule.operator === 'empty' || rule.operator === 'notEmpty') {
      return null
    }

    if (rule.operator === 'oneOf') {
      if (field.options.length === 0) {
        return (
          <p className="text-xs text-muted">این فیلد گزینه‌ای برای انتخاب ندارد.</p>
        )
      }
      return (
        <div className="max-h-36 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
          {field.options.map((option) => {
            const checked = rule.values.includes(option.id)
            return (
              <label
                key={option.id}
                className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-track/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => handleToggleOption(rule.id, option.id)}
                  aria-label={option.label}
                />
                <span className="text-sm text-ink">{option.label}</span>
              </label>
            )
          })}
        </div>
      )
    }

    if (kind === 'enum' && rule.operator === 'eq') {
      return (
        <select
          className={selectClassName}
          value={rule.value}
          onChange={(event) => handleValueChange(rule.id, event.target.value)}
          aria-label="مقدار فیلتر"
        >
          <option value="">انتخاب کنید</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      )
    }

    if (kind === 'number') {
      return (
        <div className="flex flex-wrap gap-2">
          <Input
            type="number"
            inputMode="decimal"
            placeholder="مقدار"
            value={rule.value}
            onChange={(event) => handleValueChange(rule.id, event.target.value)}
            aria-label="مقدار عددی"
            className="min-w-[7rem] flex-1"
          />
          {needsSecondValue(rule.operator) && (
            <Input
              type="number"
              inputMode="decimal"
              placeholder="تا"
              value={rule.valueTo}
              onChange={(event) => handleValueToChange(rule.id, event.target.value)}
              aria-label="مقدار دوم"
              className="min-w-[7rem] flex-1"
            />
          )}
        </div>
      )
    }

    if (kind === 'date') {
      return (
        <div className="flex flex-wrap gap-2">
          <Input
            type="date"
            value={rule.value}
            onChange={(event) => handleValueChange(rule.id, event.target.value)}
            aria-label="تاریخ"
            className="min-w-[10rem] flex-1"
          />
          {needsSecondValue(rule.operator) && (
            <Input
              type="date"
              value={rule.valueTo}
              onChange={(event) => handleValueToChange(rule.id, event.target.value)}
              aria-label="تاریخ دوم"
              className="min-w-[10rem] flex-1"
            />
          )}
        </div>
      )
    }

    return (
      <Input
        type="text"
        placeholder="متن"
        value={rule.value}
        onChange={(event) => handleValueChange(rule.id, event.target.value)}
        aria-label="مقدار متنی"
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>فیلتر معاملات</DialogTitle>
          <DialogDescription>
            یک یا چند شرط روی فیلدهای فعال استراتژی اعمال کنید. همه شرط‌ها با هم (و) اعمال می‌شوند.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[min(60vh,28rem)] flex-col gap-3 overflow-y-auto">
          {fields.length === 0 ? (
            <p className="rounded-2xl bg-track/40 px-4 py-3 text-sm text-muted">
              فیلد فعالی برای فیلتر وجود ندارد.
            </p>
          ) : draft.length === 0 ? (
            <p className="rounded-2xl bg-track/40 px-4 py-3 text-sm text-muted">
              هنوز شرطی اضافه نشده است. با «افزودن شرط» شروع کنید.
            </p>
          ) : (
            draft.map((rule, index) => {
              const field = fieldsByKey.get(rule.fieldKey) ?? fields[0]
              const kind = getFilterKind(field)
              const operators = getOperatorsForKind(kind)

              return (
                <div
                  key={rule.id}
                  className="space-y-2 rounded-2xl border border-line bg-track/20 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">شرط {index + 1}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      aria-label="حذف شرط"
                      onClick={() => handleRemoveRule(rule.id)}
                      className="size-8 p-0 text-muted hover:text-ink"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-2">
                    <select
                      className={selectClassName}
                      value={field.key}
                      onChange={(event) => handleFieldChange(rule.id, event.target.value)}
                      aria-label="فیلد"
                    >
                      {fields.map((item) => (
                        <option key={item.key} value={item.key}>
                          {item.label}
                        </option>
                      ))}
                    </select>

                    <select
                      className={selectClassName}
                      value={rule.operator}
                      onChange={(event) =>
                        handleOperatorChange(rule.id, event.target.value as FilterOperator)
                      }
                      aria-label="عملگر"
                    >
                      {operators.map((op) => (
                        <option key={op.id} value={op.id}>
                          {op.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {renderValueControls(rule, field)}
                </div>
              )
            })
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={handleAddRule}
            disabled={fields.length === 0}
            className={cn('gap-1.5')}
          >
            <Plus className="size-4" aria-hidden />
            افزودن شرط
          </Button>
          {draft.length > 0 && (
            <Button type="button" variant="ghost" onClick={handleClearAll}>
              پاک کردن همه
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button type="button" onClick={handleApply}>
            اعمال فیلتر
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
