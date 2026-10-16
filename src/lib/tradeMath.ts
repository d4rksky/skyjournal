import type { BuiltinKey, Journal, Strategy } from './types'

export type TradeResultId = 'profit' | 'loss' | 'risk_free' | string

export const getBuiltinString = (
  journal: Journal,
  strategy: Strategy | undefined,
  builtinKey: BuiltinKey
): string => {
  if (!strategy) return ''
  const field = strategy.fields.find((item) => item.builtinKey === builtinKey)
  if (!field) return ''
  const raw = journal.values[field.key]
  return typeof raw === 'string' ? raw : ''
}

export const parseNumber = (raw: string): number => {
  const value = Number(raw)
  return Number.isFinite(value) ? value : 0
}

/** Signed P/L in account currency for one trade at a given balance. */
export const computeTradePnl = (
  balanceBefore: number,
  journal: Journal,
  strategy: Strategy | undefined
): number => {
  const result = getBuiltinString(journal, strategy, 'result')
  const riskPct = parseNumber(getBuiltinString(journal, strategy, 'risk'))
  const rewardMult = parseNumber(getBuiltinString(journal, strategy, 'reward'))
  const riskAmount = balanceBefore * (riskPct / 100)

  if (result === 'profit') return riskAmount * rewardMult
  if (result === 'loss') return -riskAmount
  return 0
}

/** Risk impact as % of balance before the trade (signed). */
export const computeRiskImpactPercent = (
  journal: Journal,
  strategy: Strategy | undefined
): number => {
  const result = getBuiltinString(journal, strategy, 'result')
  const riskPct = parseNumber(getBuiltinString(journal, strategy, 'risk'))
  const rewardMult = parseNumber(getBuiltinString(journal, strategy, 'reward'))

  if (result === 'profit') return riskPct * rewardMult
  if (result === 'loss') return -riskPct
  return 0
}

export const recalculateRunningBalance = (
  initialBalance: number,
  journalsOldestFirst: Journal[],
  strategyById: Map<string, Strategy>
): number => {
  let balance = initialBalance
  for (const journal of journalsOldestFirst) {
    const strategy = strategyById.get(journal.strategyId)
    balance += computeTradePnl(balance, journal, strategy)
  }
  return balance
}
