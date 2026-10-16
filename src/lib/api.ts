import type { BackupImportMode, BackupImportResult } from './backup'
import type {
  PhotoImportResult,
  PhotoImportScanResult,
  PhotoImportSharedInput
} from './photoImport'
import type {
  Account,
  AccountInput,
  Journal,
  JournalInput,
  Strategy,
  StrategyInput,
  SymbolItem
} from './types'

type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

const unwrap = <T>(result: IpcResult<T>): T => {
  if (!result.ok) {
    throw new Error(result.error)
  }
  return result.data
}

const getBridge = (): NonNullable<Window['api']> => {
  const bridge = window.api
  if (!bridge) {
    throw new Error(
      'Electron API bridge (window.api) is unavailable. Run the app with npm run dev (Electron), not a plain browser tab.'
    )
  }
  return bridge
}

export const api = {
  strategies: {
    list: async (): Promise<Strategy[]> => unwrap(await getBridge().strategies.list()),
    create: async (input: StrategyInput): Promise<Strategy> =>
      unwrap(await getBridge().strategies.create(input)),
    update: async (id: string, input: StrategyInput): Promise<Strategy> =>
      unwrap(await getBridge().strategies.update(id, input)),
    delete: async (id: string): Promise<void> => unwrap(await getBridge().strategies.delete(id))
  },
  accounts: {
    list: async (): Promise<Account[]> => unwrap(await getBridge().accounts.list()),
    create: async (input: AccountInput): Promise<Account> =>
      unwrap(await getBridge().accounts.create(input)),
    update: async (id: string, input: AccountInput): Promise<Account> =>
      unwrap(await getBridge().accounts.update(id, input)),
    delete: async (id: string): Promise<void> => unwrap(await getBridge().accounts.delete(id))
  },
  symbols: {
    list: async (): Promise<SymbolItem[]> => unwrap(await getBridge().symbols.list()),
    create: async (label: string): Promise<SymbolItem> =>
      unwrap(await getBridge().symbols.create(label)),
    delete: async (id: string): Promise<void> => unwrap(await getBridge().symbols.delete(id))
  },
  journals: {
    list: async (accountId: string): Promise<Journal[]> =>
      unwrap(await getBridge().journals.list(accountId)),
    get: async (id: string): Promise<Journal | null> => unwrap(await getBridge().journals.get(id)),
    create: async (input: JournalInput): Promise<Journal> =>
      unwrap(await getBridge().journals.create(input)),
    update: async (id: string, input: JournalInput): Promise<Journal> =>
      unwrap(await getBridge().journals.update(id, input)),
    delete: async (id: string): Promise<void> => unwrap(await getBridge().journals.delete(id))
  },
  export: {
    saveTextFile: async (defaultFileName: string, content: string): Promise<string | null> =>
      unwrap(await getBridge().export.saveTextFile(defaultFileName, content))
  },
  backup: {
    export: async (): Promise<string | null> => unwrap(await getBridge().backup.export()),
    import: async (mode: BackupImportMode): Promise<BackupImportResult | null> =>
      unwrap(await getBridge().backup.import(mode))
  },
  photoImport: {
    selectDirectory: async (): Promise<string | null> =>
      unwrap(await getBridge().photoImport.selectDirectory()),
    scanDirectory: async (rootPath: string): Promise<PhotoImportScanResult> =>
      unwrap(await getBridge().photoImport.scanDirectory(rootPath)),
    importTrades: async (input: PhotoImportSharedInput): Promise<PhotoImportResult> =>
      unwrap(await getBridge().photoImport.importTrades(input))
  }
}
