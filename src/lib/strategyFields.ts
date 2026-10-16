import type { Account, FieldDefinition, Strategy } from './types'

/** Enabled fields across linked strategies, deduped by field.key (first wins). */
export const collectEnabledFields = (
  account: Account,
  strategies: Strategy[]
): FieldDefinition[] => {
  const linked = account.strategyIds
    .map((id) => strategies.find((strategy) => strategy.id === id))
    .filter((strategy): strategy is Strategy => strategy !== undefined)

  const byKey = new Map<string, FieldDefinition>()
  for (const strategy of linked) {
    for (const field of strategy.fields) {
      if (!field.enabled) continue
      if (!byKey.has(field.key)) byKey.set(field.key, field)
    }
  }
  return [...byKey.values()]
}
