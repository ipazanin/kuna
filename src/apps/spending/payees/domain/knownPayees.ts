import { holdsName } from './payeeDetails'
import { payeeKey } from './payeeKey'
import type { Payee } from '../../workbook/domain/payee'
import type { Transaction } from '../../workbook/domain/transaction'

/** How many known payees the list offers at most, so one typed letter does not list the whole book. */
export const PAYEE_CHOICES = 8

/**
 * The payees on the books' money in and out, once each however their case and accents differ, most recently paid first. A payee
 * you keep details of shows once under its first name for every spelling it holds, and another payee as spelt on their newest row
 * without the spaces around it. A move between your own accounts names no payee to offer, so its legs are left out.
 */
export function knownPayees(transactions: readonly Pick<Transaction, 'date' | 'payee' | 'pair'>[], payees: readonly Pick<Payee, 'names'>[]): string[] {
  const newestFirst = transactions.filter((transaction) => transaction.pair === null && transaction.payee.trim() !== '').sort((left, right) => right.date.localeCompare(left.date))
  const byKey = new Map<string, string>()
  for (const transaction of newestFirst) {
    const name = payees.find((payee) => holdsName(payee, transaction.payee))?.names[0] ?? transaction.payee.trim()
    const key = payeeKey(name)
    if (!byKey.has(key)) byKey.set(key, name)
  }
  return [...byKey.values()]
}

/** Whether the typed text names no known payee and no spelling of a payee you keep details of, so saving it adds a new one. Blank text names none and adds none. */
export function isNewPayee(known: readonly string[], payees: readonly Pick<Payee, 'names'>[], typed: string): boolean {
  const key = payeeKey(typed)
  return key !== '' && !known.some((payee) => payeeKey(payee) === key) && !payees.some((payee) => holdsName(payee, typed))
}

/**
 * What the payee list offers for the typed text: first the choice Enter takes, then the known payees whose name holds the text anywhere, ignoring case and accents, in the order given and at most `PAYEE_CHOICES` of them.
 * Enter takes the known payee the text names in full, spelt as the books spell it, or else the text as typed, a new payee. Blank text offers nothing.
 */
export function payeeChoices(payees: readonly string[], typed: string): string[] {
  const wanted = payeeKey(typed)
  if (wanted === '') return []
  const matching = payees.filter((payee) => payeeKey(payee).includes(wanted))
  const same = matching.find((payee) => payeeKey(payee) === wanted)
  const leading = same ?? typed
  return [leading, ...matching.filter((payee) => payee !== same).slice(0, PAYEE_CHOICES - (same === undefined ? 0 : 1))]
}
