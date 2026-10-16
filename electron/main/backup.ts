import { BrowserWindow, dialog } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { basename } from 'path'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import {
  BACKUP_APP_ID,
  BACKUP_FILE_EXTENSION,
  BACKUP_FORMAT_VERSION,
  type BackupData,
  type BackupImportMode,
  type BackupImportResult,
  type BackupManifest
} from '../../src/lib/backup'
import { collectBackupData, restoreBackupData } from './db'

const suggestBackupFilename = (): string => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, (ch) =>
    ch === 'T' ? '_' : ch === ':' ? '' : '-'
  )
  return `skyjournal-backup-${stamp}.${BACKUP_FILE_EXTENSION}`
}

const getDialogParent = (): BrowserWindow | undefined =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

const parseManifest = (raw: string): BackupManifest => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('فایل پشتیبان نامعتبر است (manifest.json قابل خواندن نیست).')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('فایل پشتیبان نامعتبر است (manifest.json).')
  }
  const manifest = parsed as Partial<BackupManifest>
  if (manifest.appId !== BACKUP_APP_ID) {
    throw new Error('این فایل متعلق به SkyJournal نیست.')
  }
  if (manifest.formatVersion !== BACKUP_FORMAT_VERSION) {
    throw new Error(
      `نسخه پشتیبان پشتیبانی نمی‌شود (نسخه ${String(manifest.formatVersion)}). نسخه مورد انتظار: ${BACKUP_FORMAT_VERSION}.`
    )
  }
  if (typeof manifest.exportedAt !== 'string' || !manifest.exportedAt) {
    throw new Error('فایل پشتیبان ناقص است (exportedAt).')
  }
  return {
    formatVersion: BACKUP_FORMAT_VERSION,
    appId: BACKUP_APP_ID,
    exportedAt: manifest.exportedAt
  }
}

const parseData = (raw: string): BackupData => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('فایل پشتیبان نامعتبر است (data.json قابل خواندن نیست).')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('فایل پشتیبان نامعتبر است (data.json).')
  }
  const data = parsed as Partial<BackupData>
  if (
    !Array.isArray(data.symbols) ||
    !Array.isArray(data.strategies) ||
    !Array.isArray(data.accounts) ||
    !Array.isArray(data.journals)
  ) {
    throw new Error('ساختار data.json ناقص است.')
  }
  return {
    symbols: data.symbols,
    strategies: data.strategies,
    accounts: data.accounts,
    journals: data.journals
  }
}

const normalizeArchivePath = (path: string): string => path.replace(/\\/g, '/')

export const exportBackup = async (): Promise<string | null> => {
  const { data, imageFiles } = collectBackupData()
  const manifest: BackupManifest = {
    formatVersion: BACKUP_FORMAT_VERSION,
    appId: BACKUP_APP_ID,
    exportedAt: new Date().toISOString()
  }

  const archiveFiles: Record<string, Uint8Array> = {
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    'data.json': strToU8(JSON.stringify(data, null, 2))
  }

  for (const file of imageFiles) {
    const key = normalizeArchivePath(file.archivePath)
    if (!existsAsSafeImagePath(key)) continue
    archiveFiles[key] = new Uint8Array(file.buffer)
  }

  const zipped = zipSync(archiveFiles, { level: 6 })
  const defaultPath = suggestBackupFilename()
  const parent = getDialogParent()
  const result = parent
    ? await dialog.showSaveDialog(parent, {
        title: 'ذخیره پشتیبان SkyJournal',
        defaultPath,
        filters: [
          { name: 'SkyJournal Backup', extensions: [BACKUP_FILE_EXTENSION] },
          { name: 'ZIP', extensions: ['zip'] }
        ]
      })
    : await dialog.showSaveDialog({
        title: 'ذخیره پشتیبان SkyJournal',
        defaultPath,
        filters: [
          { name: 'SkyJournal Backup', extensions: [BACKUP_FILE_EXTENSION] },
          { name: 'ZIP', extensions: ['zip'] }
        ]
      })

  if (result.canceled || !result.filePath) return null
  writeFileSync(result.filePath, Buffer.from(zipped))
  return result.filePath
}

const existsAsSafeImagePath = (path: string): boolean => {
  const normalized = normalizeArchivePath(path)
  if (!normalized.startsWith('images/')) return false
  if (normalized.includes('..')) return false
  const name = basename(normalized)
  return Boolean(name) && name !== '.' && name !== '..'
}

export const importBackup = async (mode: BackupImportMode): Promise<BackupImportResult | null> => {
  if (mode !== 'merge' && mode !== 'replace') {
    throw new Error('حالت درون‌ریزی نامعتبر است.')
  }

  const parent = getDialogParent()
  const result = parent
    ? await dialog.showOpenDialog(parent, {
        title: 'انتخاب فایل پشتیبان SkyJournal',
        properties: ['openFile'],
        filters: [
          { name: 'SkyJournal Backup', extensions: [BACKUP_FILE_EXTENSION, 'zip'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
    : await dialog.showOpenDialog({
        title: 'انتخاب فایل پشتیبان SkyJournal',
        properties: ['openFile'],
        filters: [
          { name: 'SkyJournal Backup', extensions: [BACKUP_FILE_EXTENSION, 'zip'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(new Uint8Array(readFileSync(filePath)))
  } catch {
    throw new Error('باز کردن فایل پشتیبان ممکن نشد. فایل خراب یا فرمت ناشناخته است.')
  }

  const filesByPath: Record<string, Uint8Array> = {}
  for (const [rawPath, bytes] of Object.entries(unzipped)) {
    filesByPath[normalizeArchivePath(rawPath)] = bytes
  }

  const manifestBytes = filesByPath['manifest.json']
  const dataBytes = filesByPath['data.json']
  if (!manifestBytes || !dataBytes) {
    throw new Error('فایل پشتیبان ناقص است (manifest.json یا data.json یافت نشد).')
  }

  parseManifest(strFromU8(manifestBytes))
  const data = parseData(strFromU8(dataBytes))

  const imageBuffers = new Map<string, Buffer>()
  for (const [path, bytes] of Object.entries(filesByPath)) {
    if (!existsAsSafeImagePath(path)) continue
    imageBuffers.set(path, Buffer.from(bytes))
  }

  const counts = restoreBackupData(data, imageBuffers, mode)
  return { mode, counts }
}
