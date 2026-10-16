/** Shared SkyJournal backup format constants and types. */

export const BACKUP_APP_ID = 'skyjournal' as const
export const BACKUP_FORMAT_VERSION = 1 as const
export const BACKUP_FILE_EXTENSION = 'skyjournal' as const

export type BackupImportMode = 'merge' | 'replace'

export type BackupManifest = {
  formatVersion: number
  appId: typeof BACKUP_APP_ID
  exportedAt: string
}

export type BackupSymbolRow = {
  id: string
  label: string
  createdAt: string
}

export type BackupStrategyRow = {
  id: string
  name: string
  fields: unknown
  createdAt: string
  updatedAt: string
}

export type BackupAccountRow = {
  id: string
  name: string
  initialBalance: number
  currentBalance: number
  targetPercent: number | null
  fixedRisk: boolean
  fixedRiskValue: string | null
  strategyIds: string[]
  createdAt: string
  updatedAt: string
}

export type BackupJournalImageRow = {
  id: string
  /** Path inside the archive and relative to userData after restore, e.g. images/<id>.png */
  relativePath: string
  sortOrder: number
}

export type BackupJournalRow = {
  id: string
  accountId: string
  strategyId: string
  values: Record<string, string | string[]>
  riskFixed: boolean
  createdAt: string
  updatedAt: string
  images: BackupJournalImageRow[]
}

export type BackupData = {
  symbols: BackupSymbolRow[]
  strategies: BackupStrategyRow[]
  accounts: BackupAccountRow[]
  journals: BackupJournalRow[]
}

export type BackupImportCounts = {
  symbols: number
  strategies: number
  accounts: number
  journals: number
  images: number
}

export type BackupImportResult = {
  mode: BackupImportMode
  counts: BackupImportCounts
}
