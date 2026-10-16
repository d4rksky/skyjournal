import { useEffect, useState } from 'react'
import type { Account, Strategy } from '@/lib/types'
import { TARGET_PERCENTS } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
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

const persianPercentLabel = (value: number): string => {
  const digits = '۰۱۲۳۴۵۶۷۸۹'
  const text = String(value)
    .split('')
    .map((char) => (char >= '0' && char <= '9' ? digits[Number(char)] : char))
    .join('')
  return `${text}٪`
}

export type AccountModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  strategies: Strategy[]
  onSaved: () => void
}

export const AccountModal = ({
  open,
  onOpenChange,
  account,
  strategies,
  onSaved
}: AccountModalProps) => {
  const isEdit = account !== null
  const [name, setName] = useState('')
  const [initialBalance, setInitialBalance] = useState('')
  const [targetPercent, setTargetPercent] = useState<string>('none')
  const [strategyIds, setStrategyIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (account) {
      setName(account.name)
      setInitialBalance(String(account.initialBalance))
      setTargetPercent(account.targetPercent === null ? 'none' : String(account.targetPercent))
      setStrategyIds([...account.strategyIds])
      return
    }
    setName('')
    setInitialBalance('')
    setTargetPercent('none')
    setStrategyIds(strategies.length > 0 ? [strategies[0].id] : [])
  }, [open, account, strategies])

  const handleToggleStrategy = (strategyId: string) => {
    setStrategyIds((prev) => {
      if (prev.includes(strategyId)) {
        if (prev.length <= 1) return prev
        return prev.filter((id) => id !== strategyId)
      }
      return [...prev, strategyId]
    })
  }

  const handleSave = async () => {
    const trimmed = name.trim()
    if (!trimmed || strategyIds.length === 0) return
    const balance = Number(initialBalance)
    if (!Number.isFinite(balance) || balance < 0) {
      setError('بالانس اولیه نامعتبر است.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        name: trimmed,
        initialBalance: balance,
        targetPercent: targetPercent === 'none' ? null : Number(targetPercent),
        strategyIds
      }
      if (isEdit && account) {
        await api.accounts.update(account.id, payload)
      } else {
        await api.accounts.create(payload)
      }
      onSaved()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در ذخیره حساب')
    } finally {
      setSaving(false)
    }
  }

  const canSave = name.trim().length > 0 && strategyIds.length > 0 && !saving

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'ویرایش حساب' : 'ثبت حساب'}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="account-name">
              نام حساب
            </label>
            <Input
              id="account-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-xl border-line bg-card"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="account-balance">
              بالانس اولیه
            </label>
            <Input
              id="account-balance"
              type="number"
              min={0}
              step="any"
              value={initialBalance}
              onChange={(event) => setInitialBalance(event.target.value)}
              className="h-11 rounded-xl border-line bg-card"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink" htmlFor="account-target">
              تارگت
            </label>
            <select
              id="account-target"
              value={targetPercent}
              onChange={(event) => setTargetPercent(event.target.value)}
              className="h-11 w-full rounded-xl border border-line bg-card px-3 text-sm text-ink"
            >
              <option value="none">بدون تارگت</option>
              {TARGET_PERCENTS.map((percent) => (
                <option key={percent} value={String(percent)}>
                  {persianPercentLabel(percent)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-ink">استراتژی‌ها</p>
            {strategies.length === 0 ? (
              <p className="text-sm text-muted">ابتدا یک استراتژی بسازید.</p>
            ) : (
              <ul className="flex flex-col gap-2 rounded-2xl border border-line p-3">
                {strategies.map((strategy) => {
                  const checked = strategyIds.includes(strategy.id)
                  return (
                    <li key={strategy.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1.5 text-sm text-ink',
                          'hover:bg-track/40'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => handleToggleStrategy(strategy.id)}
                          aria-label={strategy.name}
                        />
                        <span>{strategy.name}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-1 text-xs text-muted">حداقل یک استراتژی باید انتخاب شود.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            انصراف
          </Button>
          <Button type="button" disabled={!canSave} onClick={() => void handleSave()}>
            {saving ? 'در حال ذخیره…' : 'ذخیره'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
