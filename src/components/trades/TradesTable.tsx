import { useEffect, useMemo, useState } from 'react'
import { Eye, Filter, Pencil, Trash2 } from 'lucide-react'
import type { Account, FieldDefinition, Journal, Strategy } from '@/lib/types'
import { collectEnabledFields } from '@/lib/strategyFields'
import {
  applyTradeFilters,
  countActiveFilters,
  type TradeFilterRule
} from '@/lib/tradeFilters'
import {
  computeRiskImpactPercent,
  getBuiltinString
} from '@/lib/tradeMath'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { ImageGalleryModal } from '@/components/journal/ImageGalleryModal'
import { ExportTradesDialog } from '@/components/trades/ExportTradesDialog'
import { TradeFiltersDialog } from '@/components/trades/TradeFiltersDialog'

export type TradesTableProps = {
  account: Account
  strategies: Strategy[]
  journals: Journal[]
  onDelete: (id: string) => void
  onEdit: (journal: Journal) => void
}

const formatDateTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const formatNumberFa = (value: number, digits = 2): string =>
  value.toLocaleString('fa-IR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0
  })

const ResultBadge = ({ resultId, label }: { resultId: string; label: string }) => {
  const tone =
    resultId === 'profit'
      ? 'bg-success text-white'
      : resultId === 'loss'
        ? 'bg-danger text-white'
        : resultId === 'risk_free'
          ? 'bg-warning text-white'
          : 'bg-track text-ink'

  return (
    <span className={cn('inline-flex rounded-lg px-2.5 py-1 text-xs font-medium', tone)}>
      {label}
    </span>
  )
}

const RiskBadge = ({ impactPercent }: { impactPercent: number }) => {
  const tone =
    impactPercent > 0
      ? 'bg-success/15 text-success'
      : impactPercent < 0
        ? 'bg-danger/15 text-danger'
        : 'bg-track text-muted'

  const prefix = impactPercent > 0 ? '+' : ''
  return (
    <span className={cn('inline-flex rounded-lg px-2.5 py-1 text-xs font-medium', tone)}>
      {`${prefix}${formatNumberFa(impactPercent)}٪`}
    </span>
  )
}

const formatDateOnly = (value: string): string => {
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const formatCellValue = (field: FieldDefinition, raw: string | string[] | undefined): string => {
  if (raw === undefined || raw === null || raw === '') return '—'
  if (Array.isArray(raw)) {
    if (raw.length === 0) return '—'
    const labels = raw.map((id) => field.options.find((option) => option.id === id)?.label ?? id)
    return labels.join('، ')
  }
  if (field.type === 'date') {
    return formatDateOnly(raw)
  }
  if (field.type === 'combobox') {
    return raw || '—'
  }
  const label = field.options.find((option) => option.id === raw)?.label ?? raw
  if (field.builtinKey === 'risk' && label !== '—') {
    return `${label}%`
  }
  return label || '—'
}

const getLinkedStrategies = (account: Account, strategies: Strategy[]): Strategy[] =>
  account.strategyIds
    .map((id) => strategies.find((strategy) => strategy.id === id))
    .filter((strategy): strategy is Strategy => strategy !== undefined)

const intersectionBuiltinFields = (linked: Strategy[]): FieldDefinition[] => {
  if (linked.length === 0) return []
  const first = linked[0]
  const candidates = first.fields.filter(
    (field) => field.enabled && field.builtin && field.builtinKey
  )
  return candidates.filter((field) =>
    linked.every((strategy) =>
      strategy.fields.some(
        (other) =>
          other.enabled &&
          other.builtin &&
          other.builtinKey === field.builtinKey
      )
    )
  )
}

type TableMode = 'shared' | string

export const TradesTable = ({
  account,
  strategies,
  journals,
  onDelete,
  onEdit
}: TradesTableProps) => {
  const linked = useMemo(() => getLinkedStrategies(account, strategies), [account, strategies])
  const [tableMode, setTableMode] = useState<TableMode>('shared')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [exportOpen, setExportOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterRules, setFilterRules] = useState<TradeFilterRule[]>([])
  const [galleryJournalId, setGalleryJournalId] = useState<string | null>(null)
  const [galleryActiveId, setGalleryActiveId] = useState<string | null>(null)

  const filterableFields = useMemo(
    () => collectEnabledFields(account, strategies),
    [account, strategies]
  )

  const filterFieldsByKey = useMemo(() => {
    const map = new Map<string, FieldDefinition>()
    for (const field of filterableFields) map.set(field.key, field)
    return map
  }, [filterableFields])

  const activeFilterCount = useMemo(
    () => countActiveFilters(filterRules, filterFieldsByKey),
    [filterRules, filterFieldsByKey]
  )

  useEffect(() => {
    setFilterRules([])
  }, [account.id])

  const strategyById = useMemo(() => {
    const map = new Map<string, Strategy>()
    for (const strategy of strategies) {
      map.set(strategy.id, strategy)
    }
    return map
  }, [strategies])

  const activeStrategy =
    tableMode !== 'shared' ? linked.find((strategy) => strategy.id === tableMode) : undefined

  const columns = useMemo((): FieldDefinition[] => {
    if (linked.length === 0) return []
    if (linked.length === 1) {
      return linked[0].fields.filter((field) => field.enabled)
    }
    if (tableMode === 'shared') {
      return intersectionBuiltinFields(linked)
    }
    if (activeStrategy) {
      return activeStrategy.fields.filter((field) => field.enabled)
    }
    return intersectionBuiltinFields(linked)
  }, [linked, tableMode, activeStrategy])

  const visibleJournals = useMemo(() => {
    const linkedIds = new Set(linked.map((strategy) => strategy.id))
    let rows = journals.filter((journal) => linkedIds.has(journal.strategyId))
    if (linked.length > 1 && tableMode !== 'shared' && activeStrategy) {
      rows = rows.filter((journal) => journal.strategyId === activeStrategy.id)
    }
    return applyTradeFilters(rows, filterRules, filterableFields)
  }, [journals, linked, tableMode, activeStrategy, filterRules, filterableFields])

  const showStrategyColumn = linked.length > 1 && tableMode === 'shared'

  const galleryJournal = galleryJournalId
    ? journals.find((journal) => journal.id === galleryJournalId) ?? null
    : null

  const handleConfirmDelete = () => {
    if (!pendingDeleteId) return
    onDelete(pendingDeleteId)
    setPendingDeleteId(null)
  }

  const handleOpenGallery = (journal: Journal) => {
    if (journal.images.length === 0) return
    setGalleryJournalId(journal.id)
    setGalleryActiveId(journal.images[0].id)
  }

  const renderCell = (journal: Journal, field: FieldDefinition) => {
    const strategy = strategyById.get(journal.strategyId)
    const raw = journal.values[field.key]

    if (field.builtinKey === 'result') {
      const resultId = typeof raw === 'string' ? raw : ''
      const label = formatCellValue(field, raw)
      if (label === '—') return '—'
      return <ResultBadge resultId={resultId} label={label} />
    }

    if (field.builtinKey === 'risk') {
      const impact = computeRiskImpactPercent(journal, strategy)
      const hasRisk = getBuiltinString(journal, strategy, 'risk') !== ''
      if (!hasRisk && impact === 0) return '—'
      return <RiskBadge impactPercent={impact} />
    }

    return formatCellValue(field, raw)
  }

  if (linked.length === 0) {
    return null
  }

  return (
    <>
      <div className="rounded-3xl border border-line bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          {linked.length > 1 ? (
            <div className="min-w-0 flex-1">
              <p className="mb-2 text-sm font-medium text-ink">جدول اختصاصی استراتژی</p>
              <div className="flex flex-wrap gap-1 rounded-2xl bg-track p-1">
                <button
                  type="button"
                  onClick={() => setTableMode('shared')}
                  className={cn(
                    'rounded-xl px-3 py-2 text-sm transition-colors',
                    tableMode === 'shared'
                      ? 'bg-card text-ink shadow-sm'
                      : 'text-muted hover:text-ink'
                  )}
                >
                  مشترک
                </button>
                {linked.map((strategy) => (
                  <button
                    key={strategy.id}
                    type="button"
                    onClick={() => setTableMode(strategy.id)}
                    className={cn(
                      'rounded-xl px-3 py-2 text-sm transition-colors',
                      tableMode === strategy.id
                        ? 'bg-card text-ink shadow-sm'
                        : 'text-muted hover:text-ink'
                    )}
                  >
                    {strategy.name}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium text-ink">معاملات</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFiltersOpen(true)}
              disabled={journals.length === 0 && activeFilterCount === 0}
              aria-label={
                activeFilterCount > 0
                  ? `فیلتر معاملات، ${activeFilterCount} فیلتر فعال`
                  : 'فیلتر معاملات'
              }
              className="gap-1.5"
            >
              <Filter className="size-4" aria-hidden />
              فیلتر
              {activeFilterCount > 0 && (
                <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-white">
                  {activeFilterCount.toLocaleString('fa-IR')}
                </span>
              )}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExportOpen(true)}
              disabled={journals.length === 0}
            >
              خروجی
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line bg-track/40 text-right">
                {columns.map((field) => (
                  <th
                    key={field.id}
                    className="sticky top-0 z-10 whitespace-nowrap bg-track/95 px-4 py-3 font-medium text-ink backdrop-blur-sm"
                  >
                    {field.label}
                  </th>
                ))}
                {showStrategyColumn && (
                  <th className="sticky top-0 z-10 whitespace-nowrap bg-track/95 px-4 py-3 font-medium text-ink backdrop-blur-sm">
                    استراتژی
                  </th>
                )}
                <th className="sticky top-0 z-10 whitespace-nowrap bg-track/95 px-4 py-3 font-medium text-ink backdrop-blur-sm">
                  تاریخ
                </th>
                <th
                  className="sticky top-0 z-10 w-28 bg-track/95 px-2 py-3 backdrop-blur-sm"
                  aria-label="عملیات"
                />
              </tr>
            </thead>
            <tbody>
              {visibleJournals.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (showStrategyColumn ? 1 : 0) + 2}
                    className="px-4 py-10 text-center text-muted"
                  >
                    {activeFilterCount > 0
                      ? 'هیچ معامله‌ای با این فیلترها پیدا نشد.'
                      : 'هنوز معامله‌ای ثبت نشده است.'}
                  </td>
                </tr>
              ) : (
                visibleJournals.map((journal) => {
                  return (
                    <tr key={journal.id} className="border-b border-line/80 hover:bg-track/20">
                      {columns.map((field) => (
                        <td key={field.id} className="whitespace-nowrap px-4 py-3 text-ink">
                          {renderCell(journal, field)}
                        </td>
                      ))}
                      {showStrategyColumn && (
                        <td className="whitespace-nowrap px-4 py-3 text-ink">
                          {strategyById.get(journal.strategyId)?.name ?? '—'}
                        </td>
                      )}
                      <td className="whitespace-nowrap px-4 py-3 text-muted">
                        {formatDateTime(journal.createdAt)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label="مشاهده تصاویر"
                            disabled={journal.images.length === 0}
                            onClick={() => handleOpenGallery(journal)}
                            className="size-9 p-0 text-muted hover:text-ink disabled:opacity-30"
                          >
                            <Eye className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label="ویرایش معامله"
                            onClick={() => onEdit(journal)}
                            className="size-9 p-0 text-muted hover:text-ink"
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            aria-label="حذف معامله"
                            onClick={() => setPendingDeleteId(journal.id)}
                            className="size-9 p-0 text-muted hover:text-ink"
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={pendingDeleteId !== null} onOpenChange={(open) => !open && setPendingDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>حذف معامله</DialogTitle>
            <DialogDescription>این ردیف از ژورنال حذف شود؟</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setPendingDeleteId(null)}>
              انصراف
            </Button>
            <Button type="button" onClick={handleConfirmDelete}>
              حذف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TradeFiltersDialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        account={account}
        strategies={strategies}
        rules={filterRules}
        onApply={setFilterRules}
      />

      <ExportTradesDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        account={account}
        strategies={strategies}
        journals={visibleJournals}
      />

      <ImageGalleryModal
        open={galleryJournal !== null}
        images={galleryJournal?.images.map((image) => ({
          id: image.id,
          dataUrl: image.dataUrl
        })) ?? []}
        activeId={galleryActiveId}
        onActiveIdChange={setGalleryActiveId}
        onOpenChange={(open) => {
          if (!open) {
            setGalleryJournalId(null)
            setGalleryActiveId(null)
          }
        }}
      />
    </>
  )
}
