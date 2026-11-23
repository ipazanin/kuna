import { samePayee } from '../../payees/domain/payeeKey'
import { euroRows } from '../../rates/domain/euroRows'
import type { EuroRow } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import { OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import type { TransactionItem } from '../../workbook/domain/transactionItem'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { RateBook } from '../../../../shared/money/rateBook'
import { moneyParts } from '../../../../shared/money/decimal'
import { ZERO, addMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One part of a counted row: what it is filed under, who it counts under and its share of the row's euros, null while the rates do not reach the row's day. */
export interface CountedPart extends Pick<TransactionItem, 'category' | 'labels' | 'event'> {
  /** The part's own payee, or the entry's while it has none. */
  readonly payee: string
  /** The entry's IBAN while the part counts under the entry's payee, blank under another. */
  readonly counterpartyIban: string
  readonly euros: Money | null
}

/** A row as every figure counts it: its day, the account it is on and its parts. */
export interface CountedRow {
  readonly day: CivilDate
  /** Null for a shared cost, which sits on no account. */
  readonly account: RecordId | null
  /** At least one, in the order of the row's items. */
  readonly parts: readonly CountedPart[]
}

/** Each item's share of the row's euros, a discount item's of the other sign, so the shares add up to the row. */
function eurosOfItems({ euros, items }: EuroRow): readonly (Money | null)[] {
  if (euros === null) return items.map(() => null)
  return moneyParts(
    euros,
    items.map((item) => BigInt(item.amount)),
  )
}

/**
 * The row as the figures count it. A part counts under its own payee when it has one, else under the entry's, and no figure reads
 * a payee any other way. A part in a shared cost keeps its payee but sits under In a shared cost, which counts nowhere, and carries
 * no label or event, so it counts in no figure while its shared cost counts its money.
 */
export function countedRowOf(row: EuroRow): CountedRow {
  const euros = eurosOfItems(row)
  const { transaction } = row
  return {
    day: transaction.date,
    account: transaction.account,
    parts: row.items.map(({ category, labels, event, payee, sharedCost }, place) => {
      const own = payee.trim() !== '' && !samePayee(payee, transaction.payee)
      const member = sharedCost !== null
      return {
        category,
        labels: member ? [] : labels,
        event: member ? OUT_OF_EVENTS : event,
        payee: own ? payee : transaction.payee,
        counterpartyIban: own ? '' : transaction.counterpartyIban,
        euros: euros[place] ?? null,
      }
    }),
  }
}

/**
 * A shared cost as the figures count it: on its own day, on no account, as one part under its own category, labels, event and
 * payee, with its members' euros added up, each at its own row's rate, signed as the money moved. While a member's euros are not
 * known yet, neither is the sum.
 */
function sharedCostRowOf(sharedCost: SharedCost, members: readonly (Money | null)[]): CountedRow {
  const { day, category, labels, event, payee } = sharedCost
  return { day, account: null, parts: [{ category, labels, event, payee, counterpartyIban: '', euros: sharedCostEuros(members) }] }
}

/** What a shared cost counts in euros: its members' euros added up, or null while one of them is not known yet. */
export function sharedCostEuros(members: readonly (Money | null)[]): Money | null {
  return members.reduce<Money | null>((sum, member) => (sum === null || member === null ? null : addMoney(sum, member)), ZERO)
}

type CountedBook = Pick<SpendingBook, 'accounts' | 'transactions' | 'items' | 'sharedCosts'>

/** The rows of the book as the figures count them, each at the rate of its day, and each shared cost by its id, in the book's order. */
function countedBook(book: CountedBook, rates: RateBook): { readonly rows: CountedRow[]; readonly sharedCosts: ReadonlyMap<RecordId, CountedRow> } {
  const members = new Map<RecordId, (Money | null)[]>()
  const rows = euroRows(book, rates).map((row) => {
    const counted = countedRowOf(row)
    row.items.forEach((item, place) => {
      if (item.sharedCost !== null) members.set(item.sharedCost, [...(members.get(item.sharedCost) ?? []), counted.parts[place]?.euros ?? null])
    })
    return counted
  })
  return { rows, sharedCosts: new Map(book.sharedCosts.map((sharedCost) => [sharedCost.id, sharedCostRowOf(sharedCost, members.get(sharedCost.id) ?? [])])) }
}

/** Every row of the book as the figures count it, each at the rate of its day, then every shared cost on its own day. */
export function countedRows(book: CountedBook, rates: RateBook): CountedRow[] {
  const { rows, sharedCosts } = countedBook(book, rates)
  return [...rows, ...sharedCosts.values()]
}

/** What each shared cost counts, by its id, as countedRows counts it. */
export function sharedCostCounts(book: CountedBook, rates: RateBook): ReadonlyMap<RecordId, CountedRow> {
  return countedBook(book, rates).sharedCosts
}
