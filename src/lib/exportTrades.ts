import type { FieldDefinition, Journal, Strategy } from './types'
import { computeTradePnl, getBuiltinString } from './tradeMath'

export type ExportFormatId = 'metatrader' | 'custom'

/**
 * MetaTrader-compatible CSV: mirrors the classic MT4 Account History
 * "Closed Transactions" column set used by statement tools / journals:
 * Ticket, Open Time, Type, Size, Item, Open Price, S/L, T/P,
 * Close Time, Close Price, Commission, Taxes, Swap, Profit
 *
 * SkyJournal does not store prices/lots; Size/prices/SL/TP/costs are left empty (0)
 * and Profit is the journal-derived P/L in account currency.
 */
export const MT_HISTORY_HEADERS = [
  'Ticket',
  'Open Time',
  'Type',
  'Size',
  'Item',
  'Open Price',
  'S/L',
  'T/P',
  'Close Time',
  'Close Price',
  'Commission',
  'Taxes',
  'Swap',
  'Profit'
] as const

export type CustomExportColumnId =
  | 'createdAt'
  | 'strategy'
  | 'side'
  | 'result'
  | 'symbol'
  | 'tradeDate'
  | 'reward'
  | 'maxReward'
  | 'risk'
  | 'pnl'
  | 'description'
  | 'field'

export type CustomExportColumn = {
  id: string
  label: string
  kind: CustomExportColumnId
  fieldKey?: string
}

const escapeCsv = (value: string): string => {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

const formatMtTime = (iso: string): string => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Date-only values (YYYY-MM-DD) → MT Open Time with midnight clock. */
const formatMtDateOnly = (ymd: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!match) return ''
  return `${match[1]}.${match[2]}.${match[3]} 00:00`
}

const sideToMtType = (side: string): string => {
  if (side === 'buy') return 'buy'
  if (side === 'sell') return 'sell'
  return 'balance'
}

const csvJoin = (cells: string[]): string => cells.map(escapeCsv).join(',')

export const buildMetatraderCsv = (
  journalsOldestFirst: Journal[],
  strategies: Strategy[],
  initialBalance: number
): string => {
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]))
  let balance = initialBalance
  const lines = [csvJoin([...MT_HISTORY_HEADERS])]

  for (const journal of journalsOldestFirst) {
    const strategy = strategyById.get(journal.strategyId)
    const pnl = computeTradePnl(balance, journal, strategy)
    balance += pnl
    const side = getBuiltinString(journal, strategy, 'side')
    const symbol = getBuiltinString(journal, strategy, 'symbol')
    const tradeDate = getBuiltinString(journal, strategy, 'tradeDate')
    const time = tradeDate
      ? formatMtDateOnly(tradeDate) || formatMtTime(journal.createdAt)
      : formatMtTime(journal.createdAt)

    lines.push(
      csvJoin([
        journal.id.slice(0, 8),
        time,
        sideToMtType(side),
        '0',
        symbol,
        '0',
        '0',
        '0',
        time,
        '0',
        '0',
        '0',
        '0',
        String(Number(pnl.toFixed(2)))
      ])
    )
  }

  return `${lines.join('\n')}\n`
}

export const defaultCustomColumns = (fields: FieldDefinition[]): CustomExportColumn[] => {
  const columns: CustomExportColumn[] = [
    { id: 'createdAt', label: 'تاریخ', kind: 'createdAt' },
    { id: 'strategy', label: 'استراتژی', kind: 'strategy' }
  ]

  const builtins: Array<{ key: CustomExportColumnId; label: string; builtin: string }> = [
    { key: 'side', label: 'نوع معامله', builtin: 'side' },
    { key: 'result', label: 'نتیجه', builtin: 'result' },
    { key: 'symbol', label: 'نماد', builtin: 'symbol' },
    { key: 'tradeDate', label: 'تاریخ معامله', builtin: 'tradeDate' },
    { key: 'reward', label: 'ریوارد', builtin: 'reward' },
    { key: 'maxReward', label: 'بیشترین ریوارد', builtin: 'maxReward' },
    { key: 'risk', label: 'ریسک', builtin: 'risk' },
    { key: 'description', label: 'توضیحات', builtin: 'description' }
  ]

  for (const item of builtins) {
    const field = fields.find((f) => f.builtinKey === item.builtin && f.enabled)
    if (field) {
      columns.push({ id: item.key, label: field.label || item.label, kind: item.key })
    }
  }

  columns.push({ id: 'pnl', label: 'سود/ضرر', kind: 'pnl' })

  for (const field of fields) {
    if (!field.enabled || field.builtin) continue
    columns.push({
      id: `field:${field.key}`,
      label: field.label,
      kind: 'field',
      fieldKey: field.key
    })
  }

  return columns
}

const formatFieldCell = (
  field: FieldDefinition | undefined,
  raw: string | string[] | undefined
): string => {
  if (raw === undefined || raw === null || raw === '') return ''
  if (Array.isArray(raw)) {
    if (!field) return raw.join(';')
    return raw
      .map((id) => field.options.find((option) => option.id === id)?.label ?? id)
      .join(';')
  }
  if (!field) return raw
  if (
    field.type === 'combobox' ||
    field.type === 'input' ||
    field.type === 'textarea' ||
    field.type === 'date'
  ) {
    return raw
  }
  return field.options.find((option) => option.id === raw)?.label ?? raw
}

export const buildCustomCsv = (
  journalsOldestFirst: Journal[],
  strategies: Strategy[],
  initialBalance: number,
  columns: CustomExportColumn[]
): string => {
  const strategyById = new Map(strategies.map((strategy) => [strategy.id, strategy]))
  let balance = initialBalance
  const lines = [csvJoin(columns.map((column) => column.label))]

  for (const journal of journalsOldestFirst) {
    const strategy = strategyById.get(journal.strategyId)
    const pnl = computeTradePnl(balance, journal, strategy)
    balance += pnl

    const cells = columns.map((column) => {
      switch (column.kind) {
        case 'createdAt':
          return journal.createdAt
        case 'strategy':
          return strategy?.name ?? ''
        case 'side':
          return getBuiltinString(journal, strategy, 'side')
        case 'result':
          return getBuiltinString(journal, strategy, 'result')
        case 'symbol':
          return getBuiltinString(journal, strategy, 'symbol')
        case 'tradeDate':
          return getBuiltinString(journal, strategy, 'tradeDate')
        case 'reward':
          return getBuiltinString(journal, strategy, 'reward')
        case 'maxReward':
          return getBuiltinString(journal, strategy, 'maxReward')
        case 'risk': {
          const risk = getBuiltinString(journal, strategy, 'risk')
          return risk ? `${risk}%` : ''
        }
        case 'pnl':
          return String(Number(pnl.toFixed(2)))
        case 'description':
          return getBuiltinString(journal, strategy, 'description')
        case 'field': {
          const field = strategy?.fields.find((item) => item.key === column.fieldKey)
          return formatFieldCell(field, column.fieldKey ? journal.values[column.fieldKey] : undefined)
        }
        default:
          return ''
      }
    })

    lines.push(csvJoin(cells))
  }

  return `${lines.join('\n')}\n`
}

export const suggestExportFilename = (accountName: string, format: ExportFormatId): string => {
  const safe = accountName.replace(/[^\w\u0600-\u06FF-]+/g, '_').slice(0, 40) || 'account'
  const stamp = new Date().toISOString().slice(0, 10)
  if (format === 'metatrader') return `${safe}_MT_History_${stamp}.csv`
  return `${safe}_SkyJournal_${stamp}.csv`
}
