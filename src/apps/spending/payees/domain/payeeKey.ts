import { fold } from '../../../../shared/text/fold'

/**
 * A payee's name with case, accents and extra spaces folded away, so "Café on the square" and "CAFE ON THE SQUARE" are one
 * payee. Blank for a row with no payee. What groups rows by payee is `rowPayeeKey`, which first asks the payees you keep
 * details of and falls back on this.
 */
export function payeeKey(payee: string): string {
  return fold(payee)
}

/** Whether two names are the same payee. */
export function samePayee(one: string, other: string): boolean {
  return payeeKey(one) === payeeKey(other)
}

/** A part's payee as the file keeps it: trimmed, and blank when it names the entry's payee, since a part with none counts under the entry's. */
export function partPayeeOf(payee: string, entryPayee: string): string {
  return samePayee(payee, entryPayee) ? '' : payee.trim()
}
