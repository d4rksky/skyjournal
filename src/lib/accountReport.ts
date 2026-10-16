import type { Journal, Strategy } from './types'
import { computeTradePnl, getBuiltinString, parseNumber } from './tradeMath'

export type ReportTradeRow = {
  index: number
  id: string
  ticket: string
  openTime: string
  tradeDate: string
  side: string
  sideLabel: string
  result: string
  resultLabel: string
  symbol: string
  strategyName: string
  riskPct: number
  reward: number
  pnl: number
  balanceAfter: number
  cumulativePnl: number
}

export type EquityPoint = {
  index: number
  label: string
  balance: number
  cumulativePnl: number
  tradePnl: number
}

export type StreakStat = {
  count: number
  money: number
}

export type AccountReportStats = {
  initialDeposit: number
  finalBalance: number
  totalNetProfit: number
  grossProfit: number
  grossLoss: number
  profitFactor: number | null
  expectedPayoff: number
  absoluteDrawdown: number
  maximalDrawdown: number
  maximalDrawdownPercent: number
  relativeDrawdownPercent: number
  recoveryFactor: number | null
  totalTrades: number
  longTrades: number
  shortTrades: number
  longWins: number
  shortWins: number
  longWinPercent: number
  shortWinPercent: number
  profitTrades: number
  lossTrades: number
  riskFreeTrades: number
  profitTradesPercent: number
  lossTradesPercent: number
  largestProfitTrade: number
  largestLossTrade: number
  averageProfitTrade: number
  averageLossTrade: number
  maxConsecutiveWins: StreakStat
  maxConsecutiveLosses: StreakStat
  averageConsecutiveWins: number
  averageConsecutiveLosses: number
  averageRiskPct: number
  averageReward: number
  averageRiskImpactPercent: number
}

export type AccountReport = {
  trades: ReportTradeRow[]
  equitySeries: EquityPoint[]
  pnlSeries: EquityPoint[]
  stats: AccountReportStats
}

const emptyStreak = (): StreakStat => ({ count: 0, money: 0 })

const emptyStats = (initialDeposit: number): AccountReportStats => ({
  initialDeposit,
  finalBalance: initialDeposit,
  totalNetProfit: 0,
  grossProfit: 0,
  grossLoss: 0,
  profitFactor: null,
  expectedPayoff: 0,
  absoluteDrawdown: 0,
  maximalDrawdown: 0,
  maximalDrawdownPercent: 0,
  relativeDrawdownPercent: 0,
  recoveryFactor: null,
  totalTrades: 0,
  longTrades: 0,
  shortTrades: 0,
  longWins: 0,
  shortWins: 0,
  longWinPercent: 0,
  shortWinPercent: 0,
  profitTrades: 0,
  lossTrades: 0,
  riskFreeTrades: 0,
  profitTradesPercent: 0,
  lossTradesPercent: 0,
  largestProfitTrade: 0,
  largestLossTrade: 0,
  averageProfitTrade: 0,
  averageLossTrade: 0,
  maxConsecutiveWins: emptyStreak(),
  maxConsecutiveLosses: emptyStreak(),
  averageConsecutiveWins: 0,
  averageConsecutiveLosses: 0,
  averageRiskPct: 0,
  averageReward: 0,
  averageRiskImpactPercent: 0
})

export const sortJournalsOldestFirst = (journals: Journal[]): Journal[] =>
  [...journals].sort((a, b) => {
    const byTime = a.createdAt.localeCompare(b.createdAt)
    return byTime !== 0 ? byTime : a.id.localeCompare(b.id)
  })

const optionLabel = (
  strategy: Strategy | undefined,
  builtinKey: 'side' | 'result',
  id: string
): string => {
  if (!strategy || !id) return id || '—'
  const field = strategy.fields.find((item) => item.builtinKey === builtinKey)
  if (!field) return id
  return field.options.find((option) => option.id === id)?.label ?? id
}

const formatSeriesLabel = (index: number, tradeDate: string, createdAt: string): string => {
  if (tradeDate) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tradeDate.trim())
    if (match) return `${match[1]}/${match[2]}/${match[3]}`
    return tradeDate
  }
  const date = new Date(createdAt)
  if (Number.isNaN(date.getTime())) return String(index)
  return date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

type Outcome = 'win' | 'loss' | 'flat'

const outcomeFromResult = (result: string, pnl: number): Outcome => {
  if (result === 'profit' || pnl > 0) return 'win'
  if (result === 'loss' || pnl < 0) return 'loss'
  return 'flat'
}

const finalizeStreakAverages = (streaks: number[]): number => {
  if (streaks.length === 0) return 0
  return streaks.reduce((sum, value) => sum + value, 0) / streaks.length
}

export const buildAccountReport = (
  initialDeposit: number,
  journals: Journal[],
  strategies: Strategy[]
): AccountReport => {
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]))
  const oldestFirst = sortJournalsOldestFirst(journals)

  if (oldestFirst.length === 0) {
    const seed: EquityPoint = {
      index: 0,
      label: 'شروع',
      balance: initialDeposit,
      cumulativePnl: 0,
      tradePnl: 0
    }
    return {
      trades: [],
      equitySeries: [seed],
      pnlSeries: [seed],
      stats: emptyStats(initialDeposit)
    }
  }

  let balance = initialDeposit
  let cumulativePnl = 0
  let peak = initialDeposit
  let minBalance = initialDeposit
  let maximalDrawdown = 0
  let maximalDrawdownPercent = 0

  let grossProfit = 0
  let grossLoss = 0
  let profitTrades = 0
  let lossTrades = 0
  let riskFreeTrades = 0
  let largestProfitTrade = 0
  let largestLossTrade = 0
  let sumProfitTrades = 0
  let sumLossTrades = 0

  let longTrades = 0
  let shortTrades = 0
  let longWins = 0
  let shortWins = 0

  let sumRiskPct = 0
  let riskSamples = 0
  let sumReward = 0
  let rewardSamples = 0
  let sumRiskImpact = 0

  let winStreak = 0
  let lossStreak = 0
  let winStreakMoney = 0
  let lossStreakMoney = 0
  let maxConsecutiveWins = emptyStreak()
  let maxConsecutiveLosses = emptyStreak()
  const winStreakLengths: number[] = []
  const lossStreakLengths: number[] = []

  const trades: ReportTradeRow[] = []
  const equitySeries: EquityPoint[] = [
    {
      index: 0,
      label: 'شروع',
      balance: initialDeposit,
      cumulativePnl: 0,
      tradePnl: 0
    }
  ]
  const pnlSeries: EquityPoint[] = [
    {
      index: 0,
      label: 'شروع',
      balance: initialDeposit,
      cumulativePnl: 0,
      tradePnl: 0
    }
  ]

  oldestFirst.forEach((journal, offset) => {
    const strategy = strategyById.get(journal.strategyId)
    const pnl = computeTradePnl(balance, journal, strategy)
    balance += pnl
    cumulativePnl += pnl

    const side = getBuiltinString(journal, strategy, 'side')
    const result = getBuiltinString(journal, strategy, 'result')
    const symbol = getBuiltinString(journal, strategy, 'symbol')
    const tradeDate = getBuiltinString(journal, strategy, 'tradeDate')
    const riskPct = parseNumber(getBuiltinString(journal, strategy, 'risk'))
    const reward = parseNumber(getBuiltinString(journal, strategy, 'reward'))
    const index = offset + 1
    const label = formatSeriesLabel(index, tradeDate, journal.createdAt)

    trades.push({
      index,
      id: journal.id,
      ticket: journal.id.slice(0, 8),
      openTime: journal.createdAt,
      tradeDate,
      side,
      sideLabel: optionLabel(strategy, 'side', side),
      result,
      resultLabel: optionLabel(strategy, 'result', result),
      symbol,
      strategyName: strategy?.name ?? '—',
      riskPct,
      reward,
      pnl,
      balanceAfter: balance,
      cumulativePnl
    })

    equitySeries.push({
      index,
      label,
      balance,
      cumulativePnl,
      tradePnl: pnl
    })
    pnlSeries.push({
      index,
      label,
      balance,
      cumulativePnl,
      tradePnl: pnl
    })

    if (balance > peak) peak = balance
    if (balance < minBalance) minBalance = balance
    const drawdown = peak - balance
    if (drawdown > maximalDrawdown) {
      maximalDrawdown = drawdown
      maximalDrawdownPercent = peak > 0 ? (drawdown / peak) * 100 : 0
    }

    if (pnl > 0) {
      grossProfit += pnl
      profitTrades += 1
      sumProfitTrades += pnl
      if (pnl > largestProfitTrade) largestProfitTrade = pnl
    } else if (pnl < 0) {
      grossLoss += pnl
      lossTrades += 1
      sumLossTrades += pnl
      if (pnl < largestLossTrade) largestLossTrade = pnl
    } else if (result === 'risk_free') {
      riskFreeTrades += 1
    }

    if (side === 'buy') {
      longTrades += 1
      if (pnl > 0) longWins += 1
    } else if (side === 'sell') {
      shortTrades += 1
      if (pnl > 0) shortWins += 1
    }

    if (riskPct > 0 || getBuiltinString(journal, strategy, 'risk') !== '') {
      sumRiskPct += riskPct
      riskSamples += 1
    }
    if (reward > 0 || getBuiltinString(journal, strategy, 'reward') !== '') {
      sumReward += reward
      rewardSamples += 1
    }
    if (result === 'profit') sumRiskImpact += riskPct * reward
    else if (result === 'loss') sumRiskImpact -= riskPct

    const outcome = outcomeFromResult(result, pnl)
    if (outcome === 'win') {
      if (lossStreak > 0) {
        lossStreakLengths.push(lossStreak)
        lossStreak = 0
        lossStreakMoney = 0
      }
      winStreak += 1
      winStreakMoney += pnl
      if (
        winStreak > maxConsecutiveWins.count ||
        (winStreak === maxConsecutiveWins.count && winStreakMoney > maxConsecutiveWins.money)
      ) {
        maxConsecutiveWins = { count: winStreak, money: winStreakMoney }
      }
    } else if (outcome === 'loss') {
      if (winStreak > 0) {
        winStreakLengths.push(winStreak)
        winStreak = 0
        winStreakMoney = 0
      }
      lossStreak += 1
      lossStreakMoney += pnl
      if (
        lossStreak > maxConsecutiveLosses.count ||
        (lossStreak === maxConsecutiveLosses.count &&
          Math.abs(lossStreakMoney) > Math.abs(maxConsecutiveLosses.money))
      ) {
        maxConsecutiveLosses = { count: lossStreak, money: lossStreakMoney }
      }
    } else {
      if (winStreak > 0) {
        winStreakLengths.push(winStreak)
        winStreak = 0
        winStreakMoney = 0
      }
      if (lossStreak > 0) {
        lossStreakLengths.push(lossStreak)
        lossStreak = 0
        lossStreakMoney = 0
      }
    }
  })

  if (winStreak > 0) winStreakLengths.push(winStreak)
  if (lossStreak > 0) lossStreakLengths.push(lossStreak)

  const totalTrades = oldestFirst.length
  const totalNetProfit = cumulativePnl
  const absGrossLoss = Math.abs(grossLoss)
  const absoluteDrawdown = Math.max(0, initialDeposit - minBalance)

  const stats: AccountReportStats = {
    initialDeposit,
    finalBalance: balance,
    totalNetProfit,
    grossProfit,
    grossLoss,
    profitFactor: absGrossLoss > 0 ? grossProfit / absGrossLoss : null,
    expectedPayoff: totalTrades > 0 ? totalNetProfit / totalTrades : 0,
    absoluteDrawdown,
    maximalDrawdown,
    maximalDrawdownPercent,
    relativeDrawdownPercent: maximalDrawdownPercent,
    recoveryFactor: maximalDrawdown > 0 ? totalNetProfit / maximalDrawdown : null,
    totalTrades,
    longTrades,
    shortTrades,
    longWins,
    shortWins,
    longWinPercent: longTrades > 0 ? (longWins / longTrades) * 100 : 0,
    shortWinPercent: shortTrades > 0 ? (shortWins / shortTrades) * 100 : 0,
    profitTrades,
    lossTrades,
    riskFreeTrades,
    profitTradesPercent: totalTrades > 0 ? (profitTrades / totalTrades) * 100 : 0,
    lossTradesPercent: totalTrades > 0 ? (lossTrades / totalTrades) * 100 : 0,
    largestProfitTrade,
    largestLossTrade,
    averageProfitTrade: profitTrades > 0 ? sumProfitTrades / profitTrades : 0,
    averageLossTrade: lossTrades > 0 ? sumLossTrades / lossTrades : 0,
    maxConsecutiveWins,
    maxConsecutiveLosses,
    averageConsecutiveWins: finalizeStreakAverages(winStreakLengths),
    averageConsecutiveLosses: finalizeStreakAverages(lossStreakLengths),
    averageRiskPct: riskSamples > 0 ? sumRiskPct / riskSamples : 0,
    averageReward: rewardSamples > 0 ? sumReward / rewardSamples : 0,
    averageRiskImpactPercent: totalTrades > 0 ? sumRiskImpact / totalTrades : 0
  }

  return { trades, equitySeries, pnlSeries, stats }
}
