import type { Journal, Strategy } from '../../src/lib/types'
import { recalculateRunningBalance } from '../../src/lib/tradeMath'

export type BalanceDbHooks = {
  getAccountInitialBalance: (accountId: string) => number | null
  listJournalsOldestFirst: (accountId: string) => Journal[]
  listStrategies: () => Strategy[]
  setAccountCurrentBalance: (accountId: string, balance: number) => void
}

let hooks: BalanceDbHooks | null = null
const pending = new Set<string>()
let scheduled = false

export const registerBalanceHooks = (next: BalanceDbHooks): void => {
  hooks = next
}

const flush = (): void => {
  scheduled = false
  if (!hooks) return
  const accountIds = Array.from(pending)
  pending.clear()
  const strategies = hooks.listStrategies()
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]))

  for (const accountId of accountIds) {
    try {
      const initial = hooks.getAccountInitialBalance(accountId)
      if (initial === null) continue
      const journals = hooks.listJournalsOldestFirst(accountId)
      const nextBalance = recalculateRunningBalance(initial, journals, strategyById)
      hooks.setAccountCurrentBalance(accountId, nextBalance)
    } catch {
      /* ignore; next mutation retries */
    }
  }
}

/** Full-chain recalc from initial balance through all trades (oldest → newest). */
export const recalculateAccountBalance = (accountId: string): number | null => {
  if (!hooks) return null
  const initial = hooks.getAccountInitialBalance(accountId)
  if (initial === null) return null
  const strategies = hooks.listStrategies()
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]))
  const journals = hooks.listJournalsOldestFirst(accountId)
  const nextBalance = recalculateRunningBalance(initial, journals, strategyById)
  hooks.setAccountCurrentBalance(accountId, nextBalance)
  pending.delete(accountId)
  return nextBalance
}

/**
 * Queue recalc on the next event-loop tick. Prefer recalculateAccountBalance
 * after create/update/delete so IPC responses include the fresh balance.
 * Useful for startup backfill of many accounts without blocking initDb.
 */
export const enqueueBalanceRecalc = (accountId: string): void => {
  pending.add(accountId)
  if (scheduled) return
  scheduled = true
  setImmediate(flush)
}
