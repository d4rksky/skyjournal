import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import type { Account, Journal, Strategy } from '@/lib/types'
import { api } from '@/lib/api'
import { buildAccountReport, type AccountReportStats } from '@/lib/accountReport'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/useTheme'

export type AccountReportPageProps = {
  account: Account
  strategies: Strategy[]
  onBack: () => void
}

const formatMoney = (value: number): string =>
  value.toLocaleString('fa-IR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  })

const formatSignedMoney = (value: number): string => {
  const abs = formatMoney(Math.abs(value))
  if (value > 0) return `+${abs}`
  if (value < 0) return `−${abs}`
  return abs
}

const formatPercent = (value: number): string =>
  `${value.toLocaleString('fa-IR', { maximumFractionDigits: 2 })}٪`

const formatRatio = (value: number | null): string => {
  if (value === null || !Number.isFinite(value)) return '—'
  return value.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
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

const formatTradeDate = (value: string): string => {
  if (!value) return '—'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

const moneyTone = (value: number): string => {
  if (value > 0) return 'text-success'
  if (value < 0) return 'text-danger'
  return 'text-ink'
}

type MetricItem = {
  label: string
  value: string
  tone?: string
}

type MetricSection = {
  title: string
  items: MetricItem[]
}

const buildMetricSections = (stats: AccountReportStats): MetricSection[] => [
  {
    title: 'نتایج کلی',
    items: [
      { label: 'سپرده اولیه', value: formatMoney(stats.initialDeposit) },
      { label: 'بالانس نهایی', value: formatMoney(stats.finalBalance) },
      {
        label: 'سود خالص کل',
        value: formatSignedMoney(stats.totalNetProfit),
        tone: moneyTone(stats.totalNetProfit)
      },
      {
        label: 'سود ناخالص',
        value: formatSignedMoney(stats.grossProfit),
        tone: moneyTone(stats.grossProfit)
      },
      {
        label: 'ضرر ناخالص',
        value: formatSignedMoney(stats.grossLoss),
        tone: moneyTone(stats.grossLoss)
      },
      { label: 'فاکتور سود (Profit Factor)', value: formatRatio(stats.profitFactor) },
      {
        label: 'انتظار ریاضی (Expected Payoff)',
        value: formatSignedMoney(stats.expectedPayoff),
        tone: moneyTone(stats.expectedPayoff)
      },
      {
        label: 'فاکتور بازیابی (Recovery Factor)',
        value: formatRatio(stats.recoveryFactor)
      }
    ]
  },
  {
    title: 'دراودان',
    items: [
      { label: 'دراودان مطلق', value: formatMoney(stats.absoluteDrawdown) },
      { label: 'حداکثر دراودان', value: formatMoney(stats.maximalDrawdown) },
      { label: 'حداکثر دراودان نسبی', value: formatPercent(stats.maximalDrawdownPercent) },
      { label: 'دراودان نسبی', value: formatPercent(stats.relativeDrawdownPercent) }
    ]
  },
  {
    title: 'معاملات',
    items: [
      { label: 'تعداد کل معاملات', value: formatMoney(stats.totalTrades) },
      {
        label: 'لانگ (خرید)',
        value: `${formatMoney(stats.longTrades)} (${formatPercent(stats.longWinPercent)} برد)`
      },
      {
        label: 'شورت (فروش)',
        value: `${formatMoney(stats.shortTrades)} (${formatPercent(stats.shortWinPercent)} برد)`
      },
      {
        label: 'معاملات سودده',
        value: `${formatMoney(stats.profitTrades)} (${formatPercent(stats.profitTradesPercent)})`,
        tone: 'text-success'
      },
      {
        label: 'معاملات ضررده',
        value: `${formatMoney(stats.lossTrades)} (${formatPercent(stats.lossTradesPercent)})`,
        tone: 'text-danger'
      },
      { label: 'ریسک‌فری', value: formatMoney(stats.riskFreeTrades) }
    ]
  },
  {
    title: 'سود و ضرر',
    items: [
      {
        label: 'بزرگ‌ترین معامله سودده',
        value: formatSignedMoney(stats.largestProfitTrade),
        tone: moneyTone(stats.largestProfitTrade)
      },
      {
        label: 'بزرگ‌ترین معامله ضررده',
        value: formatSignedMoney(stats.largestLossTrade),
        tone: moneyTone(stats.largestLossTrade)
      },
      {
        label: 'میانگین معامله سودده',
        value: formatSignedMoney(stats.averageProfitTrade),
        tone: moneyTone(stats.averageProfitTrade)
      },
      {
        label: 'میانگین معامله ضررده',
        value: formatSignedMoney(stats.averageLossTrade),
        tone: moneyTone(stats.averageLossTrade)
      }
    ]
  },
  {
    title: 'توالی‌ها',
    items: [
      {
        label: 'حداکثر برد متوالی',
        value: `${formatMoney(stats.maxConsecutiveWins.count)} (${formatSignedMoney(stats.maxConsecutiveWins.money)})`
      },
      {
        label: 'حداکثر باخت متوالی',
        value: `${formatMoney(stats.maxConsecutiveLosses.count)} (${formatSignedMoney(stats.maxConsecutiveLosses.money)})`
      },
      {
        label: 'میانگین برد متوالی',
        value: stats.averageConsecutiveWins.toLocaleString('fa-IR', {
          maximumFractionDigits: 2
        })
      },
      {
        label: 'میانگین باخت متوالی',
        value: stats.averageConsecutiveLosses.toLocaleString('fa-IR', {
          maximumFractionDigits: 2
        })
      }
    ]
  },
  {
    title: 'ریسک و ریوارد',
    items: [
      { label: 'میانگین ریسک', value: formatPercent(stats.averageRiskPct) },
      {
        label: 'میانگین ریوارد',
        value: stats.averageReward.toLocaleString('fa-IR', { maximumFractionDigits: 2 })
      },
      {
        label: 'میانگین اثر ریسک',
        value: formatPercent(stats.averageRiskImpactPercent),
        tone: moneyTone(stats.averageRiskImpactPercent)
      }
    ]
  }
]

const ChartCard = ({
  title,
  children
}: {
  title: string
  children: ReactNode
}) => (
  <section className="rounded-3xl border border-line bg-card p-4 sm:p-6">
    <h2 className="mb-4 text-sm font-semibold text-ink">{title}</h2>
    <div className="h-72 w-full min-w-0" dir="ltr">
      {children}
    </div>
  </section>
)

type TooltipPayload = {
  value?: number
  dataKey?: string | number
  color?: string
  name?: string
  payload?: {
    label?: string
    balance?: number
    cumulativePnl?: number
    tradePnl?: number
  }
}

const ChartTooltip = ({
  active,
  payload,
  moneyKey,
  moneyLabel
}: {
  active?: boolean
  payload?: TooltipPayload[]
  moneyKey: 'balance' | 'cumulativePnl' | 'tradePnl'
  moneyLabel: string
}) => {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  const value = point[moneyKey]
  if (value === undefined) return null
  return (
    <div className="rounded-xl border border-line bg-card px-3 py-2 text-xs shadow-sm">
      <p className="text-muted">{point.label ?? ''}</p>
      <p className={cn('mt-1 font-medium', moneyTone(value))}>
        {moneyLabel}: {formatSignedMoney(value)}
      </p>
    </div>
  )
}

export const AccountReportPage = ({
  account,
  strategies,
  onBack
}: AccountReportPageProps) => {
  const { theme } = useTheme()
  const [journals, setJournals] = useState<Journal[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadJournals = useCallback(async () => {
    setLoadError(null)
    setLoading(true)
    try {
      const rows = await api.journals.list(account.id)
      setJournals(rows)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'بارگذاری گزارش ناموفق بود.')
    } finally {
      setLoading(false)
    }
  }, [account.id])

  useEffect(() => {
    void loadJournals()
  }, [loadJournals])

  const report = useMemo(
    () => buildAccountReport(account.initialBalance, journals, strategies),
    [account.initialBalance, journals, strategies]
  )

  const sections = useMemo(() => buildMetricSections(report.stats), [report.stats])

  const chartColors = useMemo(() => {
    const dark = theme === 'dark'
    return {
      grid: dark ? 'rgba(235, 235, 245, 0.12)' : 'rgba(60, 60, 67, 0.12)',
      axis: dark ? '#98989d' : '#8e8e93',
      equity: dark ? '#0a84ff' : '#007aff',
      equityFill: dark ? 'rgba(10, 132, 255, 0.22)' : 'rgba(0, 122, 255, 0.18)',
      pnl: dark ? '#30d158' : '#34c759',
      pnlFill: dark ? 'rgba(48, 209, 88, 0.22)' : 'rgba(52, 199, 89, 0.18)',
      profitBar: dark ? '#30d158' : '#34c759',
      lossBar: dark ? '#ff453a' : '#ff3b30',
      flatBar: dark ? '#98989d' : '#8e8e93'
    }
  }, [theme])

  const tradeBars = useMemo(
    () =>
      report.trades.map((trade) => ({
        index: trade.index,
        label: String(trade.index),
        tradePnl: trade.pnl
      })),
    [report.trades]
  )

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-4 py-3 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          onClick={onBack}
          aria-label="بازگشت به حساب"
          className="size-10 shrink-0 p-0"
        >
          <ArrowRight className="size-5" aria-hidden />
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-ink">گزارش حساب</h1>
          <p className="truncate text-sm text-muted">{account.name}</p>
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
        {loadError && (
          <p className="rounded-2xl bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {loadError}
          </p>
        )}

        {loading ? (
          <p className="text-sm text-muted">در حال آماده‌سازی گزارش…</p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {sections.map((section) => (
                <section
                  key={section.title}
                  className="rounded-3xl border border-line bg-card p-4 sm:p-5"
                >
                  <h2 className="mb-3 text-sm font-semibold text-ink">{section.title}</h2>
                  <dl className="space-y-2.5 text-sm">
                    {section.items.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-start justify-between gap-3 border-b border-line/60 pb-2 last:border-b-0 last:pb-0"
                      >
                        <dt className="text-muted">{item.label}</dt>
                        <dd className={cn('shrink-0 text-left font-medium', item.tone ?? 'text-ink')}>
                          {item.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard title="منحنی رشد حساب (Equity)">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.equitySeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="index"
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.grid }}
                    />
                    <YAxis
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.grid }}
                      width={64}
                      tickFormatter={(value: number) =>
                        value.toLocaleString('en-US', { maximumFractionDigits: 0 })
                      }
                    />
                    <Tooltip
                      content={
                        <ChartTooltip moneyKey="balance" moneyLabel="بالانس" />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke={chartColors.equity}
                      fill={chartColors.equityFill}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="سود و ضرر تجمعی (PnL)">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={report.pnlSeries} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="index"
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.grid }}
                    />
                    <YAxis
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.grid }}
                      width={64}
                      tickFormatter={(value: number) =>
                        value.toLocaleString('en-US', { maximumFractionDigits: 0 })
                      }
                    />
                    <Tooltip
                      content={
                        <ChartTooltip moneyKey="cumulativePnl" moneyLabel="PnL تجمعی" />
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="cumulativePnl"
                      stroke={chartColors.pnl}
                      fill={chartColors.pnlFill}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <ChartCard title="سود/ضرر هر معامله">
              {tradeBars.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">
                  هنوز معامله‌ای برای رسم نمودار نیست.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={tradeBars} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={chartColors.grid} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="index"
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.grid }}
                    />
                    <YAxis
                      tick={{ fill: chartColors.axis, fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: chartColors.grid }}
                      width={64}
                      tickFormatter={(value: number) =>
                        value.toLocaleString('en-US', { maximumFractionDigits: 0 })
                      }
                    />
                    <Tooltip
                      content={
                        <ChartTooltip moneyKey="tradePnl" moneyLabel="سود/ضرر" />
                      }
                    />
                    <Bar dataKey="tradePnl" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                      {tradeBars.map((entry) => (
                        <Cell
                          key={entry.index}
                          fill={
                            entry.tradePnl > 0
                              ? chartColors.profitBar
                              : entry.tradePnl < 0
                                ? chartColors.lossBar
                                : chartColors.flatBar
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>

            <section className="rounded-3xl border border-line bg-card">
              <div className="border-b border-line p-4 sm:p-5">
                <h2 className="text-sm font-semibold text-ink">تاریخچه معاملات</h2>
                <p className="mt-1 text-xs text-muted">
                  مشابه خروجی Account History در متاتریدر — اندازه لات و قیمت‌ها در ژورنال ذخیره نمی‌شوند.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-line bg-track/40 text-right">
                      {[
                        'Ticket',
                        'زمان',
                        'تاریخ معامله',
                        'نوع',
                        'نماد',
                        'استراتژی',
                        'ریسک٪',
                        'ریوارد',
                        'نتیجه',
                        'سود/ضرر',
                        'بالانس'
                      ].map((header) => (
                        <th
                          key={header}
                          className="whitespace-nowrap px-3 py-3 font-medium text-ink"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.trades.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-4 py-10 text-center text-muted">
                          هنوز معامله‌ای ثبت نشده است.
                        </td>
                      </tr>
                    ) : (
                      report.trades.map((trade) => (
                        <tr key={trade.id} className="border-b border-line/80 hover:bg-track/20">
                          <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-muted">
                            {trade.ticket}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-muted">
                            {formatDateTime(trade.openTime)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {formatTradeDate(trade.tradeDate)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {trade.sideLabel || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {trade.symbol || '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {trade.strategyName}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {trade.riskPct
                              ? formatPercent(trade.riskPct)
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {trade.reward
                              ? trade.reward.toLocaleString('fa-IR', {
                                  maximumFractionDigits: 2
                                })
                              : '—'}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {trade.resultLabel || '—'}
                          </td>
                          <td
                            className={cn(
                              'whitespace-nowrap px-3 py-3 font-medium',
                              moneyTone(trade.pnl)
                            )}
                          >
                            {formatSignedMoney(trade.pnl)}
                          </td>
                          <td className="whitespace-nowrap px-3 py-3 text-ink">
                            {formatMoney(trade.balanceAfter)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
