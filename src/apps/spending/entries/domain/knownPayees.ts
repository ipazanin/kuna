import { fold } from '../../../../shared/text/fold'
import type { Transaction } from '../../workbook/domain/transaction'

/** How many known payees the list offers at most, so one typed letter does not list the whole book. */
export const PAYEE_CHOICES = 8

/**
 * The payees on the books' money in and out, once each however their case and accents differ, most recently paid first and spelt as on their newest row without the spaces around it.
 * A move between your own accounts names no payee to offer, so its legs are left out.
 */
export function knownPayees(transactions: readonly Pick<Transaction, 'date' | 'payee' | 'pair'>[]): string[] {
  const newestFirst = transactions.filter((transaction) => transaction.pair === null && transaction.payee.trim() !== '').sort((left, right) => right.date.localeCompare(left.date))
  const byFolded = new Map<string, string>()
  for (const transaction of newestFirst) {
    const folded = fold(transaction.payee)
    if (!byFolded.has(folded)) byFolded.set(folded, transaction.payee.trim())
  }
  return [...byFolded.values()]
}

/**
 * What the payee list offers for the typed text: the known payees whose name holds it anywhere, ignoring case and accents, in the order given and at most `PAYEE_CHOICES` of them.
 * The first choice is the one Enter takes. It is the known payee the text names, or else the text as typed, so a new payee stays as typed. Blank text, or text no payee holds, offers nothing.
 */
export function payeeChoices(payees: readonly string[], typed: string): string[] {
  const wanted = fold(typed)
  if (wanted === '') return []
  const matching = payees.filter((payee) => fold(payee).includes(wanted))
  if (matching.length === 0) return []
  const same = matching.find((payee) => fold(payee) === wanted)
  const leading = same ?? typed
  return [leading, ...matching.filter((payee) => payee !== same).slice(0, PAYEE_CHOICES - (same === undefined ? 0 : 1))]
}
