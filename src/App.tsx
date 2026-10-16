import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Account, Journal, Strategy, SymbolItem } from '@/lib/types'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Sidebar } from '@/components/shell/Sidebar'
import { StrategyModal } from '@/components/strategy/StrategyModal'
import { AccountModal } from '@/components/account/AccountModal'
import { AccountHome } from '@/pages/AccountHome'
import { AccountReportPage } from '@/pages/AccountReportPage'
import { JournalPage } from '@/pages/JournalPage'
import { PhotoImportPage } from '@/pages/PhotoImportPage'

type View = 'home' | 'journal' | 'report' | 'photoImport'

const App = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [symbols, setSymbols] = useState<SymbolItem[]>([])
  const [loading, setLoading] = useState(true)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const [view, setView] = useState<View>('home')
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [journalStrategyId, setJournalStrategyId] = useState<string | null>(null)
  const [editingJournal, setEditingJournal] = useState<Journal | null>(null)

  const [strategyModalOpen, setStrategyModalOpen] = useState(false)
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null)
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)

  const refreshStrategies = useCallback(async () => {
    const rows = await api.strategies.list()
    setStrategies(rows)
    return rows
  }, [])

  const refreshAccounts = useCallback(async () => {
    const rows = await api.accounts.list()
    setAccounts(rows)
    return rows
  }, [])

  const refreshSymbols = useCallback(async () => {
    const rows = await api.symbols.list()
    setSymbols(rows)
    return rows
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setBannerError(null)
    const errors: string[] = []
    try {
      await refreshStrategies()
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'بارگذاری استراتژی‌ها ناموفق بود.')
    }
    try {
      await refreshAccounts()
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'بارگذاری حساب‌ها ناموفق بود.')
    }
    try {
      await refreshSymbols()
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'بارگذاری نمادها ناموفق بود.')
    }
    if (errors.length > 0) {
      setBannerError(errors.join(' · '))
    }
    setLoading(false)
  }, [refreshStrategies, refreshAccounts, refreshSymbols])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  useEffect(() => {
    if (accounts.length === 0) {
      setSelectedAccountId(null)
      return
    }
    if (!selectedAccountId || !accounts.some((account) => account.id === selectedAccountId)) {
      setSelectedAccountId(accounts[0].id)
    }
  }, [accounts, selectedAccountId])

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId]
  )

  const journalStrategy = useMemo(() => {
    if (!journalStrategyId) return null
    return strategies.find((strategy) => strategy.id === journalStrategyId) ?? null
  }, [strategies, journalStrategyId])

  const handleOpenCreateStrategy = () => {
    setEditingStrategy(null)
    setStrategyModalOpen(true)
  }

  const handleOpenEditStrategy = (strategy: Strategy) => {
    setEditingStrategy(strategy)
    setStrategyModalOpen(true)
  }

  const handleOpenCreateAccount = () => {
    setEditingAccount(null)
    setAccountModalOpen(true)
  }

  const handleOpenEditAccount = (account: Account) => {
    setEditingAccount(account)
    setAccountModalOpen(true)
  }

  const handleSelectAccount = (accountId: string) => {
    setSelectedAccountId(accountId)
    setView('home')
    setJournalStrategyId(null)
    setEditingJournal(null)
  }

  const handleOpenJournal = (strategyId: string) => {
    setEditingJournal(null)
    setJournalStrategyId(strategyId)
    setView('journal')
  }

  const handleEditJournal = (journal: Journal) => {
    setEditingJournal(journal)
    setJournalStrategyId(journal.strategyId)
    setView('journal')
  }

  const handleCloseJournal = () => {
    setView('home')
    setJournalStrategyId(null)
    setEditingJournal(null)
  }

  const handleOpenReport = () => {
    setJournalStrategyId(null)
    setEditingJournal(null)
    setView('report')
  }

  const handleCloseReport = () => {
    setView('home')
  }

  const handleOpenPhotoImport = () => {
    setJournalStrategyId(null)
    setEditingJournal(null)
    setView('photoImport')
  }

  const handleClosePhotoImport = () => {
    setView('home')
  }

  const handleSidebarRefresh = async () => {
    const nextAccounts = await refreshAccounts()
    await refreshStrategies()
    if (selectedAccountId && !nextAccounts.some((account) => account.id === selectedAccountId)) {
      setView('home')
      setJournalStrategyId(null)
      setEditingJournal(null)
    }
  }

  const handleStrategySaved = async () => {
    await refreshStrategies()
  }

  const handleAccountSaved = async () => {
    const rows = await refreshAccounts()
    if (!selectedAccountId && rows.length > 0) {
      setSelectedAccountId(rows[rows.length - 1].id)
    }
  }

  const handleJournalSaved = async () => {
    await refreshAccounts()
  }

  const renderMain = () => {
    if (loading) {
      return (
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted">
          در حال بارگذاری…
        </div>
      )
    }

    if (strategies.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-muted">برای شروع، یک استراتژی ثبت کنید.</p>
          <Button type="button" size="lg" onClick={handleOpenCreateStrategy}>
            ثبت استراتژی
          </Button>
        </div>
      )
    }

    if (accounts.length === 0) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <p className="text-muted">حساب معاملاتی خود را ثبت کنید.</p>
          <Button type="button" size="lg" onClick={handleOpenCreateAccount}>
            ثبت حساب
          </Button>
        </div>
      )
    }

    if (view === 'journal' && selectedAccount && journalStrategy) {
      return (
        <JournalPage
          account={selectedAccount}
          strategy={journalStrategy}
          symbols={symbols}
          editingJournal={editingJournal}
          onBack={handleCloseJournal}
          onSaved={() => void handleJournalSaved()}
          onSymbolsChange={() => void refreshSymbols()}
        />
      )
    }

    if (view === 'report' && selectedAccount) {
      return (
        <AccountReportPage
          account={selectedAccount}
          strategies={strategies}
          onBack={handleCloseReport}
        />
      )
    }

    if (view === 'photoImport' && accounts.length > 0) {
      return (
        <PhotoImportPage
          accounts={accounts}
          strategies={strategies}
          symbols={symbols}
          initialAccountId={selectedAccountId}
          onBack={handleClosePhotoImport}
          onImported={() => {
            void refreshAccounts()
            void refreshSymbols()
          }}
          onSymbolsChange={() => void refreshSymbols()}
        />
      )
    }

    if (selectedAccount) {
      return (
        <AccountHome
          account={selectedAccount}
          strategies={strategies}
          onOpenJournal={handleOpenJournal}
          onEditJournal={handleEditJournal}
          onOpenReport={handleOpenReport}
          onOpenPhotoImport={handleOpenPhotoImport}
          onAccountMutated={() => void refreshAccounts()}
        />
      )
    }

    return null
  }

  return (
    <div dir="rtl" className="flex h-full min-h-0 bg-canvas">
      <Sidebar
        strategies={strategies}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={handleSelectAccount}
        onCreateStrategy={handleOpenCreateStrategy}
        onEditStrategy={handleOpenEditStrategy}
        onCreateAccount={handleOpenCreateAccount}
        onEditAccount={handleOpenEditAccount}
        onOpenPhotoImport={handleOpenPhotoImport}
        onRefresh={() => void handleSidebarRefresh()}
      />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        {bannerError && (
          <div
            className={cn(
              'shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-800'
            )}
            role="alert"
          >
            {bannerError}
          </div>
        )}
        {renderMain()}
      </main>

      <StrategyModal
        open={strategyModalOpen}
        onOpenChange={setStrategyModalOpen}
        strategy={editingStrategy}
        symbols={symbols}
        onSymbolsChange={() => void refreshSymbols()}
        onSaved={() => void handleStrategySaved()}
      />

      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
        account={editingAccount}
        strategies={strategies}
        onSaved={() => void handleAccountSaved()}
      />
    </div>
  )
}

export default App
