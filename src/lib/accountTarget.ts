import type { Account } from './types'

/** Absolute balance that satisfies the account's percent target on initial balance. */
export const getTargetBalance = (account: Account): number | null => {
  if (account.targetPercent === null) return null
  return account.initialBalance * (1 + account.targetPercent / 100)
}

/** True when the account has a target and currentBalance has met or exceeded it. */
export const hasReachedTarget = (account: Account): boolean => {
  const targetBalance = getTargetBalance(account)
  if (targetBalance === null) return false
  return account.currentBalance >= targetBalance
}
