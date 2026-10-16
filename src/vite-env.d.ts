/// <reference types="vite/client" />

import type { BackupImportMode, BackupImportResult } from '@/lib/backup'
import type {
  PhotoImportResult,
  PhotoImportScanResult,
  PhotoImportSharedInput
} from '@/lib/photoImport'
import type {
  Account,
  AccountInput,
  Journal,
  JournalInput,
  Strategy,
  StrategyInput,
  SymbolItem
} from '@/lib/types'

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface SkyJournalApi {
  strategies: {
    list: () => Promise<IpcResult<Strategy[]>>
    create: (input: StrategyInput) => Promise<IpcResult<Strategy>>
    update: (id: string, input: StrategyInput) => Promise<IpcResult<Strategy>>
    delete: (id: string) => Promise<IpcResult<void>>
  }
  accounts: {
    list: () => Promise<IpcResult<Account[]>>
    create: (input: AccountInput) => Promise<IpcResult<Account>>
    update: (id: string, input: AccountInput) => Promise<IpcResult<Account>>
    delete: (id: string) => Promise<IpcResult<void>>
  }
  symbols: {
    list: () => Promise<IpcResult<SymbolItem[]>>
    create: (label: string) => Promise<IpcResult<SymbolItem>>
    delete: (id: string) => Promise<IpcResult<void>>
  }
  journals: {
    list: (accountId: string) => Promise<IpcResult<Journal[]>>
    get: (id: string) => Promise<IpcResult<Journal | null>>
    create: (input: JournalInput) => Promise<IpcResult<Journal>>
    update: (id: string, input: JournalInput) => Promise<IpcResult<Journal>>
    delete: (id: string) => Promise<IpcResult<void>>
  }
  export: {
    saveTextFile: (
      defaultFileName: string,
      content: string
    ) => Promise<IpcResult<string | null>>
  }
  backup: {
    export: () => Promise<IpcResult<string | null>>
    import: (mode: BackupImportMode) => Promise<IpcResult<BackupImportResult | null>>
  }
  photoImport: {
    selectDirectory: () => Promise<IpcResult<string | null>>
    scanDirectory: (rootPath: string) => Promise<IpcResult<PhotoImportScanResult>>
    importTrades: (input: PhotoImportSharedInput) => Promise<IpcResult<PhotoImportResult>>
  }
}

declare global {
  interface Window {
    /** Injected by electron/preload via contextBridge; absent outside Electron. */
    api?: SkyJournalApi
  }
}

export {}
