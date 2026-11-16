import { payeeKey } from './payeeKey'
import { partTotals } from '../../analytics/domain/partTotals'
import type { KeepsPart, PartTotals } from '../../analytics/domain/partTotals'
import { rowSide } from '../../categories/domain/rowSide'
import type { EuroRow } from '../../rates/domain/euroRows'
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
  /** The payee as their newest counted row spells it. */
  readonly name: string
  /** The IBANs their counted rows carry, each once, newest first. */
  readonly ibans: readonly string[]
}

/** Keeps the parts that count as spending or income, so a transfer, a saving, the company's money and a loan's principal leave no figure. */
const SPENT_OR_RECEIVED: KeepsPart = (_row, part) => part.side === 'spending' || part.side === 'income'

/** Every payee with a row filed under spending or income, by name. A row with no payee names none. */
export function payeeTotals(rows: readonly EuroRow[], categories: readonly Category[]): readonly PayeeTotals[] {
  const byId = new Map(categories.map((category) => [category.id, category]))
  const byKey = new Map<string, EuroRow[]>()
  for (const row of rows) {
    const key = payeeKey(row.transaction.payee)
    if (key === '' || !rowSide(row, byId).some((part, place) => SPENT_OR_RECEIVED(row, part, place))) continue
    const held = byKey.get(key)
    if (held === undefined) byKey.set(key, [row])
    else held.push(row)
  }
  const totals = [...byKey].map(([key, counted]): PayeeTotals => {
    const newestFirst = [...counted].sort((one, other) => other.transaction.date.localeCompare(one.transaction.date))
    const ibans = newestFirst.map((row) => normaliseIban(row.transaction.counterpartyIban)).filter((iban) => iban !== '')
    return { key, name: newestFirst[0]!.transaction.payee.trim(), ibans: [...new Set(ibans)], ...partTotals(counted, byId, SPENT_OR_RECEIVED) }
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
