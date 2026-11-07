import { accountMoneyFromCents } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { booleanOf, optionalMoney, refuse, requiredMoney, textOf, wholeNumberOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words } from './words'

/** A true or false field, false when blank. */
export function flagOf(fields: StoredFields, name: string): boolean {
  const field = fields[name]
  if (field === undefined) return false
  return booleanOf(field) ?? refuse(words.notAFlag(name, field.text))
}

/** A whole number field, zero when blank. */
export function orderOf(fields: StoredFields, name: string): number {
  const field = fields[name]
  if (field === undefined) return 0
  return wholeNumberOf(field) ?? refuse(words.notAWholeNumber(name, textOf(field)))
}

/** An amount field in the currency of the account it belongs to. */
export function requiredAccountMoney(fields: StoredFields, name: string): AccountMoney {
  return accountMoneyFromCents(requiredMoney(fields, name))
}

/** An amount field in the currency of the account it belongs to, or null when blank. */
export function optionalAccountMoney(fields: StoredFields, name: string): AccountMoney | null {
  const amount = optionalMoney(fields, name)
  return amount === null ? null : accountMoneyFromCents(amount)
}
