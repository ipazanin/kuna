import { keyOfPayee, withoutSpelling } from './payeeDetails'
import { countsUnderPayee } from './payeeTotals'
import type { CountedRow } from '../../analytics/domain/countedRow'
import type { Payee } from '../../workbook/domain/payee'

/** Another spelling a payee holds, with how many entries stop counting under the payee when it is taken off. */
export interface PayeeSpelling {
  readonly name: string
  readonly leaving: number
}

/** How many of the counted rows stop counting under the payee once it is kept as `without`, the other payees as they are. */
function leavingOf(counted: readonly CountedRow[], payees: readonly Payee[], payee: Payee, without: Payee): number {
  const key = keyOfPayee(payee)
  const directory = { payees: payees.map((held) => (held.id === payee.id ? without : held)) }
  return counted.filter((row) => !countsUnderPayee(row, key, directory)).length
}

function countedUnder(rows: readonly CountedRow[], payees: readonly Payee[], payee: Payee): readonly CountedRow[] {
  const key = keyOfPayee(payee)
  return rows.filter((row) => countsUnderPayee(row, key, { payees }))
}

/**
 * How many entries count under the payee now and no longer would once it is kept as `without`, such as with one spelling or
 * IBAN taken off. An entry stays when the payee still finds it another way, such as by an IBAN it holds.
 */
export function entriesLeaving(rows: readonly CountedRow[], payees: readonly Payee[], payee: Payee, without: Payee): number {
  return leavingOf(countedUnder(rows, payees, payee), payees, payee, without)
}

/** Each spelling of the payee after its first name, in its order, with the entries that leave the payee once that spelling alone is taken off. */
export function payeeSpellings(rows: readonly CountedRow[], payees: readonly Payee[], payee: Payee): readonly PayeeSpelling[] {
  const counted = countedUnder(rows, payees, payee)
  return payee.names.slice(1).map((name) => ({ name, leaving: leavingOf(counted, payees, payee, withoutSpelling(payee, name)) }))
}
