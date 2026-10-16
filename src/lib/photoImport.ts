/** Shared types and folder-name parsing for photo-folder trade import. */

export type TradeSideId = 'buy' | 'sell' | 'unknown'
export type TradeResultId = 'profit' | 'loss' | 'risk_free'

export type ParsedFolderName = {
  tradeIndex: number | null
  reward: string
  result: TradeResultId
  side: TradeSideId | null
  error: string | null
}

export type PhotoImportFolderPreview = {
  folderName: string
  folderPath: string
  tradeIndex: number | null
  reward: string | null
  result: TradeResultId | null
  side: TradeSideId | null
  imageCount: number
  imagePaths: string[]
  error: string | null
}

export type PhotoImportScanResult = {
  rootPath: string
  folders: PhotoImportFolderPreview[]
}

export type PhotoImportSharedInput = {
  accountId: string
  strategyId: string
  symbol: string
  risk: string
  riskFixed: boolean
  /** Absolute paths of valid trade folders to import. */
  folderPaths: string[]
}

export type PhotoImportErrorItem = {
  folderName: string
  message: string
}

export type PhotoImportResult = {
  imported: number
  skipped: number
  errors: PhotoImportErrorItem[]
}

const SIDE_ALIASES: Record<string, TradeSideId> = {
  buy: 'buy',
  sell: 'sell',
  unknown: 'unknown',
  خرید: 'buy',
  فروش: 'sell',
  نامشخص: 'unknown'
}

const formatRewardMagnitude = (absolute: number): string => {
  if (!Number.isFinite(absolute)) return '0'
  const rounded = Math.round(absolute * 1000) / 1000
  if (Number.isInteger(rounded)) return String(rounded)
  return String(rounded)
}

const mapSide = (raw: string): TradeSideId | null => {
  const key = raw.trim().toLowerCase()
  if (!key) return null
  const fromLower = SIDE_ALIASES[key]
  if (fromLower) return fromLower
  return SIDE_ALIASES[raw.trim()] ?? null
}

const emptyParse = (error: string, partial?: Partial<ParsedFolderName>): ParsedFolderName => ({
  tradeIndex: partial?.tradeIndex ?? null,
  reward: partial?.reward ?? '',
  result: partial?.result ?? 'risk_free',
  side: partial?.side ?? null,
  error
})

/**
 * Parse a trade subfolder name.
 * Format: `index.reward` or `index.reward.side`
 * Examples: `1.+3`, `2.3.sell`, `3.-1`, `4.-0.5.buy`
 */
export const parseTradeFolderName = (folderName: string): ParsedFolderName => {
  const trimmed = folderName.trim()
  if (!trimmed) {
    return emptyParse('نام پوشه خالی است.')
  }

  const match = /^(\d+)\.([+-]?\d+(?:\.\d+)?)(?:\.(.+))?$/.exec(trimmed)
  if (!match) {
    return emptyParse('نام پوشه باید به شکل شماره.ریوارد باشد. مثال: 1.+3 یا 1.+3.buy')
  }

  const tradeIndex = Number(match[1])
  if (!Number.isInteger(tradeIndex) || tradeIndex < 1) {
    return emptyParse('شماره معامله باید عدد صحیح بزرگ‌تر از صفر باشد.')
  }

  const rewardRaw = match[2] ?? ''
  const signed = Number(rewardRaw)
  if (!Number.isFinite(signed)) {
    return emptyParse(`ریوارد در نام پوشه نامعتبر است: «${rewardRaw}».`, { tradeIndex })
  }

  const reward = formatRewardMagnitude(Math.abs(signed))
  const result: TradeResultId = signed < 0 ? 'loss' : signed > 0 ? 'profit' : 'risk_free'
  const sideRaw = (match[3] ?? '').trim()
  if (!sideRaw) {
    return { tradeIndex, reward, result, side: null, error: null }
  }

  const side = mapSide(sideRaw)
  if (side !== 'buy' && side !== 'sell') {
    return emptyParse(`نوع معامله نامعتبر است: «${sideRaw}». مقادیر مجاز: buy یا sell.`, {
      tradeIndex,
      reward,
      result
    })
  }

  return { tradeIndex, reward, result, side, error: null }
}

export const compareTradeFolders = (
  a: { tradeIndex: number | null; folderName: string },
  b: { tradeIndex: number | null; folderName: string }
): number => {
  if (a.tradeIndex != null && b.tradeIndex != null && a.tradeIndex !== b.tradeIndex) {
    return a.tradeIndex - b.tradeIndex
  }
  if (a.tradeIndex != null && b.tradeIndex == null) return -1
  if (a.tradeIndex == null && b.tradeIndex != null) return 1
  return a.folderName.localeCompare(b.folderName, undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

export const markDuplicateTradeIndexes = (folders: PhotoImportFolderPreview[]): void => {
  const counts = new Map<number, number>()
  for (const folder of folders) {
    if (folder.error || folder.tradeIndex == null) continue
    counts.set(folder.tradeIndex, (counts.get(folder.tradeIndex) ?? 0) + 1)
  }

  for (const folder of folders) {
    if (folder.error || folder.tradeIndex == null) continue
    if ((counts.get(folder.tradeIndex) ?? 0) < 2) continue
    folder.error = `شماره معامله ${folder.tradeIndex.toLocaleString('fa-IR')} تکراری است.`
  }
}

export const resultLabelFa = (result: TradeResultId | null): string => {
  if (result === 'profit') return 'سود'
  if (result === 'loss') return 'ضرر'
  if (result === 'risk_free') return 'ریسک‌فری'
  return '—'
}

export const sideLabelFa = (side: TradeSideId | null): string => {
  if (side === 'buy') return 'خرید'
  if (side === 'sell') return 'فروش'
  if (side === 'unknown') return 'نامشخص'
  return '—'
}
