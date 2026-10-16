import { ipcMain } from 'electron'
import type { BackupImportMode, BackupImportResult } from '../../src/lib/backup'
import type { PhotoImportSharedInput } from '../../src/lib/photoImport'
import type { AccountInput, JournalInput, StrategyInput } from '../../src/lib/types'
import { exportBackup, importBackup } from './backup'
import {
  createAccount,
  createJournal,
  createStrategy,
  createSymbol,
  deleteAccount,
  deleteJournal,
  deleteStrategy,
  deleteSymbol,
  getJournal,
  listAccounts,
  listJournals,
  listStrategies,
  listSymbols,
  updateAccount,
  updateJournal,
  updateStrategy
} from './db'
import { saveTextFile } from './exportFile'
import {
  importTradesFromPhotoFolders,
  scanPhotoImportDirectory,
  selectPhotoImportDirectory
} from './photoImport'

export type IpcResult<T> = { ok: true; data: T } | { ok: false; error: string }

const handle = <T>(fn: () => T): IpcResult<T> => {
  try {
    return { ok: true, data: fn() }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته رخ داد.'
    return { ok: false, error: message }
  }
}

const handleAsync = async <T>(fn: () => Promise<T>): Promise<IpcResult<T>> => {
  try {
    return { ok: true, data: await fn() }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'خطای ناشناخته رخ داد.'
    return { ok: false, error: message }
  }
}

/** Idempotent registration so main-process reloads do not leave channels missing. */
const registerHandler = (channel: string, listener: (...args: any[]) => unknown): void => {
  ipcMain.removeHandler(channel)
  ipcMain.handle(channel, listener)
}

export const registerBackupHandlers = (): void => {
  registerHandler('backup:export', () => handleAsync(() => exportBackup()))
  registerHandler('backup:import', (_e, mode: BackupImportMode) =>
    handleAsync((): Promise<BackupImportResult | null> => importBackup(mode))
  )
}

export const registerPhotoImportHandlers = (): void => {
  registerHandler('photoImport:selectDirectory', () =>
    handleAsync(() => selectPhotoImportDirectory())
  )
  registerHandler('photoImport:scanDirectory', (_e, rootPath: string) =>
    handle(() => scanPhotoImportDirectory(rootPath))
  )
  registerHandler('photoImport:importTrades', (_e, input: PhotoImportSharedInput) =>
    handle(() => importTradesFromPhotoFolders(input))
  )
}

export const registerIpcHandlers = (): void => {
  registerHandler('strategies:list', () => handle(() => listStrategies()))
  registerHandler('strategies:create', (_e, input: StrategyInput) =>
    handle(() => createStrategy(input))
  )
  registerHandler('strategies:update', (_e, id: string, input: StrategyInput) =>
    handle(() => updateStrategy(id, input))
  )
  registerHandler('strategies:delete', (_e, id: string) =>
    handle(() => {
      deleteStrategy(id)
    })
  )

  registerHandler('accounts:list', () => handle(() => listAccounts()))
  registerHandler('accounts:create', (_e, input: AccountInput) =>
    handle(() => createAccount(input))
  )
  registerHandler('accounts:update', (_e, id: string, input: AccountInput) =>
    handle(() => updateAccount(id, input))
  )
  registerHandler('accounts:delete', (_e, id: string) =>
    handle(() => {
      deleteAccount(id)
    })
  )

  registerHandler('symbols:list', () => handle(() => listSymbols()))
  registerHandler('symbols:create', (_e, label: string) => handle(() => createSymbol(label)))
  registerHandler('symbols:delete', (_e, id: string) =>
    handle(() => {
      deleteSymbol(id)
    })
  )

  registerHandler('journals:list', (_e, accountId: string) =>
    handle(() => listJournals(accountId))
  )
  registerHandler('journals:get', (_e, id: string) => handle(() => getJournal(id)))
  registerHandler('journals:create', (_e, input: JournalInput) =>
    handle(() => createJournal(input))
  )
  registerHandler('journals:update', (_e, id: string, input: JournalInput) =>
    handle(() => updateJournal(id, input))
  )
  registerHandler('journals:delete', (_e, id: string) =>
    handle(() => {
      deleteJournal(id)
    })
  )

  registerHandler('export:saveTextFile', (_e, defaultFileName: string, content: string) =>
    handleAsync(() => saveTextFile(defaultFileName, content))
  )

  registerBackupHandlers()
  registerPhotoImportHandlers()
}
