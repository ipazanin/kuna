import { keyOfPayee } from './payeeDetails'
import { payeeKey } from './payeeKey'
import { countsUnderPayee } from './payeeTotals'
import type { CountedRow } from '../../analytics/domain/countedRow'
import type { Payee } from '../../workbook/domain/payee'

/** Another spelling a payee holds, with how many entries stop counting under the payee when it is taken off. */
export interface PayeeSpelling {
  readonly name: string
  readonly leaving: number
}

/**
 * Each spelling of the payee after its first name, in its order, with the entries that count under the payee now and no longer
 * would once that spelling alone is taken off. An entry of that spelling stays when the payee still finds it, such as by an IBAN
 * the payee holds.
 */
export function payeeSpellings(rows: readonly CountedRow[], payees: readonly Payee[], payee: Payee): readonly PayeeSpelling[] {
  const key = keyOfPayee(payee)
  const counted = rows.filter((row) => countsUnderPayee(row, key, { payees }))
  return payee.names.slice(1).map((name) => {
    const without = { ...payee, names: payee.names.filter((held) => payeeKey(held) !== payeeKey(name)) }
    const directory = { payees: payees.map((held) => (held.id === payee.id ? without : held)) }
    return { name, leaving: counted.filter((row) => !countsUnderPayee(row, key, directory)).length }
  })
}
