import { BrowserWindow, dialog } from 'electron'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, extname, join } from 'path'
import type { FieldDefinition, JournalImageInput, Strategy } from '../../src/lib/types'
import {
  compareTradeFolders,
  markDuplicateTradeIndexes,
  parseTradeFolderName,
  type PhotoImportFolderPreview,
  type PhotoImportResult,
  type PhotoImportScanResult,
  type PhotoImportSharedInput
} from '../../src/lib/photoImport'
import { createJournal, createSymbol, listSymbols, listStrategies } from './db'

const IMAGE_EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
}

const getDialogParent = (): BrowserWindow | undefined =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]

const isImageFile = (fileName: string): boolean => {
  const ext = extname(fileName).toLowerCase()
  return Boolean(IMAGE_EXT_TO_MIME[ext])
}

const listImageFiles = (folderPath: string): string[] => {
  const entries = readdirSync(folderPath)
  return entries
    .filter((name) => {
      if (name.startsWith('.')) return false
      const full = join(folderPath, name)
      try {
        return statSync(full).isFile() && isImageFile(name)
      } catch {
        return false
      }
    })
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .map((name) => join(folderPath, name))
}

const loadImagesAsInputs = (imagePaths: string[]): JournalImageInput[] => {
  const images: JournalImageInput[] = []
  for (const imagePath of imagePaths) {
    const ext = extname(imagePath).toLowerCase()
    const mime = IMAGE_EXT_TO_MIME[ext]
    if (!mime) continue
    const buffer = readFileSync(imagePath)
    images.push({
      id: crypto.randomUUID(),
      mime,
      dataBase64: buffer.toString('base64')
    })
  }
  return images
}

const findBuiltinField = (
  fields: FieldDefinition[],
  builtinKey: string
): FieldDefinition | undefined => fields.find((field) => field.builtinKey === builtinKey)

const buildJournalValues = (
  strategy: Strategy,
  shared: Pick<PhotoImportSharedInput, 'symbol' | 'risk'>,
  parsed: ReturnType<typeof parseTradeFolderName>
): Record<string, string | string[]> => {
  const values: Record<string, string | string[]> = {}

  for (const field of strategy.fields) {
    if (
      field.type === 'multiSelect' ||
      field.type === 'checkboxRow' ||
      field.type === 'checkboxColumn'
    ) {
      values[field.key] = []
      continue
    }
    values[field.key] = ''
  }

  const setBuiltin = (builtinKey: string, value: string) => {
    const field = findBuiltinField(strategy.fields, builtinKey)
    if (field) values[field.key] = value
  }

  setBuiltin('symbol', shared.symbol.trim())
  setBuiltin('risk', shared.risk.trim())
  setBuiltin('reward', parsed.reward)
  setBuiltin('result', parsed.result)
  if (parsed.side) {
    setBuiltin('side', parsed.side)
  }

  return values
}

const ensureSymbolExists = (label: string): void => {
  const trimmed = label.trim()
  if (!trimmed) return
  const existing = listSymbols()
  const found = existing.some(
    (symbol) => symbol.label.toLowerCase() === trimmed.toLowerCase()
  )
  if (!found) {
    createSymbol(trimmed)
  }
}

const previewFolder = (folderPath: string): PhotoImportFolderPreview => {
  const folderName = basename(folderPath)
  const parsed = parseTradeFolderName(folderName)
  let imagePaths: string[] = []
  try {
    imagePaths = listImageFiles(folderPath)
  } catch {
    return {
      folderName,
      folderPath,
      tradeIndex: parsed.tradeIndex,
      reward: parsed.error ? null : parsed.reward,
      result: parsed.error ? null : parsed.result,
      side: parsed.error ? null : parsed.side,
      imageCount: 0,
      imagePaths: [],
      error: parsed.error ?? 'خواندن محتویات پوشه ممکن نشد.'
    }
  }

  return {
    folderName,
    folderPath,
    tradeIndex: parsed.tradeIndex,
    reward: parsed.error ? null : parsed.reward,
    result: parsed.error ? null : parsed.result,
    side: parsed.error ? null : parsed.side,
    imageCount: imagePaths.length,
    imagePaths,
    error: parsed.error
  }
}

export const selectPhotoImportDirectory = async (): Promise<string | null> => {
  const parent = getDialogParent()
  const options = {
    title: 'انتخاب پوشه ریشه معاملات',
    properties: ['openDirectory' as const]
  }
  const result = parent
    ? await dialog.showOpenDialog(parent, options)
    : await dialog.showOpenDialog(options)

  if (result.canceled || result.filePaths.length === 0) return null
  return result.filePaths[0]
}

export const scanPhotoImportDirectory = (rootPath: string): PhotoImportScanResult => {
  const trimmed = rootPath.trim()
  if (!trimmed) {
    throw new Error('مسیر پوشه ریشه مشخص نشده است.')
  }
  if (!existsSync(trimmed)) {
    throw new Error('پوشه ریشه یافت نشد.')
  }
  const rootStat = statSync(trimmed)
  if (!rootStat.isDirectory()) {
    throw new Error('مسیر انتخاب‌شده یک پوشه نیست.')
  }

  const entries = readdirSync(trimmed)
  const folders: PhotoImportFolderPreview[] = []

  for (const name of entries) {
    if (name.startsWith('.')) continue
    const full = join(trimmed, name)
    let isDir = false
    try {
      isDir = statSync(full).isDirectory()
    } catch {
      continue
    }
    if (!isDir) continue
    folders.push(previewFolder(full))
  }

  markDuplicateTradeIndexes(folders)
  folders.sort(compareTradeFolders)

  return { rootPath: trimmed, folders }
}

export const importTradesFromPhotoFolders = (
  input: PhotoImportSharedInput
): PhotoImportResult => {
  if (!input.accountId?.trim()) {
    throw new Error('حساب انتخاب نشده است.')
  }
  if (!input.strategyId?.trim()) {
    throw new Error('استراتژی انتخاب نشده است.')
  }
  if (!input.symbol?.trim()) {
    throw new Error('نماد مشترک الزامی است.')
  }
  if (!input.risk?.trim()) {
    throw new Error('ریسک مشترک الزامی است.')
  }
  if (!Array.isArray(input.folderPaths) || input.folderPaths.length === 0) {
    throw new Error('هیچ پوشه معتبری برای درون‌ریزی انتخاب نشده است.')
  }

  const strategies = listStrategies()
  const strategy = strategies.find((item) => item.id === input.strategyId)
  if (!strategy) {
    throw new Error('استراتژی یافت نشد.')
  }

  ensureSymbolExists(input.symbol)

  const result: PhotoImportResult = {
    imported: 0,
    skipped: 0,
    errors: []
  }

  const indexed = input.folderPaths.map((folderPath) => {
    const folderName = basename(folderPath)
    return {
      folderPath,
      folderName,
      parsed: parseTradeFolderName(folderName)
    }
  })

  const indexCounts = new Map<number, number>()
  for (const item of indexed) {
    if (item.parsed.error || item.parsed.tradeIndex == null) continue
    indexCounts.set(item.parsed.tradeIndex, (indexCounts.get(item.parsed.tradeIndex) ?? 0) + 1)
  }

  const ordered = [...indexed].sort((a, b) =>
    compareTradeFolders(
      { tradeIndex: a.parsed.tradeIndex, folderName: a.folderName },
      { tradeIndex: b.parsed.tradeIndex, folderName: b.folderName }
    )
  )

  const createdAtBase = Date.now()
  let createdCount = 0

  for (const item of ordered) {
    const { folderPath, folderName, parsed } = item
    try {
      if (!existsSync(folderPath) || !statSync(folderPath).isDirectory()) {
        result.skipped += 1
        result.errors.push({
          folderName,
          message: 'پوشه یافت نشد یا معتبر نیست.'
        })
        continue
      }

      if (parsed.error) {
        result.skipped += 1
        result.errors.push({ folderName, message: parsed.error })
        continue
      }

      if (parsed.tradeIndex != null && (indexCounts.get(parsed.tradeIndex) ?? 0) > 1) {
        result.skipped += 1
        result.errors.push({
          folderName,
          message: `شماره معامله ${parsed.tradeIndex.toLocaleString('fa-IR')} تکراری است.`
        })
        continue
      }

      const imagePaths = listImageFiles(folderPath)
      const images = loadImagesAsInputs(imagePaths)
      const values = buildJournalValues(strategy, input, parsed)

      createJournal(
        {
          accountId: input.accountId,
          strategyId: input.strategyId,
          values,
          riskFixed: Boolean(input.riskFixed),
          images
        },
        new Date(createdAtBase + createdCount).toISOString()
      )
      createdCount += 1
      result.imported += 1
    } catch (error) {
      result.skipped += 1
      result.errors.push({
        folderName,
        message: error instanceof Error ? error.message : 'درون‌ریزی این پوشه ناموفق بود.'
      })
    }
  }

  return result
}
