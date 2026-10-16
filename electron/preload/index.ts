import { contextBridge, ipcRenderer } from 'electron'
import type { BackupImportMode, BackupImportResult } from '../../src/lib/backup'
import type {
  PhotoImportResult,
  PhotoImportScanResult,
  PhotoImportSharedInput
} from '../../src/lib/photoImport'
import type {
  Account,
  AccountInput,
  Journal,
  JournalInput,
  Strategy,
  StrategyInput,
  SymbolItem
} from '../../src/lib/types'

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>

const api = {
  strategies: {
    list: (): Promise<IpcResult<Strategy[]>> => invoke('strategies:list'),
    create: (input: StrategyInput): Promise<IpcResult<Strategy>> =>
      invoke('strategies:create', input),
    update: (id: string, input: StrategyInput): Promise<IpcResult<Strategy>> =>
      invoke('strategies:update', id, input),
    delete: (id: string): Promise<IpcResult<void>> => invoke('strategies:delete', id)
  },
  accounts: {
    list: (): Promise<IpcResult<Account[]>> => invoke('accounts:list'),
    create: (input: AccountInput): Promise<IpcResult<Account>> =>
      invoke('accounts:create', input),
    update: (id: string, input: AccountInput): Promise<IpcResult<Account>> =>
      invoke('accounts:update', id, input),
    delete: (id: string): Promise<IpcResult<void>> => invoke('accounts:delete', id)
  },
  symbols: {
    list: (): Promise<IpcResult<SymbolItem[]>> => invoke('symbols:list'),
    create: (label: string): Promise<IpcResult<SymbolItem>> => invoke('symbols:create', label),
    delete: (id: string): Promise<IpcResult<void>> => invoke('symbols:delete', id)
  },
  journals: {
    list: (accountId: string): Promise<IpcResult<Journal[]>> =>
      invoke('journals:list', accountId),
    get: (id: string): Promise<IpcResult<Journal | null>> => invoke('journals:get', id),
    create: (input: JournalInput): Promise<IpcResult<Journal>> =>
      invoke('journals:create', input),
    update: (id: string, input: JournalInput): Promise<IpcResult<Journal>> =>
      invoke('journals:update', id, input),
    delete: (id: string): Promise<IpcResult<void>> => invoke('journals:delete', id)
  },
  export: {
    saveTextFile: (defaultFileName: string, content: string): Promise<IpcResult<string | null>> =>
      invoke('export:saveTextFile', defaultFileName, content)
  },
  backup: {
    export: (): Promise<IpcResult<string | null>> => invoke('backup:export'),
    import: (mode: BackupImportMode): Promise<IpcResult<BackupImportResult | null>> =>
      invoke('backup:import', mode)
  },
  photoImport: {
    selectDirectory: (): Promise<IpcResult<string | null>> =>
      invoke('photoImport:selectDirectory'),
    scanDirectory: (rootPath: string): Promise<IpcResult<PhotoImportScanResult>> =>
      invoke('photoImport:scanDirectory', rootPath),
    importTrades: (input: PhotoImportSharedInput): Promise<IpcResult<PhotoImportResult>> =>
      invoke('photoImport:importTrades', input)
  }
}

contextBridge.exposeInMainWorld('api', api)
