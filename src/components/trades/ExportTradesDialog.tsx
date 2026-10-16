import { useEffect, useMemo, useState } from 'react'
import type { Account, Journal, Strategy } from '@/lib/types'
import { api } from '@/lib/api'
import {
  buildCustomCsv,
  buildMetatraderCsv,
  defaultCustomColumns,
  suggestExportFilename,
  type CustomExportColumn,
  type ExportFormatId
} from '@/lib/exportTrades'
import { collectEnabledFields } from '@/lib/strategyFields'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export type ExportTradesDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account
  strategies: Strategy[]
  journals: Journal[]
}

export const ExportTradesDialog = ({
  open,
  onOpenChange,
  account,
  strategies,
  journals
}: ExportTradesDialogProps) => {
  const [format, setFormat] = useState<ExportFormatId>('metatrader')
  const [columns, setColumns] = useState<CustomExportColumn[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const availableColumns = useMemo(
    () => defaultCustomColumns(collectEnabledFields(account, strategies)),
    [account, strategies]
  )

  useEffect(() => {
    if (!open) return
    setError(null)
    setFormat('metatrader')
    setColumns(availableColumns)
    setSelectedIds(availableColumns.map((column) => column.id))
  }, [open, availableColumns])

  const journalsOldestFirst = useMemo(
    () =>
      [...journals].sort((a, b) => {
        const byTime = a.createdAt.localeCompare(b.createdAt)
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id)
      }),
    [journals]
  )

  const handleToggleColumn = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev
        return prev.filter((item) => item !== id)
      }
      return [...prev, id]
    })
  }

  const handleExport = async () => {
    setSaving(true)
    setError(null)
    try {
      let content: string
      if (format === 'metatrader') {
        content = buildMetatraderCsv(
          journalsOldestFirst,
          strategies,
          account.initialBalance
        )
      } else {
        const chosen = columns.filter((column) => selectedIds.includes(column.id))
        if (chosen.length === 0) {
          setError('حداقل یک ستون را انتخاب کنید.')
          setSaving(false)
          return
        }
        content = buildCustomCsv(
          journalsOldestFirst,
          strategies,
          account.initialBalance,
          chosen
        )
      }

      const path = await api.export.saveTextFile(
        suggestExportFilename(account.name, format),
        content
      )
      if (path) onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خروجی‌گیری ناموفق بود.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>خروجی معاملات</DialogTitle>
          <DialogDescription>
            فرمت MetaTrader (CSV تاریخچه معاملات MT4) یا قالب سفارشی SkyJournal را انتخاب کنید.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1 rounded-2xl bg-track p-1">
            <button
              type="button"
              onClick={() => setFormat('metatrader')}
              className={cn(
                'flex-1 rounded-xl px-3 py-2 text-sm transition-colors',
                format === 'metatrader' ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              MetaTrader CSV
            </button>
            <button
              type="button"
              onClick={() => setFormat('custom')}
              className={cn(
                'flex-1 rounded-xl px-3 py-2 text-sm transition-colors',
                format === 'custom' ? 'bg-card text-ink shadow-sm' : 'text-muted hover:text-ink'
              )}
            >
              قالب سفارشی
            </button>
          </div>

          {format === 'metatrader' ? (
            <p className="text-sm leading-relaxed text-muted">
              خروجی با ستون‌های استاندارد تاریخچه معاملات MetaTrader 4 (Ticket، Open/Close Time،
              Type، Size، Item، Price، S/L، T/P، Commission، Taxes، Swap، Profit). فیلدهایی که در
              ژورنال نیست خالی/صفر می‌مانند؛ Profit از ریسک و ریوارد محاسبه می‌شود.
            </p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-2xl border border-line p-3">
              {columns.map((column) => {
                const checked = selectedIds.includes(column.id)
                return (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-track/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={() => handleToggleColumn(column.id)}
                      aria-label={column.label}
                    />
                    <span className="text-sm text-ink">{column.label}</span>
                  </label>
                )
              })}
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button
            type="button"
            disabled={saving || journals.length === 0}
            onClick={() => void handleExport()}
          >
            {saving ? 'در حال ذخیره…' : 'دانلود CSV'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
