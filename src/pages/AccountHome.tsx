import { useCallback, useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { Account, Journal, Strategy } from '@/lib/types'
import { api } from '@/lib/api'
import { getTargetBalance, hasReachedTarget } from '@/lib/accountTarget'
import { Button } from '@/components/ui/button'
import { TradesTable } from '@/components/trades/TradesTable'

export type AccountHomeProps = {
  account: Account
  strategies: Strategy[]
  onOpenJournal: (strategyId: string) => void
  onEditJournal: (journal: Journal) => void
  onOpenReport: () => void
  onOpenPhotoImport: () => void
  onAccountMutated: () => void
}

const formatBalance = (value: number): string =>
  value.toLocaleString('fa-IR', { maximumFractionDigits: 2 })

const persianTarget = (percent: number): string => {
  const digits = '۰۱۲۳۴۵۶۷۸۹'
  const text = String(percent)
    .split('')
    .map((char) => (char >= '0' && char <= '9' ? digits[Number(char)] : char))
    .join('')
  return `تارگت ${text}٪`
}

export const AccountHome = ({
  account,
  strategies,
  onOpenJournal,
  onEditJournal,
  onOpenReport,
  onOpenPhotoImport,
  onAccountMutated
}: AccountHomeProps) => {
  const [journals, setJournals] = useState<Journal[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [targetNoticeDismissed, setTargetNoticeDismissed] = useState(false)

  const targetReached = hasReachedTarget(account)
  const targetBalance = getTargetBalance(account)

  useEffect(() => {
    setTargetNoticeDismissed(false)
  }, [account.id])

  useEffect(() => {
    if (!targetReached) setTargetNoticeDismissed(false)
  }, [targetReached])

  const linkedStrategies = useMemo(
    () =>
      account.strategyIds
        .map((id) => strategies.find((strategy) => strategy.id === id))
        .filter((strategy): strategy is Strategy => strategy !== undefined),
    [account.strategyIds, strategies]
  )

  const loadJournals = useCallback(async () => {
    setLoadError(null)
    try {
      const rows = await api.journals.list(account.id)
      setJournals(rows)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'بارگذاری ژورنال ناموفق بود.')
    }
  }, [account.id])

  useEffect(() => {
    void loadJournals()
  }, [loadJournals])

  const handleDeleteJournal = async (id: string) => {
    try {
      await api.journals.delete(id)
      await loadJournals()
      onAccountMutated()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'حذف ناموفق بود.')
    }
  }

  const balanceDelta = account.currentBalance - account.initialBalance

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
      <div className="rounded-3xl border border-line bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-ink">{account.name}</h1>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={onOpenPhotoImport}>
              درون‌ریزی با عکس
            </Button>
            <Button type="button" variant="secondary" onClick={onOpenReport}>
              گزارش حساب
            </Button>
          </div>
        </div>
        <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
          <div>
            <dt className="text-muted">بالانس اولیه</dt>
            <dd className="font-medium text-ink">{formatBalance(account.initialBalance)}</dd>
          </div>
          <div>
            <dt className="text-muted">بالانس فعلی</dt>
            <dd className="font-medium text-ink">{formatBalance(account.currentBalance)}</dd>
          </div>
          <div>
            <dt className="text-muted">تغییر کل</dt>
            <dd
              className={
                balanceDelta > 0
                  ? 'font-medium text-success'
                  : balanceDelta < 0
                    ? 'font-medium text-danger'
                    : 'font-medium text-ink'
              }
            >
              {`${balanceDelta > 0 ? '+' : ''}${formatBalance(balanceDelta)}`}
            </dd>
          </div>
          {account.targetPercent !== null && (
            <div>
              <dt className="text-muted">تارگت</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium text-ink">
                <span>{persianTarget(account.targetPercent)}</span>
                {targetReached && (
                  <span className="inline-flex rounded-lg bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                    رسیده
                  </span>
                )}
              </dd>
            </div>
          )}
        </dl>
        {linkedStrategies.length > 0 && (
          <div className="mt-6 flex flex-wrap gap-2">
            {linkedStrategies.map((strategy) => (
              <Button
                key={strategy.id}
                type="button"
                variant="secondary"
                onClick={() => onOpenJournal(strategy.id)}
              >
                {`ثبت ${strategy.name}`}
              </Button>
            ))}
          </div>
        )}
      </div>

      {targetReached && !targetNoticeDismissed && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm text-ink"
        >
          <div className="min-w-0 flex-1">
            <p className="font-medium text-success">به تارگت رسیدی</p>
            <p className="mt-1 text-muted">
              {`بالانس فعلی (${formatBalance(account.currentBalance)}) به ${persianTarget(account.targetPercent!)}${
                targetBalance !== null ? ` — معادل ${formatBalance(targetBalance)}` : ''
              } رسید یا از آن عبور کرد.`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            aria-label="بستن اعلان تارگت"
            onClick={() => setTargetNoticeDismissed(true)}
            className="size-8 shrink-0 p-0 text-muted hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </Button>
        </div>
      )}

      {loadError && (
        <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-danger/15 dark:text-danger">
          {loadError}
        </p>
      )}

      <TradesTable
        account={account}
        strategies={strategies}
        journals={journals}
        onDelete={(id) => void handleDeleteJournal(id)}
        onEdit={onEditJournal}
      />
    </div>
  )
}
