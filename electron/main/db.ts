import Database from 'better-sqlite3'
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import type {
  Account,
  AccountInput,
  FieldDefinition,
  FieldType,
  Journal,
  JournalImage,
  JournalImageInput,
  JournalInput,
  Strategy,
  StrategyInput,
  SymbolItem
} from '../../src/lib/types'
import type {
  BackupAccountRow,
  BackupData,
  BackupImportCounts,
  BackupImportMode,
  BackupJournalImageRow,
  BackupJournalRow,
  BackupStrategyRow,
  BackupSymbolRow
} from '../../src/lib/backup'
import { TARGET_PERCENTS } from '../../src/lib/types'
import {
  enqueueBalanceRecalc,
  recalculateAccountBalance,
  registerBalanceHooks
} from './balanceJob'

const FIELD_TYPES: FieldType[] = [
  'segmented',
  'stackedButtons',
  'radioRow',
  'checkboxRow',
  'checkboxColumn',
  'select',
  'multiSelect',
  'input',
  'textarea',
  'combobox',
  'date'
]

const ALLOWED_MIMES: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
}

let db: Database.Database
let imagesDir: string
let userDataPath: string

export const initDb = (): void => {
  userDataPath = app.getPath('userData')
  const dbPath = join(userDataPath, 'skyjournal.sqlite')
  imagesDir = join(userDataPath, 'images')

  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true })
  }

  db = new Database(dbPath)
  db.pragma('foreign_keys = ON')
  db.pragma('journal_mode = WAL')

  db.exec(`
    CREATE TABLE IF NOT EXISTS symbols (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL COLLATE NOCASE UNIQUE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      fields_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      initial_balance REAL NOT NULL,
      current_balance REAL NOT NULL DEFAULT 0,
      target_percent REAL,
      fixed_risk INTEGER NOT NULL DEFAULT 1,
      fixed_risk_value TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_strategies (
      account_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      PRIMARY KEY (account_id, strategy_id),
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS journals (
      id TEXT PRIMARY KEY,
      account_id TEXT NOT NULL,
      strategy_id TEXT NOT NULL,
      values_json TEXT NOT NULL,
      risk_fixed INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
      FOREIGN KEY (strategy_id) REFERENCES strategies(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS journal_images (
      id TEXT PRIMARY KEY,
      journal_id TEXT NOT NULL,
      relative_path TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      FOREIGN KEY (journal_id) REFERENCES journals(id) ON DELETE CASCADE
    );
  `)

  migrateAccountsCurrentBalance()
  migrateStrategiesTradeDate()

  registerBalanceHooks({
    getAccountInitialBalance: (accountId) => {
      const row = db
        .prepare('SELECT initial_balance FROM accounts WHERE id = ?')
        .get(accountId) as { initial_balance: number } | undefined
      return row ? row.initial_balance : null
    },
    listJournalsOldestFirst: (accountId) => listJournalsForBalance(accountId),
    listStrategies: () => listStrategies(),
    setAccountCurrentBalance: (accountId, balance) => {
      db.prepare('UPDATE accounts SET current_balance = ?, updated_at = ? WHERE id = ?').run(
        balance,
        nowIso(),
        accountId
      )
    }
  })

  const accountIds = db.prepare('SELECT id FROM accounts').all() as { id: string }[]
  for (const row of accountIds) {
    enqueueBalanceRecalc(row.id)
  }
}

const tableHasColumn = (table: string, column: string): boolean => {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
  return rows.some((row) => row.name === column)
}

const migrateAccountsCurrentBalance = (): void => {
  if (tableHasColumn('accounts', 'current_balance')) return
  db.exec('ALTER TABLE accounts ADD COLUMN current_balance REAL NOT NULL DEFAULT 0')
  db.prepare('UPDATE accounts SET current_balance = initial_balance').run()
}

/** Inject optional builtin «تاریخ معامله» into strategies that predate the field. */
const migrateStrategiesTradeDate = (): void => {
  const rows = db.prepare('SELECT id, fields_json FROM strategies').all() as {
    id: string
    fields_json: string
  }[]

  const update = db.prepare(
    'UPDATE strategies SET fields_json = ?, updated_at = ? WHERE id = ?'
  )

  for (const row of rows) {
    let fields: FieldDefinition[]
    try {
      fields = JSON.parse(row.fields_json) as FieldDefinition[]
    } catch {
      continue
    }
    if (!Array.isArray(fields)) continue
    if (fields.some((field) => field.builtinKey === 'tradeDate')) continue

    const tradeDateField: FieldDefinition = {
      id: crypto.randomUUID(),
      key: 'tradeDate',
      label: 'تاریخ معامله',
      type: 'date',
      options: [],
      enabled: true,
      builtin: true,
      builtinKey: 'tradeDate'
    }
    const symbolIndex = fields.findIndex((field) => field.builtinKey === 'symbol')
    const insertAt = symbolIndex >= 0 ? symbolIndex + 1 : 0
    const next = [...fields]
    next.splice(insertAt, 0, tradeDateField)
    update.run(JSON.stringify(next), nowIso(), row.id)
  }
}

const nowIso = (): string => new Date().toISOString()

const validateFieldDefinition = (field: unknown, index: number): FieldDefinition => {
  if (!field || typeof field !== 'object') {
    throw new Error(`فیلد شماره ${index + 1} نامعتبر است.`)
  }
  const f = field as Record<string, unknown>
  if (typeof f.id !== 'string' || !f.id.trim()) {
    throw new Error(`شناسه فیلد شماره ${index + 1} نامعتبر است.`)
  }
  if (typeof f.key !== 'string' || !f.key.trim()) {
    throw new Error(`کلید فیلد شماره ${index + 1} نامعتبر است.`)
  }
  if (typeof f.label !== 'string' || !f.label.trim()) {
    throw new Error(`برچسب فیلد شماره ${index + 1} نامعتبر است.`)
  }
  if (!FIELD_TYPES.includes(f.type as FieldType)) {
    throw new Error(`نوع فیلد «${f.key}» نامعتبر است.`)
  }
  if (!Array.isArray(f.options)) {
    throw new Error(`گزینه‌های فیلد «${f.key}» نامعتبر است.`)
  }
  const options = f.options.map((opt, oi) => {
    if (!opt || typeof opt !== 'object') {
      throw new Error(`گزینه ${oi + 1} در فیلد «${f.key}» نامعتبر است.`)
    }
    const o = opt as Record<string, unknown>
    if (typeof o.id !== 'string' || typeof o.label !== 'string') {
      throw new Error(`گزینه ${oi + 1} در فیلد «${f.key}» نامعتبر است.`)
    }
    return { id: o.id, label: o.label }
  })
  if (typeof f.enabled !== 'boolean') {
    throw new Error(`وضعیت فیلد «${f.key}» نامعتبر است.`)
  }
  if (typeof f.builtin !== 'boolean') {
    throw new Error(`فیلد «${f.key}» نامعتبر است.`)
  }
  const result: FieldDefinition = {
    id: f.id,
    key: f.key,
    label: f.label,
    type: f.type as FieldType,
    options,
    enabled: f.enabled,
    builtin: f.builtin
  }
  if (f.builtinKey !== undefined) {
    if (typeof f.builtinKey !== 'string') {
      throw new Error(`فیلد «${f.key}» نامعتبر است.`)
    }
    result.builtinKey = f.builtinKey as FieldDefinition['builtinKey']
  }
  return result
}

const validateFields = (fields: unknown): FieldDefinition[] => {
  if (!Array.isArray(fields)) {
    throw new Error('فیلدهای استراتژی باید آرایه باشند.')
  }
  return fields.map((field, index) => validateFieldDefinition(field, index))
}

const mapStrategyRow = (row: {
  id: string
  name: string
  fields_json: string
  created_at: string
  updated_at: string
}): Strategy => ({
  id: row.id,
  name: row.name,
  fields: JSON.parse(row.fields_json) as FieldDefinition[],
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const getAccountStrategyIds = (accountId: string): string[] => {
  const rows = db
    .prepare('SELECT strategy_id FROM account_strategies WHERE account_id = ?')
    .all(accountId) as { strategy_id: string }[]
  return rows.map((r) => r.strategy_id)
}

const mapAccountRow = (row: {
  id: string
  name: string
  initial_balance: number
  current_balance: number
  target_percent: number | null
  fixed_risk: number
  fixed_risk_value: string | null
  created_at: string
  updated_at: string
}): Account => ({
  id: row.id,
  name: row.name,
  initialBalance: row.initial_balance,
  currentBalance: row.current_balance,
  targetPercent: row.target_percent,
  strategyIds: getAccountStrategyIds(row.id),
  fixedRisk: row.fixed_risk === 1,
  fixedRiskValue: row.fixed_risk_value,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mimeFromPath = (relativePath: string): string => {
  const ext = extname(relativePath).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.webp':
      return 'image/webp'
    case '.gif':
      return 'image/gif'
    default:
      return 'application/octet-stream'
  }
}

const loadImageDataUrl = (relativePath: string): string | null => {
  const absolute = join(userDataPath, relativePath)
  if (!existsSync(absolute)) {
    return null
  }
  try {
    const buffer = readFileSync(absolute)
    const mime = mimeFromPath(relativePath)
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return null
  }
}

const getJournalImages = (journalId: string): JournalImage[] => {
  const rows = db
    .prepare(
      'SELECT id, relative_path, sort_order FROM journal_images WHERE journal_id = ? ORDER BY sort_order ASC'
    )
    .all(journalId) as { id: string; relative_path: string; sort_order: number }[]

  return rows
    .map((row) => {
      const dataUrl = loadImageDataUrl(row.relative_path)
      if (!dataUrl) {
        return null
      }
      return {
        id: row.id,
        relativePath: row.relative_path,
        sortOrder: row.sort_order,
        dataUrl
      }
    })
    .filter((img): img is JournalImage => img !== null)
}

const mapJournalRow = (row: {
  id: string
  account_id: string
  strategy_id: string
  values_json: string
  risk_fixed: number
  created_at: string
  updated_at: string
}): Journal => ({
  id: row.id,
  accountId: row.account_id,
  strategyId: row.strategy_id,
  values: JSON.parse(row.values_json) as Record<string, string | string[]>,
  riskFixed: row.risk_fixed === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  images: getJournalImages(row.id)
})

const unlinkJournalImages = (journalId: string): void => {
  const rows = db
    .prepare('SELECT relative_path FROM journal_images WHERE journal_id = ?')
    .all(journalId) as { relative_path: string }[]
  for (const row of rows) {
    const absolute = join(userDataPath, row.relative_path)
    if (existsSync(absolute)) {
      try {
        unlinkSync(absolute)
      } catch {
        /* ignore missing or locked files */
      }
    }
  }
}

const writeJournalImage = (image: JournalImageInput, sortOrder: number): string => {
  if (!ALLOWED_MIMES[image.mime]) {
    throw new Error('فرمت تصویر پشتیبانی نمی‌شود.')
  }
  const ext = ALLOWED_MIMES[image.mime]
  const relativePath = `images/${image.id}${ext}`
  const absolute = join(userDataPath, relativePath)
  const buffer = Buffer.from(image.dataBase64, 'base64')
  writeFileSync(absolute, buffer)
  return relativePath
}

const validateStrategyInput = (input: StrategyInput): StrategyInput => {
  const name = input.name.trim()
  if (!name) {
    throw new Error('نام استراتژی الزامی است.')
  }
  const fields = validateFields(input.fields)
  return { name, fields }
}

const validateAccountInput = (input: AccountInput): AccountInput => {
  const name = input.name.trim()
  if (!name) {
    throw new Error('نام حساب الزامی است.')
  }
  if (!Number.isFinite(input.initialBalance) || input.initialBalance < 0) {
    throw new Error('موجودی اولیه باید عددی بزرگ‌تر یا مساوی صفر باشد.')
  }
  if (
    input.targetPercent !== null &&
    !(TARGET_PERCENTS as readonly number[]).includes(input.targetPercent)
  ) {
    throw new Error('درصد هدف نامعتبر است.')
  }
  if (!Array.isArray(input.strategyIds) || input.strategyIds.length === 0) {
    throw new Error('حداقل یک استراتژی باید انتخاب شود.')
  }
  for (const strategyId of input.strategyIds) {
    const exists = db.prepare('SELECT 1 FROM strategies WHERE id = ?').get(strategyId)
    if (!exists) {
      throw new Error('یکی از استراتژی‌های انتخاب‌شده وجود ندارد.')
    }
  }
  return {
    name,
    initialBalance: input.initialBalance,
    targetPercent: input.targetPercent,
    strategyIds: input.strategyIds
  }
}

const validateJournalInput = (input: JournalInput): JournalInput => {
  const account = db.prepare('SELECT id FROM accounts WHERE id = ?').get(input.accountId)
  if (!account) {
    throw new Error('حساب یافت نشد.')
  }
  const strategy = db.prepare('SELECT id FROM strategies WHERE id = ?').get(input.strategyId)
  if (!strategy) {
    throw new Error('استراتژی یافت نشد.')
  }
  const link = db
    .prepare(
      'SELECT 1 FROM account_strategies WHERE account_id = ? AND strategy_id = ?'
    )
    .get(input.accountId, input.strategyId)
  if (!link) {
    throw new Error('این استراتژی به حساب انتخاب‌شده متصل نیست.')
  }
  if (
    !input.values ||
    typeof input.values !== 'object' ||
    Array.isArray(input.values)
  ) {
    throw new Error('مقادیر ژورنال نامعتبر است.')
  }
  if (typeof input.riskFixed !== 'boolean') {
    throw new Error('وضعیت ریسک ثابت نامعتبر است.')
  }
  if (!Array.isArray(input.images)) {
    throw new Error('تصاویر ژورنال نامعتبر است.')
  }
  return input
}

const setAccountStrategies = (accountId: string, strategyIds: string[]): void => {
  db.prepare('DELETE FROM account_strategies WHERE account_id = ?').run(accountId)
  const insert = db.prepare(
    'INSERT INTO account_strategies (account_id, strategy_id) VALUES (?, ?)'
  )
  for (const strategyId of strategyIds) {
    insert.run(accountId, strategyId)
  }
}

export const listStrategies = (): Strategy[] => {
  const rows = db
    .prepare('SELECT * FROM strategies ORDER BY created_at ASC')
    .all() as Parameters<typeof mapStrategyRow>[0][]
  return rows.map(mapStrategyRow)
}

export const createStrategy = (input: StrategyInput): Strategy => {
  const validated = validateStrategyInput(input)
  const id = crypto.randomUUID()
  const ts = nowIso()
  db.prepare(
    'INSERT INTO strategies (id, name, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, validated.name, JSON.stringify(validated.fields), ts, ts)
  return mapStrategyRow({
    id,
    name: validated.name,
    fields_json: JSON.stringify(validated.fields),
    created_at: ts,
    updated_at: ts
  })
}

export const updateStrategy = (id: string, input: StrategyInput): Strategy => {
  const existing = db.prepare('SELECT id FROM strategies WHERE id = ?').get(id)
  if (!existing) {
    throw new Error('استراتژی یافت نشد.')
  }
  const validated = validateStrategyInput(input)
  const ts = nowIso()
  db.prepare('UPDATE strategies SET name = ?, fields_json = ?, updated_at = ? WHERE id = ?').run(
    validated.name,
    JSON.stringify(validated.fields),
    ts,
    id
  )
  const row = db.prepare('SELECT * FROM strategies WHERE id = ?').get(id) as Parameters<
    typeof mapStrategyRow
  >[0]
  return mapStrategyRow(row)
}

export const deleteStrategy = (id: string): void => {
  const journal = db
    .prepare('SELECT id FROM journals WHERE strategy_id = ? LIMIT 1')
    .get(id)
  if (journal) {
    throw new Error('این استراتژی در ژورنال‌ها استفاده شده و قابل حذف نیست.')
  }
  db.prepare('DELETE FROM strategies WHERE id = ?').run(id)
}

export const listAccounts = (): Account[] => {
  const rows = db
    .prepare('SELECT * FROM accounts ORDER BY created_at ASC')
    .all() as Parameters<typeof mapAccountRow>[0][]
  return rows.map(mapAccountRow)
}

export const createAccount = (input: AccountInput): Account => {
  const validated = validateAccountInput(input)
  const id = crypto.randomUUID()
  const ts = nowIso()
  db.prepare(
    `INSERT INTO accounts (id, name, initial_balance, current_balance, target_percent, fixed_risk, fixed_risk_value, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, NULL, ?, ?)`
  ).run(
    id,
    validated.name,
    validated.initialBalance,
    validated.initialBalance,
    validated.targetPercent,
    ts,
    ts
  )
  setAccountStrategies(id, validated.strategyIds)
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Parameters<
    typeof mapAccountRow
  >[0]
  return mapAccountRow(row)
}

export const updateAccount = (id: string, input: AccountInput): Account => {
  const existing = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as
    | Parameters<typeof mapAccountRow>[0]
    | undefined
  if (!existing) {
    throw new Error('حساب یافت نشد.')
  }
  const validated = validateAccountInput(input)
  const ts = nowIso()
  const initialChanged = existing.initial_balance !== validated.initialBalance
  db.prepare(
    `UPDATE accounts SET name = ?, initial_balance = ?, target_percent = ?, updated_at = ? WHERE id = ?`
  ).run(validated.name, validated.initialBalance, validated.targetPercent, ts, id)
  setAccountStrategies(id, validated.strategyIds)
  if (initialChanged) {
    recalculateAccountBalance(id)
  }
  const row = db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as Parameters<
    typeof mapAccountRow
  >[0]
  return mapAccountRow(row)
}

export const deleteAccount = (id: string): void => {
  const journals = db
    .prepare('SELECT id FROM journals WHERE account_id = ?')
    .all(id) as { id: string }[]
  for (const journal of journals) {
    unlinkJournalImages(journal.id)
  }
  db.prepare('DELETE FROM accounts WHERE id = ?').run(id)
}

export const listSymbols = (): SymbolItem[] => {
  const rows = db
    .prepare('SELECT id, label FROM symbols ORDER BY label COLLATE NOCASE ASC')
    .all() as { id: string; label: string }[]
  return rows.map((r) => ({ id: r.id, label: r.label }))
}

export const createSymbol = (label: string): SymbolItem => {
  const trimmed = label.trim()
  if (!trimmed) {
    throw new Error('نام نماد الزامی است.')
  }
  const id = crypto.randomUUID()
  const ts = nowIso()
  try {
    db.prepare('INSERT INTO symbols (id, label, created_at) VALUES (?, ?, ?)').run(
      id,
      trimmed,
      ts
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('UNIQUE')) {
      throw new Error('این نماد قبلاً ثبت شده است.')
    }
    throw err
  }
  return { id, label: trimmed }
}

export const deleteSymbol = (id: string): void => {
  db.prepare('DELETE FROM symbols WHERE id = ?').run(id)
}

export const listJournals = (accountId: string): Journal[] => {
  const rows = db
    .prepare('SELECT * FROM journals WHERE account_id = ? ORDER BY created_at DESC')
    .all(accountId) as Parameters<typeof mapJournalRow>[0][]
  return rows.map(mapJournalRow)
}

/** Lightweight journal rows for balance math (skips reading image files). */
const listJournalsForBalance = (accountId: string): Journal[] => {
  const rows = db
    .prepare('SELECT * FROM journals WHERE account_id = ? ORDER BY created_at ASC, id ASC')
    .all(accountId) as Parameters<typeof mapJournalRow>[0][]
  return rows.map((row) => ({
    id: row.id,
    accountId: row.account_id,
    strategyId: row.strategy_id,
    values: JSON.parse(row.values_json) as Record<string, string | string[]>,
    riskFixed: row.risk_fixed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    images: []
  }))
}

export const createJournal = (input: JournalInput, createdAt?: string): Journal => {
  const validated = validateJournalInput(input)
  const id = crypto.randomUUID()
  const ts =
    createdAt && !Number.isNaN(Date.parse(createdAt)) ? new Date(createdAt).toISOString() : nowIso()

  const createTx = db.transaction(() => {
    db.prepare(
      `INSERT INTO journals (id, account_id, strategy_id, values_json, risk_fixed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      validated.accountId,
      validated.strategyId,
      JSON.stringify(validated.values),
      validated.riskFixed ? 1 : 0,
      ts,
      ts
    )

    const insertImage = db.prepare(
      'INSERT INTO journal_images (id, journal_id, relative_path, sort_order) VALUES (?, ?, ?, ?)'
    )

    validated.images.forEach((image, index) => {
      const relativePath = writeJournalImage(image, index)
      insertImage.run(image.id, id, relativePath, index)
    })

    if (validated.riskFixed) {
      const riskValue = validated.values.risk
      const riskStr =
        typeof riskValue === 'string' && riskValue.trim() !== '' ? riskValue : null
      if (riskStr !== null) {
        db.prepare(
          'UPDATE accounts SET fixed_risk = 1, fixed_risk_value = ? WHERE id = ?'
        ).run(riskStr, validated.accountId)
      } else {
        db.prepare('UPDATE accounts SET fixed_risk = 1 WHERE id = ?').run(validated.accountId)
      }
    } else {
      db.prepare('UPDATE accounts SET fixed_risk = 0 WHERE id = ?').run(validated.accountId)
    }
  })

  createTx()
  recalculateAccountBalance(validated.accountId)

  const row = db.prepare('SELECT * FROM journals WHERE id = ?').get(id) as Parameters<
    typeof mapJournalRow
  >[0]
  return mapJournalRow(row)
}

export const getJournal = (id: string): Journal | null => {
  const row = db.prepare('SELECT * FROM journals WHERE id = ?').get(id) as
    | Parameters<typeof mapJournalRow>[0]
    | undefined
  if (!row) return null
  return mapJournalRow(row)
}

export const updateJournal = (id: string, input: JournalInput): Journal => {
  const existing = db.prepare('SELECT * FROM journals WHERE id = ?').get(id) as
    | Parameters<typeof mapJournalRow>[0]
    | undefined
  if (!existing) {
    throw new Error('معامله یافت نشد.')
  }
  if (existing.account_id !== input.accountId) {
    throw new Error('حساب معامله قابل تغییر نیست.')
  }
  const validated = validateJournalInput(input)
  const ts = nowIso()

  const updateTx = db.transaction(() => {
    db.prepare(
      `UPDATE journals SET strategy_id = ?, values_json = ?, risk_fixed = ?, updated_at = ? WHERE id = ?`
    ).run(
      validated.strategyId,
      JSON.stringify(validated.values),
      validated.riskFixed ? 1 : 0,
      ts,
      id
    )

    unlinkJournalImages(id)
    db.prepare('DELETE FROM journal_images WHERE journal_id = ?').run(id)

    const insertImage = db.prepare(
      'INSERT INTO journal_images (id, journal_id, relative_path, sort_order) VALUES (?, ?, ?, ?)'
    )
    validated.images.forEach((image, index) => {
      const relativePath = writeJournalImage(image, index)
      insertImage.run(image.id, id, relativePath, index)
    })

    if (validated.riskFixed) {
      const riskValue = validated.values.risk
      const riskStr =
        typeof riskValue === 'string' && riskValue.trim() !== '' ? riskValue : null
      if (riskStr !== null) {
        db.prepare(
          'UPDATE accounts SET fixed_risk = 1, fixed_risk_value = ? WHERE id = ?'
        ).run(riskStr, validated.accountId)
      } else {
        db.prepare('UPDATE accounts SET fixed_risk = 1 WHERE id = ?').run(validated.accountId)
      }
    } else {
      db.prepare('UPDATE accounts SET fixed_risk = 0 WHERE id = ?').run(validated.accountId)
    }
  })

  updateTx()
  // Edit must rebuild the whole chain from initial balance through all trades.
  recalculateAccountBalance(validated.accountId)

  const row = db.prepare('SELECT * FROM journals WHERE id = ?').get(id) as Parameters<
    typeof mapJournalRow
  >[0]
  return mapJournalRow(row)
}

export const deleteJournal = (id: string): void => {
  const existing = db.prepare('SELECT account_id FROM journals WHERE id = ?').get(id) as
    | { account_id: string }
    | undefined
  unlinkJournalImages(id)
  db.prepare('DELETE FROM journals WHERE id = ?').run(id)
  if (existing) {
    recalculateAccountBalance(existing.account_id)
  }
}

export type BackupImageFile = {
  archivePath: string
  buffer: Buffer
}

export type CollectBackupResult = {
  data: BackupData
  imageFiles: BackupImageFile[]
}

const isSafeRelativeImagePath = (relativePath: string): boolean => {
  const normalized = relativePath.replace(/\\/g, '/')
  if (!normalized.startsWith('images/')) return false
  if (normalized.includes('..')) return false
  return true
}

export const collectBackupData = (): CollectBackupResult => {
  const symbolRows = db
    .prepare('SELECT id, label, created_at FROM symbols ORDER BY created_at ASC')
    .all() as { id: string; label: string; created_at: string }[]
  const symbols: BackupSymbolRow[] = symbolRows.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at
  }))

  const strategyRows = db
    .prepare('SELECT * FROM strategies ORDER BY created_at ASC')
    .all() as Parameters<typeof mapStrategyRow>[0][]
  const strategies: BackupStrategyRow[] = strategyRows.map((row) => {
    const mapped = mapStrategyRow(row)
    return {
      id: mapped.id,
      name: mapped.name,
      fields: mapped.fields,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt
    }
  })

  const accountRows = db
    .prepare('SELECT * FROM accounts ORDER BY created_at ASC')
    .all() as Parameters<typeof mapAccountRow>[0][]
  const accounts: BackupAccountRow[] = accountRows.map((row) => {
    const mapped = mapAccountRow(row)
    return {
      id: mapped.id,
      name: mapped.name,
      initialBalance: mapped.initialBalance,
      currentBalance: mapped.currentBalance,
      targetPercent: mapped.targetPercent,
      fixedRisk: mapped.fixedRisk,
      fixedRiskValue: mapped.fixedRiskValue,
      strategyIds: mapped.strategyIds,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt
    }
  })

  const journalRows = db
    .prepare('SELECT * FROM journals ORDER BY created_at ASC, id ASC')
    .all() as Parameters<typeof mapJournalRow>[0][]

  const imageFiles: BackupImageFile[] = []
  const seenPaths = new Set<string>()
  const journals: BackupJournalRow[] = journalRows.map((row) => {
    const imageMeta = db
      .prepare(
        'SELECT id, relative_path, sort_order FROM journal_images WHERE journal_id = ? ORDER BY sort_order ASC'
      )
      .all(row.id) as { id: string; relative_path: string; sort_order: number }[]

    const images: BackupJournalImageRow[] = imageMeta.map((img) => {
      const relativePath = img.relative_path.replace(/\\/g, '/')
      if (isSafeRelativeImagePath(relativePath) && !seenPaths.has(relativePath)) {
        const absolute = join(userDataPath, relativePath)
        if (existsSync(absolute)) {
          try {
            imageFiles.push({
              archivePath: relativePath,
              buffer: readFileSync(absolute)
            })
            seenPaths.add(relativePath)
          } catch {
            /* skip unreadable image; restore will omit it */
          }
        }
      }
      return {
        id: img.id,
        relativePath,
        sortOrder: img.sort_order
      }
    })

    return {
      id: row.id,
      accountId: row.account_id,
      strategyId: row.strategy_id,
      values: JSON.parse(row.values_json) as Record<string, string | string[]>,
      riskFixed: row.risk_fixed === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      images
    }
  })

  return {
    data: { symbols, strategies, accounts, journals },
    imageFiles
  }
}

const clearAllUserData = (): void => {
  const imageRows = db
    .prepare('SELECT relative_path FROM journal_images')
    .all() as { relative_path: string }[]
  for (const row of imageRows) {
    const absolute = join(userDataPath, row.relative_path)
    if (existsSync(absolute)) {
      try {
        unlinkSync(absolute)
      } catch {
        /* ignore */
      }
    }
  }

  db.exec(`
    DELETE FROM journal_images;
    DELETE FROM journals;
    DELETE FROM account_strategies;
    DELETE FROM accounts;
    DELETE FROM strategies;
    DELETE FROM symbols;
  `)
}

const writeBackupImageFile = (relativePath: string, buffer: Buffer): void => {
  const normalized = relativePath.replace(/\\/g, '/')
  if (!isSafeRelativeImagePath(normalized)) {
    throw new Error(`مسیر تصویر نامعتبر است: ${relativePath}`)
  }
  if (!existsSync(imagesDir)) {
    mkdirSync(imagesDir, { recursive: true })
  }
  const absolute = join(userDataPath, normalized)
  writeFileSync(absolute, buffer)
}

const validateBackupPayload = (data: BackupData): void => {
  for (let index = 0; index < data.symbols.length; index += 1) {
    const symbol = data.symbols[index]
    if (!symbol || typeof symbol.id !== 'string' || typeof symbol.label !== 'string') {
      throw new Error(`نماد شماره ${index + 1} نامعتبر است.`)
    }
  }
  for (let index = 0; index < data.strategies.length; index += 1) {
    const strategy = data.strategies[index]
    if (!strategy || typeof strategy.id !== 'string' || typeof strategy.name !== 'string') {
      throw new Error(`استراتژی شماره ${index + 1} نامعتبر است.`)
    }
    validateFields(strategy.fields)
  }
  for (let index = 0; index < data.accounts.length; index += 1) {
    const account = data.accounts[index]
    if (!account || typeof account.id !== 'string' || typeof account.name !== 'string') {
      throw new Error(`حساب شماره ${index + 1} نامعتبر است.`)
    }
    if (!Array.isArray(account.strategyIds)) {
      throw new Error(`استراتژی‌های حساب شماره ${index + 1} نامعتبر است.`)
    }
  }
  for (let index = 0; index < data.journals.length; index += 1) {
    const journal = data.journals[index]
    if (!journal || typeof journal.id !== 'string') {
      throw new Error(`ژورنال شماره ${index + 1} نامعتبر است.`)
    }
    if (!Array.isArray(journal.images)) {
      throw new Error(`تصاویر ژورنال شماره ${index + 1} نامعتبر است.`)
    }
  }
}

const restoreReplace = (
  data: BackupData,
  imageBuffers: Map<string, Buffer>
): BackupImportCounts => {
  clearAllUserData()

  const insertSymbol = db.prepare(
    'INSERT INTO symbols (id, label, created_at) VALUES (?, ?, ?)'
  )
  for (const symbol of data.symbols) {
    insertSymbol.run(symbol.id, symbol.label.trim(), symbol.createdAt || nowIso())
  }

  const insertStrategy = db.prepare(
    'INSERT INTO strategies (id, name, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  for (const strategy of data.strategies) {
    const fields = validateFields(strategy.fields)
    insertStrategy.run(
      strategy.id,
      strategy.name.trim(),
      JSON.stringify(fields),
      strategy.createdAt || nowIso(),
      strategy.updatedAt || nowIso()
    )
  }

  const insertAccount = db.prepare(
    `INSERT INTO accounts (
      id, name, initial_balance, current_balance, target_percent,
      fixed_risk, fixed_risk_value, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertLink = db.prepare(
    'INSERT INTO account_strategies (account_id, strategy_id) VALUES (?, ?)'
  )
  for (const account of data.accounts) {
    insertAccount.run(
      account.id,
      account.name.trim(),
      account.initialBalance,
      Number.isFinite(account.currentBalance) ? account.currentBalance : account.initialBalance,
      account.targetPercent,
      account.fixedRisk ? 1 : 0,
      account.fixedRiskValue,
      account.createdAt || nowIso(),
      account.updatedAt || nowIso()
    )
    for (const strategyId of account.strategyIds) {
      insertLink.run(account.id, strategyId)
    }
  }

  const insertJournal = db.prepare(
    `INSERT INTO journals (
      id, account_id, strategy_id, values_json, risk_fixed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const insertImage = db.prepare(
    'INSERT INTO journal_images (id, journal_id, relative_path, sort_order) VALUES (?, ?, ?, ?)'
  )

  let imageCount = 0
  for (const journal of data.journals) {
    insertJournal.run(
      journal.id,
      journal.accountId,
      journal.strategyId,
      JSON.stringify(journal.values ?? {}),
      journal.riskFixed ? 1 : 0,
      journal.createdAt || nowIso(),
      journal.updatedAt || nowIso()
    )
    for (const image of journal.images) {
      const archivePath = image.relativePath.replace(/\\/g, '/')
      const buffer = imageBuffers.get(archivePath)
      if (!buffer) continue
      writeBackupImageFile(archivePath, buffer)
      insertImage.run(image.id, journal.id, archivePath, image.sortOrder)
      imageCount += 1
    }
  }

  return {
    symbols: data.symbols.length,
    strategies: data.strategies.length,
    accounts: data.accounts.length,
    journals: data.journals.length,
    images: imageCount
  }
}

const restoreMerge = (
  data: BackupData,
  imageBuffers: Map<string, Buffer>
): BackupImportCounts => {
  const strategyIdMap = new Map<string, string>()
  const accountIdMap = new Map<string, string>()

  const existingSymbols = db
    .prepare('SELECT id, label FROM symbols')
    .all() as { id: string; label: string }[]
  const labelToId = new Map(existingSymbols.map((row) => [row.label.toLowerCase(), row.id]))

  const insertSymbol = db.prepare(
    'INSERT INTO symbols (id, label, created_at) VALUES (?, ?, ?)'
  )
  let symbolCount = 0
  for (const symbol of data.symbols) {
    const label = symbol.label.trim()
    const existingId = labelToId.get(label.toLowerCase())
    if (existingId) {
      continue
    }
    const newId = crypto.randomUUID()
    insertSymbol.run(newId, label, symbol.createdAt || nowIso())
    labelToId.set(label.toLowerCase(), newId)
    symbolCount += 1
  }

  const insertStrategy = db.prepare(
    'INSERT INTO strategies (id, name, fields_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  )
  for (const strategy of data.strategies) {
    const newId = crypto.randomUUID()
    const fields = validateFields(strategy.fields)
    const ts = nowIso()
    insertStrategy.run(
      newId,
      strategy.name.trim(),
      JSON.stringify(fields),
      strategy.createdAt || ts,
      strategy.updatedAt || ts
    )
    strategyIdMap.set(strategy.id, newId)
  }

  const insertAccount = db.prepare(
    `INSERT INTO accounts (
      id, name, initial_balance, current_balance, target_percent,
      fixed_risk, fixed_risk_value, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
  const insertLink = db.prepare(
    'INSERT INTO account_strategies (account_id, strategy_id) VALUES (?, ?)'
  )
  for (const account of data.accounts) {
    const newId = crypto.randomUUID()
    const mappedStrategyIds = account.strategyIds
      .map((id) => strategyIdMap.get(id))
      .filter((id): id is string => Boolean(id))
    if (mappedStrategyIds.length === 0) {
      throw new Error(`حساب «${account.name}» هیچ استراتژی معتبری در پشتیبان ندارد.`)
    }
    const ts = nowIso()
    insertAccount.run(
      newId,
      account.name.trim(),
      account.initialBalance,
      Number.isFinite(account.currentBalance) ? account.currentBalance : account.initialBalance,
      account.targetPercent,
      account.fixedRisk ? 1 : 0,
      account.fixedRiskValue,
      account.createdAt || ts,
      account.updatedAt || ts
    )
    for (const strategyId of mappedStrategyIds) {
      insertLink.run(newId, strategyId)
    }
    accountIdMap.set(account.id, newId)
  }

  const insertJournal = db.prepare(
    `INSERT INTO journals (
      id, account_id, strategy_id, values_json, risk_fixed, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const insertImage = db.prepare(
    'INSERT INTO journal_images (id, journal_id, relative_path, sort_order) VALUES (?, ?, ?, ?)'
  )

  let imageCount = 0
  for (const journal of data.journals) {
    const newAccountId = accountIdMap.get(journal.accountId)
    const newStrategyId = strategyIdMap.get(journal.strategyId)
    if (!newAccountId || !newStrategyId) {
      throw new Error('ارجاع حساب یا استراتژی در یکی از ژورنال‌های پشتیبان نامعتبر است.')
    }
    const newJournalId = crypto.randomUUID()
    const ts = nowIso()
    insertJournal.run(
      newJournalId,
      newAccountId,
      newStrategyId,
      JSON.stringify(journal.values ?? {}),
      journal.riskFixed ? 1 : 0,
      journal.createdAt || ts,
      journal.updatedAt || ts
    )

    for (const image of journal.images) {
      const archivePath = image.relativePath.replace(/\\/g, '/')
      const buffer = imageBuffers.get(archivePath)
      if (!buffer) continue
      const ext = extname(archivePath).toLowerCase() || '.png'
      const newImageId = crypto.randomUUID()
      const newRelativePath = `images/${newImageId}${ext}`
      writeBackupImageFile(newRelativePath, buffer)
      insertImage.run(newImageId, newJournalId, newRelativePath, image.sortOrder)
      imageCount += 1
    }
  }

  return {
    symbols: symbolCount,
    strategies: data.strategies.length,
    accounts: data.accounts.length,
    journals: data.journals.length,
    images: imageCount
  }
}

export const restoreBackupData = (
  data: BackupData,
  imageBuffers: Map<string, Buffer>,
  mode: BackupImportMode
): BackupImportCounts => {
  validateBackupPayload(data)

  const run = db.transaction(() => {
    if (mode === 'replace') {
      return restoreReplace(data, imageBuffers)
    }
    return restoreMerge(data, imageBuffers)
  })

  const counts = run()

  const accountIds = db.prepare('SELECT id FROM accounts').all() as { id: string }[]
  for (const row of accountIds) {
    enqueueBalanceRecalc(row.id)
  }

  return counts
}
