import { moneyFromAmount } from './money'
import type { Money } from './money'
import { typedAmount } from './typedAmount'

/**
 * An amount as a whole number of cents of an account's own currency, which may not be euros. It is a different type from
 * `Money` so that dollars never pass for euros. Only `eurosOfAccountMoney` turns it into `Money`, at a rate book's rate of a day.
 */
export type AccountMoney = number & { readonly __unit: 'account-cents' }

export const ZERO_ACCOUNT_MONEY = 0 as AccountMoney

export function accountMoneyFromCents(cents: number): AccountMoney {
  if (!Number.isInteger(cents)) {
    throw new RangeError(`${cents} is not a whole number of cents.`)
  }
  return (cents + 0) as AccountMoney
}

/** Euros as the cents of an account kept in euros, which is the only account that can hold them. */
export function accountMoneyOfEuros(euros: Money): AccountMoney {
  return accountMoneyFromCents(euros)
}

/** Reads a decimal amount as a Sheet cell holds it, rounded half away from zero to the cent. */
export function accountMoneyFromAmount(amount: number): AccountMoney {
  return accountMoneyFromCents(moneyFromAmount(amount))
}

/** What a person typed in a field, or null when it does not read as an amount. */
export function typedAccountAmount(text: string): AccountMoney | null {
  const typed = typedAmount(text)
  return typed === null ? null : accountMoneyFromCents(typed)
}

export function addAccountMoney(left: AccountMoney, right: AccountMoney): AccountMoney {
  return (left + right) as AccountMoney
}

export function subtractAccountMoney(left: AccountMoney, right: AccountMoney): AccountMoney {
  return (left - right) as AccountMoney
}

export function negateAccountMoney(amount: AccountMoney): AccountMoney {
  return (0 - amount) as AccountMoney
}

export function absAccountMoney(amount: AccountMoney): AccountMoney {
  return Math.abs(amount) as AccountMoney
}

export function sumAccountMoney(amounts: Iterable<AccountMoney>): AccountMoney {
  let total = 0
  for (const amount of amounts) {
    total += amount
  }
  return total as AccountMoney
}
