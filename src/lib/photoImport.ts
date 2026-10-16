/** Shared types and folder-name parsing for photo-folder trade import. */

export type TradeSideId = 'buy' | 'sell' | 'unknown'
export type TradeResultId = 'profit' | 'loss' | 'risk_free'

export type ParsedFolderName = {
  reward: string
  result: TradeResultId
  side: TradeSideId | null
  error: string | null
}

export type PhotoImportFolderPreview = {
  folderName: string
  folderPath: string
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

/**
 * Parse a trade subfolder name.
 * Format: `reward` or `reward|side` (fields separated by `|`).
 * Examples: `-1|buy`, `+3|sell`, `2`, `-1.5|خرید`
 */
export const parseTradeFolderName = (folderName: string): ParsedFolderName => {
  const trimmed = folderName.trim()
  if (!trimmed) {
    return {
      reward: '',
      result: 'risk_free',
      side: null,
      error: 'نام پوشه خالی است.'
    }
  }

  const parts = trimmed.split('|').map((part) => part.trim())
  if (parts.length > 2) {
    return {
      reward: '',
      result: 'risk_free',
      side: null,
      error: 'نام پوشه باید حداکثر دو بخش داشته باشد (ریوارد|نوع معامله).'
    }
  }

  const rewardRaw = parts[0] ?? ''
  const match = /^([+-]?)(\d+(?:\.\d+)?)$/.exec(rewardRaw)
  if (!match) {
    return {
      reward: '',
      result: 'risk_free',
      side: null,
      error: `ریوارد در نام پوشه نامعتبر است: «${rewardRaw}». مثال‌ها: -1|+3|2`
    }
  }

  const signed = Number(`${match[1]}${match[2]}`)
  if (!Number.isFinite(signed)) {
    return {
      reward: '',
      result: 'risk_free',
      side: null,
      error: `ریوارد در نام پوشه نامعتبر است: «${rewardRaw}».`
    }
  }

  const absolute = Math.abs(signed)
  const reward = formatRewardMagnitude(absolute)

  let result: TradeResultId
  if (signed < 0) result = 'loss'
  else if (signed > 0) result = 'profit'
  else result = 'risk_free'

  let side: TradeSideId | null = null
  if (parts.length === 2 && parts[1]) {
    side = mapSide(parts[1])
    if (!side) {
      return {
        reward,
        result,
        side: null,
        error: `نوع معامله نامعتبر است: «${parts[1]}». مقادیر مجاز: buy/sell یا خرید/فروش.`
      }
    }
  }

  return { reward, result, side, error: null }
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
