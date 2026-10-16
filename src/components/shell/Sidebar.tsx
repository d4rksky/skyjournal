import { useEffect, useId, useRef, useState } from 'react'
import {
  ArchiveRestore,
  ChevronDown,
  Download,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
  Upload
} from 'lucide-react'
import type { Account, Strategy } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/shell/ThemeToggle'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

export type SidebarProps = {
  strategies: Strategy[]
  accounts: Account[]
  selectedAccountId: string | null
  onSelectAccount: (accountId: string) => void
  onCreateStrategy: () => void
  onEditStrategy: (strategy: Strategy) => void
  onCreateAccount: () => void
  onEditAccount: (account: Account) => void
  onOpenPhotoImport: () => void
  onRefresh: () => void
}

type PendingDelete =
  | { kind: 'strategy'; item: Strategy }
  | { kind: 'account'; item: Account }
  | null

type BackupFeedback =
  | { tone: 'info' | 'success' | 'error'; message: string }
  | null

export const Sidebar = ({
  strategies,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onCreateStrategy,
  onEditStrategy,
  onCreateAccount,
  onEditAccount,
  onOpenPhotoImport,
  onRefresh
}: SidebarProps) => {
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [importOpen, setImportOpen] = useState(false)
  const [backupBusy, setBackupBusy] = useState(false)
  const [backupFeedback, setBackupFeedback] = useState<BackupFeedback>(null)
  const [backupMenuOpen, setBackupMenuOpen] = useState(false)
  const backupMenuRef = useRef<HTMLDivElement>(null)
  const backupMenuId = useId()

  useEffect(() => {
    if (!backupMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null
      if (target && backupMenuRef.current?.contains(target)) return
      setBackupMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setBackupMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [backupMenuOpen])

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    setDeleteError(null)
    try {
      if (pendingDelete.kind === 'strategy') {
        await api.strategies.delete(pendingDelete.item.id)
      } else {
        await api.accounts.delete(pendingDelete.item.id)
      }
      setPendingDelete(null)
      onRefresh()
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'حذف انجام نشد.')
    } finally {
      setDeleting(false)
    }
  }

  const handleExportBackup = async () => {
    setBackupMenuOpen(false)
    setBackupBusy(true)
    setBackupFeedback({ tone: 'info', message: 'در حال آماده‌سازی پشتیبان…' })
    try {
      const path = await api.backup.export()
      if (!path) {
        setBackupFeedback({ tone: 'info', message: 'برون‌ریزی لغو شد.' })
        return
      }
      setBackupFeedback({
        tone: 'success',
        message: `پشتیبان با موفقیت ذخیره شد:\n${path}`
      })
    } catch (error) {
      setBackupFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'برون‌ریزی انجام نشد.'
      })
    } finally {
      setBackupBusy(false)
    }
  }

  const handleOpenImport = () => {
    setBackupMenuOpen(false)
    setImportOpen(true)
  }

  const handleOpenPhotoImport = () => {
    setBackupMenuOpen(false)
    onOpenPhotoImport()
  }

  const handleConfirmImport = async () => {
    setBackupBusy(true)
    setBackupFeedback({
      tone: 'info',
      message: 'در حال ادغام پشتیبان با داده‌های فعلی…'
    })
    try {
      const result = await api.backup.import('merge')
      if (!result) {
        setBackupFeedback({ tone: 'info', message: 'درون‌ریزی لغو شد.' })
        return
      }
      setImportOpen(false)
      onRefresh()
      const { counts } = result
      setBackupFeedback({
        tone: 'success',
        message: `درون‌ریزی (ادغام) انجام شد: ${counts.strategies} استراتژی، ${counts.accounts} حساب، ${counts.journals} معامله، ${counts.images} تصویر، ${counts.symbols} نماد.`
      })
    } catch (error) {
      setBackupFeedback({
        tone: 'error',
        message: error instanceof Error ? error.message : 'درون‌ریزی انجام نشد.'
      })
    } finally {
      setBackupBusy(false)
    }
  }

  const deleteTitle =
    pendingDelete?.kind === 'strategy'
      ? 'حذف استراتژی'
      : pendingDelete?.kind === 'account'
        ? 'حذف حساب'
        : ''

  const deleteDescription =
    pendingDelete?.kind === 'strategy'
      ? `«${pendingDelete.item.name}» حذف شود؟`
      : pendingDelete?.kind === 'account'
        ? `«${pendingDelete.item.name}» حذف شود؟`
        : ''

  return (
    <>
      <aside className="flex h-full w-[280px] shrink-0 flex-col gap-6 overflow-y-auto border-l border-line bg-card p-4">
        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">استراتژی‌ها</h2>
            <Button
              type="button"
              variant="ghost"
              aria-label="ثبت استراتژی"
              onClick={onCreateStrategy}
              className="size-9 p-0"
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
          {strategies.length === 0 ? (
            <p className="text-sm text-muted">استراتژی‌ای ثبت نشده است.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {strategies.map((strategy) => (
                <li
                  key={strategy.id}
                  className="flex items-center gap-1 rounded-xl px-2 py-1.5 hover:bg-track/40"
                >
                  <span className="min-w-0 flex-1 truncate text-sm text-ink">{strategy.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`ویرایش ${strategy.name}`}
                    onClick={() => onEditStrategy(strategy)}
                    className="size-8 shrink-0 p-0"
                  >
                    <Pencil className="size-3.5" aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label={`حذف ${strategy.name}`}
                    onClick={() => {
                      setDeleteError(null)
                      setPendingDelete({ kind: 'strategy', item: strategy })
                    }}
                    className="size-8 shrink-0 p-0 text-muted hover:text-ink"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink">حساب‌ها</h2>
            <Button
              type="button"
              variant="ghost"
              aria-label="ثبت حساب"
              title={strategies.length === 0 ? 'اول یک استراتژی بسازید' : undefined}
              disabled={strategies.length === 0}
              onClick={onCreateAccount}
              className="size-9 p-0"
            >
              <Plus className="size-4" aria-hidden />
            </Button>
          </div>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted">حسابی ثبت نشده است.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {accounts.map((account) => {
                const selected = account.id === selectedAccountId
                return (
                  <li key={account.id}>
                    <div
                      className={cn(
                        'flex items-center gap-1 rounded-xl px-2 py-1.5',
                        selected ? 'bg-accent-soft' : 'hover:bg-track/40'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectAccount(account.id)}
                        className="min-w-0 flex-1 truncate text-right text-sm text-ink"
                      >
                        {account.name}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`ویرایش ${account.name}`}
                        onClick={() => onEditAccount(account)}
                        className="size-8 shrink-0 p-0"
                      >
                        <Pencil className="size-3.5" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        aria-label={`حذف ${account.name}`}
                        onClick={() => {
                          setDeleteError(null)
                          setPendingDelete({ kind: 'account', item: account })
                        }}
                        className="size-8 shrink-0 p-0 text-muted hover:text-ink"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </Button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2">
            <ArchiveRestore className="size-4 shrink-0 text-accent" aria-hidden />
            <h2 className="text-sm font-semibold text-ink">درون‌ریزی و برون‌ریزی</h2>
          </div>
          <div className="flex flex-col gap-2">
            <div ref={backupMenuRef} className="relative">
              <Button
                type="button"
                variant="secondary"
                disabled={backupBusy}
                aria-haspopup="menu"
                aria-expanded={backupMenuOpen}
                aria-controls={backupMenuId}
                aria-label="درون‌ریزی و برون‌ریزی"
                onClick={() => setBackupMenuOpen((open) => !open)}
                className="h-10 w-full justify-between rounded-xl border-line px-3"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <ArchiveRestore className="size-4 shrink-0 text-accent" aria-hidden />
                  <span className="truncate text-sm">درون‌ریزی و برون‌ریزی</span>
                </span>
                <ChevronDown
                  className={cn(
                    'size-4 shrink-0 text-muted transition-transform',
                    backupMenuOpen && 'rotate-180'
                  )}
                  aria-hidden
                />
              </Button>

              {backupMenuOpen && (
                <div
                  id={backupMenuId}
                  role="menu"
                  aria-label="گزینه‌های درون‌ریزی و برون‌ریزی"
                  className="absolute inset-x-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={backupBusy}
                    onClick={() => void handleExportBackup()}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-sm text-ink transition-colors hover:bg-track/50 focus-visible:bg-track/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Download className="size-4 shrink-0 text-accent" aria-hidden />
                    <span>برون‌ریزی</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={backupBusy}
                    onClick={handleOpenImport}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-sm text-ink transition-colors hover:bg-track/50 focus-visible:bg-track/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    <Upload className="size-4 shrink-0 text-accent" aria-hidden />
                    <span>درون‌ریزی</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={backupBusy || accounts.length === 0}
                    onClick={handleOpenPhotoImport}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-right text-sm text-ink transition-colors hover:bg-track/50 focus-visible:bg-track/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                  >
                    <ImagePlus className="size-4 shrink-0 text-accent" aria-hidden />
                    <span>درون‌ریزی با عکس</span>
                  </button>
                </div>
              )}
            </div>
            {backupFeedback && (
              <p
                role="status"
                className={cn(
                  'whitespace-pre-wrap break-all text-xs leading-5',
                  backupFeedback.tone === 'success' && 'text-emerald-700 dark:text-emerald-400',
                  backupFeedback.tone === 'error' && 'text-red-600 dark:text-red-400',
                  backupFeedback.tone === 'info' && 'text-muted'
                )}
              >
                {backupFeedback.message}
              </p>
            )}
          </div>
        </section>

        <div className="mt-auto pt-2">
          <ThemeToggle />
        </div>
      </aside>

      <Dialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null)
            setDeleteError(null)
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription>{deleteDescription}</DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={deleting}
              onClick={() => setPendingDelete(null)}
            >
              انصراف
            </Button>
            <Button type="button" disabled={deleting} onClick={() => void handleConfirmDelete()}>
              {deleting ? 'در حال حذف…' : 'حذف'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          if (backupBusy) return
          setImportOpen(open)
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>درون‌ریزی پشتیبان</DialogTitle>
            <DialogDescription>
              فایل `.skyjournal` را انتخاب کنید. داده‌های پشتیبان با داده‌های فعلی ادغام می‌شوند؛
              شناسه‌های جدید ساخته می‌شود و داده‌های فعلی پاک نمی‌شوند.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={backupBusy}
              onClick={() => setImportOpen(false)}
            >
              انصراف
            </Button>
            <Button
              type="button"
              disabled={backupBusy}
              onClick={() => void handleConfirmImport()}
            >
              {backupBusy ? 'در حال درون‌ریزی…' : 'انتخاب فایل و درون‌ریزی'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
