import type { FieldDefinition, FieldType, Journal } from './types'

export type FilterKind = 'number' | 'text' | 'date' | 'enum' | 'multi'

export type FilterOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'contains'
  | 'empty'
  | 'notEmpty'
  | 'oneOf'
  | 'before'
  | 'after'

export type TradeFilterRule = {
  id: string
  fieldKey: string
  operator: FilterOperator
  value: string
  valueTo: string
  values: string[]
}

export type FilterOperatorOption = {
  id: FilterOperator
  label: string
}

const NUMBER_OPS: FilterOperatorOption[] = [
  { id: 'eq', label: 'مساوی' },
  { id: 'neq', label: 'نابرابر' },
  { id: 'gt', label: 'بزرگ‌تر از' },
  { id: 'gte', label: 'بزرگ‌تر یا مساوی' },
  { id: 'lt', label: 'کوچک‌تر از' },
  { id: 'lte', label: 'کوچک‌تر یا مساوی' },
  { id: 'between', label: 'بین' }
]

const TEXT_OPS: FilterOperatorOption[] = [
  { id: 'eq', label: 'مساوی' },
  { id: 'contains', label: 'شامل' },
  { id: 'neq', label: 'نابرابر' },
  { id: 'empty', label: 'خالی است' },
  { id: 'notEmpty', label: 'خالی نیست' }
]

const DATE_OPS: FilterOperatorOption[] = [
  { id: 'eq', label: 'مساوی' },
  { id: 'before', label: 'قبل از' },
  { id: 'after', label: 'بعد از' },
  { id: 'between', label: 'بین' }
]

const ENUM_OPS: FilterOperatorOption[] = [
  { id: 'eq', label: 'مساوی' },
  { id: 'oneOf', label: 'یکی از' },
  { id: 'empty', label: 'خالی است' },
  { id: 'notEmpty', label: 'خالی نیست' }
]

const MULTI_OPS: FilterOperatorOption[] = [
  { id: 'oneOf', label: 'شامل یکی از' },
  { id: 'empty', label: 'خالی است' },
  { id: 'notEmpty', label: 'خالی نیست' }
]

const ENUM_TYPES: ReadonlySet<FieldType> = new Set([
  'segmented',
  'stackedButtons',
  'radioRow',
  'select'
])

const MULTI_TYPES: ReadonlySet<FieldType> = new Set([
  'multiSelect',
  'checkboxRow',
  'checkboxColumn'
])

const NUMERIC_BUILTIN_KEYS = new Set(['reward', 'maxReward', 'risk'])

const isNumericOptionSet = (field: FieldDefinition): boolean => {
  if (field.options.length === 0) return false
  return field.options.every((option) => Number.isFinite(Number(option.id)))
}

export const getFilterKind = (field: FieldDefinition): FilterKind => {
  if (field.type === 'date' || field.builtinKey === 'tradeDate') return 'date'

  if (
    (field.builtinKey && NUMERIC_BUILTIN_KEYS.has(field.builtinKey)) ||
    (ENUM_TYPES.has(field.type) && isNumericOptionSet(field))
  ) {
    return 'number'
  }

  if (MULTI_TYPES.has(field.type)) return 'multi'

  if (ENUM_TYPES.has(field.type)) return 'enum'

  return 'text'
}

export const getOperatorsForKind = (kind: FilterKind): FilterOperatorOption[] => {
  switch (kind) {
    case 'number':
      return NUMBER_OPS
    case 'text':
      return TEXT_OPS
    case 'date':
      return DATE_OPS
    case 'enum':
      return ENUM_OPS
    case 'multi':
      return MULTI_OPS
  }
}

export const defaultOperatorForKind = (kind: FilterKind): FilterOperator =>
  getOperatorsForKind(kind)[0].id

export const createEmptyFilterRule = (field: FieldDefinition): TradeFilterRule => ({
  id: crypto.randomUUID(),
  fieldKey: field.key,
  operator: defaultOperatorForKind(getFilterKind(field)),
  value: '',
  valueTo: '',
  values: []
})

export const isFilterRuleActive = (rule: TradeFilterRule, kind: FilterKind): boolean => {
  if (rule.operator === 'empty' || rule.operator === 'notEmpty') return true
  if (rule.operator === 'oneOf') return rule.values.length > 0
  if (rule.operator === 'between') {
    if (kind === 'date' || kind === 'number') {
      return rule.value.trim() !== '' && rule.valueTo.trim() !== ''
    }
  }
  return rule.value.trim() !== ''
}

export const countActiveFilters = (
  rules: TradeFilterRule[],
  fieldsByKey: Map<string, FieldDefinition>
): number =>
  rules.filter((rule) => {
    const field = fieldsByKey.get(rule.fieldKey)
    if (!field) return false
    return isFilterRuleActive(rule, getFilterKind(field))
  }).length

const normalizeText = (value: string): string => value.trim().toLowerCase()

const asStringList = (raw: string | string[] | undefined): string[] => {
  if (raw === undefined || raw === null) return []
  if (Array.isArray(raw)) return raw.filter((item) => item !== '')
  if (raw === '') return []
  return [raw]
}

const asPrimaryString = (raw: string | string[] | undefined): string => {
  if (raw === undefined || raw === null) return ''
  if (Array.isArray(raw)) return raw[0] ?? ''
  return raw
}

const parseNumeric = (raw: string): number | null => {
  const trimmed = raw.trim()
  if (trimmed === '') return null
  const value = Number(trimmed)
  return Number.isFinite(value) ? value : null
}

const matchNumber = (cell: string, rule: TradeFilterRule): boolean => {
  const cellNum = parseNumeric(cell)
  if (rule.operator === 'empty') return cell.trim() === '' || cellNum === null
  if (rule.operator === 'notEmpty') return cell.trim() !== '' && cellNum !== null

  const a = parseNumeric(rule.value)
  if (a === null) return true

  if (cellNum === null) return false

  switch (rule.operator) {
    case 'eq':
      return cellNum === a
    case 'neq':
      return cellNum !== a
    case 'gt':
      return cellNum > a
    case 'gte':
      return cellNum >= a
    case 'lt':
      return cellNum < a
    case 'lte':
      return cellNum <= a
    case 'between': {
      const b = parseNumeric(rule.valueTo)
      if (b === null) return true
      const min = Math.min(a, b)
      const max = Math.max(a, b)
      return cellNum >= min && cellNum <= max
    }
    default:
      return true
  }
}

const matchText = (cell: string, rule: TradeFilterRule): boolean => {
  const normalized = normalizeText(cell)
  switch (rule.operator) {
    case 'empty':
      return normalized === ''
    case 'notEmpty':
      return normalized !== ''
    case 'eq':
      return normalized === normalizeText(rule.value)
    case 'neq':
      return normalized !== normalizeText(rule.value)
    case 'contains':
      return normalized.includes(normalizeText(rule.value))
    default:
      return true
  }
}

const matchDate = (cell: string, rule: TradeFilterRule): boolean => {
  const cellDate = cell.trim()
  if (rule.operator === 'empty') return cellDate === ''
  if (rule.operator === 'notEmpty') return cellDate !== ''
  if (cellDate === '') return false

  switch (rule.operator) {
    case 'eq':
      return cellDate === rule.value.trim()
    case 'before':
      return cellDate < rule.value.trim()
    case 'after':
      return cellDate > rule.value.trim()
    case 'between': {
      const from = rule.value.trim()
      const to = rule.valueTo.trim()
      if (!from || !to) return true
      const min = from <= to ? from : to
      const max = from <= to ? to : from
      return cellDate >= min && cellDate <= max
    }
    default:
      return true
  }
}

const matchEnum = (cell: string, rule: TradeFilterRule): boolean => {
  switch (rule.operator) {
    case 'empty':
      return cell.trim() === ''
    case 'notEmpty':
      return cell.trim() !== ''
    case 'eq':
      return cell === rule.value
    case 'oneOf':
      if (rule.values.length === 0) return true
      return rule.values.includes(cell)
    default:
      return true
  }
}

const matchMulti = (cells: string[], rule: TradeFilterRule): boolean => {
  switch (rule.operator) {
    case 'empty':
      return cells.length === 0
    case 'notEmpty':
      return cells.length > 0
    case 'oneOf':
      if (rule.values.length === 0) return true
      return rule.values.some((value) => cells.includes(value))
    default:
      return true
  }
}

const matchRule = (
  journal: Journal,
  rule: TradeFilterRule,
  field: FieldDefinition
): boolean => {
  const kind = getFilterKind(field)
  if (!isFilterRuleActive(rule, kind)) return true

  const raw = journal.values[field.key]

  switch (kind) {
    case 'number':
      return matchNumber(asPrimaryString(raw), rule)
    case 'text':
      return matchText(asPrimaryString(raw), rule)
    case 'date':
      return matchDate(asPrimaryString(raw), rule)
    case 'enum':
      return matchEnum(asPrimaryString(raw), rule)
    case 'multi':
      return matchMulti(asStringList(raw), rule)
  }
}

export const applyTradeFilters = (
  journals: Journal[],
  rules: TradeFilterRule[],
  fields: FieldDefinition[]
): Journal[] => {
  const fieldsByKey = new Map(fields.map((field) => [field.key, field]))
  const activeRules = rules.filter((rule) => {
    const field = fieldsByKey.get(rule.fieldKey)
    return field ? isFilterRuleActive(rule, getFilterKind(field)) : false
  })

  if (activeRules.length === 0) return journals

  return journals.filter((journal) =>
    activeRules.every((rule) => {
      const field = fieldsByKey.get(rule.fieldKey)
      if (!field) return true
      return matchRule(journal, rule, field)
    })
  )
}
