export type FieldType =
  | 'segmented'
  | 'stackedButtons'
  | 'radioRow'
  | 'checkboxRow'
  | 'checkboxColumn'
  | 'select'
  | 'multiSelect'
  | 'input'
  | 'textarea'
  | 'combobox'
  | 'date'

export type BuiltinKey =
  | 'side'
  | 'result'
  | 'symbol'
  | 'tradeDate'
  | 'reward'
  | 'maxReward'
  | 'risk'
  | 'description'

export type FieldOption = { id: string; label: string }

export type FieldDefinition = {
  id: string
  key: string
  label: string
  type: FieldType
  options: FieldOption[]
  enabled: boolean
  builtin: boolean
  builtinKey?: BuiltinKey
}

export type Strategy = {
  id: string
  name: string
  fields: FieldDefinition[]
  createdAt: string
  updatedAt: string
}

export type Account = {
  id: string
  name: string
  initialBalance: number
  /** Running balance after applying all trades in chronological order. */
  currentBalance: number
  targetPercent: number | null
  strategyIds: string[]
  fixedRisk: boolean
  fixedRiskValue: string | null
  createdAt: string
  updatedAt: string
}

export type JournalImage = {
  id: string
  relativePath: string
  sortOrder: number
  dataUrl: string
}

export type Journal = {
  id: string
  accountId: string
  strategyId: string
  values: Record<string, string | string[]>
  riskFixed: boolean
  createdAt: string
  updatedAt: string
  images: JournalImage[]
}

export type SymbolItem = { id: string; label: string }

export type StrategyInput = { name: string; fields: FieldDefinition[] }

export type AccountInput = {
  name: string
  initialBalance: number
  targetPercent: number | null
  strategyIds: string[]
}

export type JournalImageInput = { id: string; dataBase64: string; mime: string }

export type JournalInput = {
  accountId: string
  strategyId: string
  values: Record<string, string | string[]>
  riskFixed: boolean
  images: JournalImageInput[]
}

export type PendingImage = { id: string; dataUrl: string; mime: string }

export const TARGET_PERCENTS = [5, 8, 10, 15, 20, 25] as const
