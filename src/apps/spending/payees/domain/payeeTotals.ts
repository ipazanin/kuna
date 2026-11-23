import { rowPayeeKey } from './payeeDirectory'
import type { PayeeDirectory } from './payeeDirectory'
import { keyOfPayee } from './payeeDetails'
import { partTotals } from '../../analytics/domain/partTotals'
import type { KeepsPart, PartTotals } from '../../analytics/domain/partTotals'
import type { CountedPart, CountedRow } from '../../analytics/domain/countedRow'
import { rowSide } from '../../categories/domain/rowSide'
import type { Category } from '../../workbook/domain/category'
import { normaliseIban } from '../../../../shared/text/fold'
import { sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/**
 * A payee's figures, counted as Spending's month counts them over the parts filed under a spending or an income category, so
 * they add up to Overview: `spent` is what you paid them less their refunds, and `income` what they paid you.
 */
export interface PayeeTotals extends PartTotals {
  readonly key: string
  /** The payee's first name when a payee you keep details of finds their parts, else as their newest counted part spells it. */
  readonly name: string
  /**
   * The IBANs of the payee you keep details of, then those their counted parts carry, each once, newest first. A part counting under a
   * payee other than its entry's carries none.
   */
  readonly ibans: readonly string[]
}

/** Keeps the parts that count as spending or income, so a transfer, a saving, the company's money and a loan's principal leave no figure. */
const SPENT_OR_RECEIVED: KeepsPart = (_row, part) => part.side === 'spending' || part.side === 'income'

/** Whether any part of the row counts under the payee of the key, so a list by payee shows an entry under each payee its parts name. */
export function countsUnderPayee(row: CountedRow, key: string, directory: Pick<PayeeDirectory, 'payees'>): boolean {
  return row.parts.some((part) => rowPayeeKey(directory, part) === key)
}

/** A payee's parts of one row, by their places in it. */
interface PayeeParts {
  readonly row: CountedRow
  readonly places: Set<number>
}

/**
 * Every payee with a part filed under spending or income. A part counts under its own payee, or the entry's while it has none, so
 * one entry can count under two payees, each with its own parts only. A payee you keep details of gathers the parts of each of its
 * names and IBANs, as `payeeOfRow` finds them, a part with no name included. A part no payee finds counts under its own name, and
 * one with no name names none.
 */
export function payeeTotals(rows: readonly CountedRow[], categories: readonly Category[], directory: Pick<PayeeDirectory, 'payees'>): readonly PayeeTotals[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const byKey = new Map<string, PayeeParts[]>()
  for (const row of rows) {
    rowSide(row, byId).forEach((side, place) => {
      const key = rowPayeeKey(directory, row.parts[place]!)
      if (key === '' || !SPENT_OR_RECEIVED(row, side, place)) return
      const held = byKey.get(key)
      const last = held?.at(-1)
      if (last?.row === row) last.places.add(place)
      else if (held === undefined) byKey.set(key, [{ row, places: new Set([place]) }])
      else held.push({ row, places: new Set([place]) })
    })
  }
  const totals = [...byKey].map(([key, counted]): PayeeTotals => {
    const newestFirst = [...counted].sort((one, other) => other.row.day.localeCompare(one.row.day))
    const partsOf = ({ row, places }: PayeeParts): readonly CountedPart[] => row.parts.filter((_part, place) => places.has(place))
    const record = directory.payees.find((payee) => keyOfPayee(payee) === key)
    const ibans = newestFirst
      .flatMap(partsOf)
      .map((part) => normaliseIban(part.counterpartyIban))
      .filter((iban) => iban !== '')
    const placesOf = new Map(counted.map(({ row, places }) => [row, places]))
    return {
      key,
      name: record?.names[0] ?? partsOf(newestFirst[0]!)[0]!.payee.trim(),
      ibans: [...new Set([...(record?.ibans ?? []), ...ibans])],
      ...partTotals(
        counted.map(({ row }) => row),
        byId,
        (row, part, place) => SPENT_OR_RECEIVED(row, part, place) && placesOf.get(row)?.has(place) === true,
      ),
    }
  })
  return totals.sort((one, other) => one.name.localeCompare(other.name))
}

/** Which way the money went between you and a payee. */
export type PayeeSide = 'paid' | 'received'

/** The payees that took the most money on a side, and the rest as one line, null while none is left over. */
export interface PayeesRanked {
  readonly top: readonly PayeeTotals[]
  readonly rest: { readonly payees: number; readonly sum: Money } | null
}

/** What a payee counts on the side. */
export function payeeAmount(totals: PayeeTotals, side: PayeeSide): Money {
  return side === 'paid' ? totals.spent : totals.income
}

/** The payees above zero on the side, the largest first, the first `shown` of them on their own and the rest as one line. */
export function payeesRanked(totals: readonly PayeeTotals[], side: PayeeSide, shown = 10): PayeesRanked {
  const ranked = totals.filter((payee) => payeeAmount(payee, side) > 0).sort((one, other) => payeeAmount(other, side) - payeeAmount(one, side) || one.name.localeCompare(other.name))
  const rest = ranked.slice(shown)
  return {
    top: ranked.slice(0, shown),
    rest: rest.length === 0 ? null : { payees: rest.length, sum: sumMoney(rest.map((payee) => payeeAmount(payee, side))) },
  }
}
