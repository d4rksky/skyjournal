import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, FolderOpen, ImagePlus } from 'lucide-react'
import type { Account, FieldDefinition, Strategy, SymbolItem } from '@/lib/types'
import {
  resultLabelFa,
  sideLabelFa,
  type PhotoImportFolderPreview,
  type PhotoImportResult
} from '@/lib/photoImport'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FieldControl } from '@/components/fields/FieldControl'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export type PhotoImportPageProps = {
  accounts: Account[]
  strategies: Strategy[]
  symbols: SymbolItem[]
  initialAccountId: string | null
  onBack: () => void
  onImported: () => void
  onSymbolsChange: () => void
}

type Step = 'shared' | 'preview'

const RISK_FALLBACK_OPTIONS = [
  { id: '0.25', label: '0.25' },
  { id: '0.5', label: '0.5' },
  { id: '0.75', label: '0.75' },
  { id: '1', label: '1' },
  { id: '1.5', label: '1.5' },
  { id: '2', label: '2' },
  { id: '3', label: '3' }
]

const findBuiltinField = (
  strategy: Strategy | null,
  builtinKey: string
): FieldDefinition | undefined =>
  strategy?.fields.find((field) => field.builtinKey === builtinKey)

export const PhotoImportPage = ({
  accounts,
  strategies,
  symbols,
  initialAccountId,
  onBack,
  onImported,
  onSymbolsChange
}: PhotoImportPageProps) => {
  const [step, setStep] = useState<Step>('shared')
  const [accountId, setAccountId] = useState(initialAccountId ?? accounts[0]?.id ?? '')
  const [strategyId, setStrategyId] = useState('')
  const [symbol, setSymbol] = useState('')
  const [risk, setRisk] = useState('')
  const [riskFixed, setRiskFixed] = useState(false)

  const [rootPath, setRootPath] = useState<string | null>(null)
  const [folders, setFolders] = useState<PhotoImportFolderPreview[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [importResult, setImportResult] = useState<PhotoImportResult | null>(null)

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === accountId) ?? null,
    [accounts, accountId]
  )

  const linkedStrategies = useMemo(() => {
    if (!selectedAccount) return []
    return selectedAccount.strategyIds
      .map((id) => strategies.find((strategy) => strategy.id === id))
      .filter((strategy): strategy is Strategy => strategy !== undefined)
  }, [selectedAccount, strategies])

  const selectedStrategy = useMemo(
    () => linkedStrategies.find((strategy) => strategy.id === strategyId) ?? null,
    [linkedStrategies, strategyId]
  )

  const symbolField = useMemo(() => {
    const fromStrategy = findBuiltinField(selectedStrategy, 'symbol')
    if (fromStrategy) return fromStrategy
    return {
      id: 'shared-symbol',
      key: 'symbol',
      label: 'نماد',
      type: 'combobox' as const,
      options: [],
      enabled: true,
      builtin: true,
      builtinKey: 'symbol' as const
    }
  }, [selectedStrategy])

  const riskField = useMemo(() => {
    const fromStrategy = findBuiltinField(selectedStrategy, 'risk')
    if (fromStrategy) return fromStrategy
    return {
      id: 'shared-risk',
      key: 'risk',
      label: 'ریسک',
      type: 'segmented' as const,
      options: RISK_FALLBACK_OPTIONS,
      enabled: true,
      builtin: true,
      builtinKey: 'risk' as const
    }
  }, [selectedStrategy])

  useEffect(() => {
    if (!selectedAccount) {
      setStrategyId('')
      setRiskFixed(false)
      return
    }
    setRiskFixed(selectedAccount.fixedRisk)
  }, [selectedAccount])

  useEffect(() => {
    if (linkedStrategies.length === 0) {
      setStrategyId('')
      return
    }
    setStrategyId((current) =>
      linkedStrategies.some((strategy) => strategy.id === current)
        ? current
        : linkedStrategies[0].id
    )
  }, [linkedStrategies])

  useEffect(() => {
    if (selectedAccount?.fixedRisk && selectedAccount.fixedRiskValue) {
      setRisk(selectedAccount.fixedRiskValue)
      return
    }
    if (!selectedStrategy) return
    setRisk((current) => {
      if (current) return current
      return findBuiltinField(selectedStrategy, 'risk')?.options[0]?.id ?? ''
    })
  }, [selectedAccount, selectedStrategy])

  const validFolders = useMemo(
    () => folders.filter((folder) => !folder.error),
    [folders]
  )
  const invalidFolders = useMemo(
    () => folders.filter((folder) => Boolean(folder.error)),
    [folders]
  )

  const sharedReady =
    Boolean(accountId) &&
    Boolean(strategyId) &&
    symbol.trim().length > 0 &&
    risk.trim().length > 0

  const handleCreateSymbol = async (label: string) => {
    await api.symbols.create(label)
    setSymbol(label)
    onSymbolsChange()
  }

  const handlePickFolder = async () => {
    if (!sharedReady) {
      setError('لطفاً حساب، استراتژی، نماد و ریسک مشترک را کامل کنید.')
      return
    }
    setBusy(true)
    setError(null)
    setImportResult(null)
    try {
      const path = await api.photoImport.selectDirectory()
      if (!path) return
      const scan = await api.photoImport.scanDirectory(path)
      setRootPath(scan.rootPath)
      setFolders(scan.folders)
      setStep('preview')
      if (scan.folders.length === 0) {
        setError('در این پوشه هیچ زیرپوشه‌ای یافت نشد.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'انتخاب یا خواندن پوشه ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmImport = async () => {
    if (!sharedReady || validFolders.length === 0) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.photoImport.importTrades({
        accountId,
        strategyId,
        symbol: symbol.trim(),
        risk: risk.trim(),
        riskFixed,
        folderPaths: validFolders.map((folder) => folder.folderPath)
      })
      setImportResult(result)
      setConfirmOpen(false)
      onImported()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'درون‌ریزی ناموفق بود.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-6 overflow-y-auto p-6">
      <div className="flex items-start gap-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          aria-label="بازگشت"
          className="size-10 shrink-0 p-0"
        >
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-lg font-semibold text-ink">
            <ImagePlus className="size-5 text-accent" aria-hidden />
            درون‌ریزی با عکس
          </h1>
          <p className="mt-1 text-sm text-muted">
            هر زیرپوشه یک معامله است. نام پوشه: ریوارد یا ریوارد|نوع (مثل{' '}
            <span className="font-mono text-ink" dir="ltr">
              -1|buy
            </span>
            ).
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={cn(
            'rounded-lg px-2.5 py-1',
            step === 'shared' ? 'bg-accent-soft text-ink' : 'bg-track/50 text-muted'
          )}
        >
          ۱. مقادیر مشترک
        </span>
        <span
          className={cn(
            'rounded-lg px-2.5 py-1',
            step === 'preview' ? 'bg-accent-soft text-ink' : 'bg-track/50 text-muted'
          )}
        >
          ۲. پوشه و پیش‌نمایش
        </span>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-danger/15 dark:text-danger"
        >
          {error}
        </p>
      )}

      {importResult && (
        <div
          role="status"
          className="rounded-2xl border border-line bg-card px-4 py-3 text-sm text-ink"
        >
          <p className="font-medium text-emerald-700 dark:text-emerald-400">
            {`${importResult.imported.toLocaleString('fa-IR')} معامله درون‌ریزی شد`}
            {importResult.skipped > 0
              ? ` · ${importResult.skipped.toLocaleString('fa-IR')} مورد رد شد`
              : ''}
          </p>
          {importResult.errors.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 text-muted">
              {importResult.errors.slice(0, 8).map((item) => (
                <li key={`${item.folderName}-${item.message}`}>
                  <span className="font-mono text-ink" dir="ltr">
                    {item.folderName}
                  </span>
                  {`: ${item.message}`}
                </li>
              ))}
              {importResult.errors.length > 8 && (
                <li>{`و ${importResult.errors.length - 8} خطای دیگر…`}</li>
              )}
            </ul>
          )}
        </div>
      )}

      <section className="rounded-3xl border border-line bg-card p-6">
        <h2 className="text-sm font-semibold text-ink">مقادیر مشترک</h2>
        <p className="mt-1 text-sm text-muted">
          این مقادیر روی همه معاملات درون‌ریزی‌شده اعمال می‌شوند.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted">حساب</span>
            <select
              value={accountId}
              disabled={busy}
              onChange={(event) => {
                setAccountId(event.target.value)
                setStep('shared')
                setFolders([])
                setRootPath(null)
                setImportResult(null)
              }}
              aria-label="حساب"
              className="h-11 rounded-xl border border-line bg-card px-3 text-ink"
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="text-muted">استراتژی</span>
            <select
              value={strategyId}
              disabled={busy || linkedStrategies.length === 0}
              onChange={(event) => setStrategyId(event.target.value)}
              aria-label="استراتژی"
              className="h-11 rounded-xl border border-line bg-card px-3 text-ink"
            >
              {linkedStrategies.length === 0 ? (
                <option value="">استراتژی متصل نیست</option>
              ) : (
                linkedStrategies.map((strategy) => (
                  <option key={strategy.id} value={strategy.id}>
                    {strategy.name}
                  </option>
                ))
              )}
            </select>
          </label>

          <div className="flex flex-col gap-2 text-sm">
            <span className="text-muted">{symbolField.label}</span>
            <FieldControl
              field={symbolField}
              value={symbol}
              onChange={(next) => setSymbol(typeof next === 'string' ? next : '')}
              symbols={symbols}
              onCreateSymbol={(label) => void handleCreateSymbol(label)}
            />
          </div>

          <div className="flex flex-col gap-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted">{riskField.label} مشترک</span>
              <label className="flex items-center gap-2 text-xs text-muted">
                <input
                  type="checkbox"
                  checked={riskFixed}
                  disabled={busy || Boolean(selectedAccount?.fixedRisk)}
                  onChange={(event) => setRiskFixed(event.target.checked)}
                />
                ریسک ثابت
              </label>
            </div>
            <fieldset
              disabled={busy || (Boolean(selectedAccount?.fixedRisk) && riskFixed)}
              className="disabled:opacity-60"
            >
              <FieldControl
                field={riskField}
                value={risk}
                onChange={(next) => setRisk(typeof next === 'string' ? next : '')}
              />
            </fieldset>
          </div>
        </div>

        {step === 'shared' && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !sharedReady}
              onClick={() => void handlePickFolder()}
            >
              <FolderOpen className="size-4" aria-hidden />
              انتخاب پوشه ریشه
            </Button>
          </div>
        )}
      </section>

      {step === 'preview' && (
        <section className="rounded-3xl border border-line bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-ink">پیش‌نمایش پوشه‌ها</h2>
              {rootPath && (
                <p className="mt-1 break-all font-mono text-xs text-muted" dir="ltr">
                  {rootPath}
                </p>
              )}
              <p className="mt-2 text-sm text-muted">
                {`${validFolders.length.toLocaleString('fa-IR')} پوشه معتبر`}
                {invalidFolders.length > 0
                  ? ` · ${invalidFolders.length.toLocaleString('fa-IR')} نامعتبر`
                  : ''}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => void handlePickFolder()}
              >
                تغییر پوشه
              </Button>
              <Button
                type="button"
                disabled={busy || validFolders.length === 0}
                onClick={() => setConfirmOpen(true)}
              >
                تأیید درون‌ریزی
              </Button>
            </div>
          </div>

          {folders.length === 0 ? (
            <p className="mt-4 text-sm text-muted">زیرپوشه‌ای برای نمایش نیست.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-line text-muted">
                    <th className="px-2 py-2 text-right font-medium">نام پوشه</th>
                    <th className="px-2 py-2 text-right font-medium">ریوارد</th>
                    <th className="px-2 py-2 text-right font-medium">نتیجه</th>
                    <th className="px-2 py-2 text-right font-medium">نوع</th>
                    <th className="px-2 py-2 text-right font-medium">تصاویر</th>
                    <th className="px-2 py-2 text-right font-medium">وضعیت</th>
                  </tr>
                </thead>
                <tbody>
                  {folders.map((folder) => (
                    <tr
                      key={folder.folderPath}
                      className={cn(
                        'border-b border-line/70',
                        folder.error && 'bg-red-50/60 dark:bg-danger/10'
                      )}
                    >
                      <td className="px-2 py-2 font-mono text-ink" dir="ltr">
                        {folder.folderName}
                      </td>
                      <td className="px-2 py-2 text-ink" dir="ltr">
                        {folder.reward ?? '—'}
                      </td>
                      <td className="px-2 py-2 text-ink">{resultLabelFa(folder.result)}</td>
                      <td className="px-2 py-2 text-ink">{sideLabelFa(folder.side)}</td>
                      <td className="px-2 py-2 text-ink">
                        {folder.imageCount.toLocaleString('fa-IR')}
                      </td>
                      <td className="px-2 py-2">
                        {folder.error ? (
                          <span className="text-red-600 dark:text-danger">{folder.error}</span>
                        ) : (
                          <span className="text-emerald-700 dark:text-emerald-400">آماده</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (busy) return
          setConfirmOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تأیید درون‌ریزی</DialogTitle>
            <DialogDescription>
              {`${validFolders.length.toLocaleString('fa-IR')} معامله با نماد «${symbol.trim()}» و ریسک «${risk.trim()}» روی حساب «${selectedAccount?.name ?? ''}» ساخته می‌شود. پوشه‌های نامعتبر رد می‌شوند.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setConfirmOpen(false)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={busy}
              onClick={() => void handleConfirmImport()}
            >
              {busy ? 'در حال درون‌ریزی…' : 'شروع درون‌ریزی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
