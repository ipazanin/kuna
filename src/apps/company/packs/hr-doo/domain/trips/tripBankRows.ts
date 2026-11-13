import { daysBetween } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { settleOpenRows } from '../../../../../../shared/money/settleOpenRows'
import { normaliseIban } from '../../../../../../shared/text/fold'
import { rowItemsOf } from '../../../../workbook/domain/splits'
import type { LedgerSplit } from '../../../../workbook/domain/splits'
import type { Category, Transaction } from '../../../../workbook/domain/workbook'
import type { Employee } from '../employees/employees'
import { taxFreePaymentOf } from '../packRoles'
import type { Trip } from './trip'
import { settlementPayments } from './tripPayments'
import type { TripPaymentKey } from './tripPayments'
import type { TripFile } from './tripReading'
import type { WorkedSettlement } from './tripSettlement'

/** The two bank rows a trip links: the one that paid its advance and the one that paid out its settlement. */
export const TRIP_ROW_LINKS = ['advance', 'payout'] as const

export type TripRowLink = (typeof TRIP_ROW_LINKS)[number]

/** The row id a trip links for one of its rows, or null. */
export function linkedRowId(trip: Trip, link: TripRowLink): string | null {
  return link === 'advance' ? trip.advanceRow : trip.payoutRow
}

/** The trip with one of its rows linked to a row id, or unlinked by null. */
export function withLinkedRow(trip: Trip, link: TripRowLink, rowId: string | null): Trip {
  return link === 'advance' ? { ...trip, advanceRow: rowId } : { ...trip, payoutRow: rowId }
}

/** The trip with a payment Kuna offered set aside as not its own, so it is offered no more. */
export function withDismissedRow(trip: Trip, rowId: string): Trip {
  return trip.dismissedRows.includes(rowId) ? trip : { ...trip, dismissedRows: [...trip.dismissedRows, rowId] }
}

/** Why a trip cannot link a row, as a fact the screens and the chat word. */
export type TripRowProblem =
  | { readonly kind: 'row-gone'; readonly link: TripRowLink; readonly rowId: string }
  | { readonly kind: 'no-advance' }
  | { readonly kind: 'linked-twice'; readonly link: TripRowLink; readonly number: string }

/** The bank rows as booked, each once however many parts it is split into. */
function wholeRows(transactions: readonly Transaction[]): Transaction[] {
  return [...new Map(transactions.map((row) => [row.split?.whole.id ?? row.id, row.split?.whole ?? row] as const)).values()]
}

/** The booked debit that carries the row id, or null when no debit of the ledger does. */
export function linkedRow(rowId: string | null, transactions: readonly Transaction[]): Transaction | null {
  if (rowId === null) return null
  return wholeRows(transactions).find((row) => row.rowId === rowId && row.amount < 0) ?? null
}

/**
 * Whether a trip's link to a row holds: the row is a debit of the ledger, an advance row belongs to a trip with an advance, and no
 * other link of this or another trip names the same row. The reader shows it as a problem on the trip, and a write that sets the
 * link refuses it.
 */
export function tripRowProblem(trip: Trip, link: TripRowLink, trips: readonly Trip[], transactions: readonly Transaction[]): TripRowProblem | null {
  const rowId = linkedRowId(trip, link)
  if (rowId === null) return null
  if (link === 'advance' && trip.advance === null) return { kind: 'no-advance' }
  if (linkedRow(rowId, transactions) === null) return { kind: 'row-gone', link, rowId }
  const other = trips.find((candidate) => TRIP_ROW_LINKS.some((otherLink) => (candidate.id !== trip.id || otherLink !== link) && linkedRowId(candidate, otherLink) === rowId))
  return other === undefined ? null : { kind: 'linked-twice', link, number: other.number }
}

/** Each problem of each trip's links. */
export function tripRowProblems(trips: readonly Trip[], transactions: readonly Transaction[]): { readonly trip: Trip; readonly problem: TripRowProblem }[] {
  return trips.flatMap((trip) =>
    TRIP_ROW_LINKS.flatMap((link) => {
      const problem = tripRowProblem(trip, link, trips, transactions)
      return problem === null ? [] : [{ trip, problem }]
    }),
  )
}

/** How many days from the day a row is looked for around that a payment to the traveller is offered. */
const SUGGESTION_DAYS = 31

/** A row Kuna offers to link, for a person to confirm. */
export interface TripRowSuggestion {
  readonly link: TripRowLink
  readonly row: Transaction
}

/**
 * The rows Kuna offers for a trip's links not yet set: a debit with a row id to one of the traveller's IBANs, of the advance or of
 * the payout, booked within a month of the day the order departs or the trip was settled, that no trip links and a person did not set
 * aside for this trip, the nearest first.
 */
export function tripRowSuggestions(file: TripFile, settlement: WorkedSettlement | null, traveller: Employee | null, trips: readonly Trip[], transactions: readonly Transaction[]): TripRowSuggestion[] {
  if (traveller === null) return []
  const { trip } = file
  const linked = new Set(trips.flatMap((candidate) => TRIP_ROW_LINKS.flatMap((link) => linkedRowId(candidate, link) ?? [])))
  const ibans = new Set(traveller.ibans)
  const open = wholeRows(transactions).filter(
    (row) => row.amount < 0 && row.rowId !== null && !linked.has(row.rowId) && !trip.dismissedRows.includes(row.rowId) && ibans.has(normaliseIban(row.counterpartyIban)),
  )
  const nearest = (amount: Money, around: CivilDate): Transaction | null =>
    open
      .filter((row) => negateMoney(row.amount) === amount && Math.abs(daysBetween(around, row.date)) <= SUGGESTION_DAYS)
      .reduce<Transaction | null>((best, row) => (best === null || Math.abs(daysBetween(around, row.date)) < Math.abs(daysBetween(around, best.date)) ? row : best), null)
  const advance = trip.advanceRow === null && trip.advance !== null ? nearest(trip.advance, trip.departs) : null
  const payout = trip.payoutRow === null && trip.settledOn !== null && settlement !== null && settlement.payout > 0 ? nearest(settlement.payout, trip.settledOn) : null
  return [...(advance === null ? [] : [{ link: 'advance' as const, row: advance }]), ...(payout === null || payout === advance ? [] : [{ link: 'payout' as const, row: payout }])]
}

/** One part a linked row is filed in by the settlement: a tax-free payment's category, or the row's own for what the traveller returns. */
export interface TripRowPart {
  readonly category: string
  /** Null for the part of an advance the traveller pays back. */
  readonly payment: TripPaymentKey | null
  /** Signed as the row is. */
  readonly amount: Money
}

/** A linked row with the parts the settlement files it in. */
export interface TripRowSplit {
  readonly link: TripRowLink
  readonly row: Transaction
  readonly parts: readonly TripRowPart[]
}

/** Why the settlement cannot file the linked rows. */
export type TripSplitRefusal =
  | { readonly kind: 'not-settled' }
  | { readonly kind: 'nothing-linked' }
  | { readonly kind: 'row-gone'; readonly link: TripRowLink }
  | { readonly kind: 'no-category'; readonly payment: TripPaymentKey }
  | { readonly kind: 'advance-differs'; readonly row: Money; readonly advance: Money }
  | { readonly kind: 'payout-differs'; readonly row: Money; readonly payout: Money }
  | { readonly kind: 'no-category-for-return' }

export type TripSplit = { readonly rows: readonly TripRowSplit[] } | { readonly refused: TripSplitRefusal }

/** The first category that holds a tax-free payment, by its `tax-free:` role. */
function categoryOfPayment(payment: TripPaymentKey, categories: readonly Category[]): Category | null {
  return categories.find((category) => taxFreePaymentOf(category) === payment) ?? null
}

/** The parts with one part per category, in the order the categories first come. */
function mergedParts(parts: readonly TripRowPart[]): TripRowPart[] {
  const merged = new Map<string, TripRowPart>()
  for (const part of parts) {
    const held = merged.get(part.category)
    merged.set(part.category, held === undefined ? part : { ...held, amount: sumMoney([held.amount, part.amount]) })
  }
  return [...merged.values()]
}

/**
 * The linked rows of a settled trip filed by its settlement: per diems, kilometres and the costs the traveller paid, each in the
 * category that holds its tax-free payment. The advance fills first, line by line in that order, and the payout row takes the
 * rest. The advance row must pay the order's advance and the payout row the settlement's payout. An advance larger than what the
 * trip owes keeps what the traveller pays back in the row's own category.
 */
export function tripRowsSplit(file: TripFile, settlement: WorkedSettlement, transactions: readonly Transaction[], categories: readonly Category[]): TripSplit {
  const { trip } = file
  if (trip.settledOn === null) return { refused: { kind: 'not-settled' } }
  if (trip.advanceRow === null && trip.payoutRow === null) return { refused: { kind: 'nothing-linked' } }
  const advanceRow = linkedRow(trip.advanceRow, transactions)
  const payoutRow = linkedRow(trip.payoutRow, transactions)
  if (trip.advanceRow !== null && advanceRow === null) return { refused: { kind: 'row-gone', link: 'advance' } }
  if (trip.payoutRow !== null && payoutRow === null) return { refused: { kind: 'row-gone', link: 'payout' } }
  const payments = settlementPayments(settlement)
  const placed: { payment: TripPaymentKey; category: string; amount: Money }[] = []
  for (const { payment, amount } of payments) {
    const category = categoryOfPayment(payment, categories)
    if (category === null) return { refused: { kind: 'no-category', payment } }
    placed.push({ payment, category: category.slug, amount })
  }
  if (advanceRow !== null && negateMoney(advanceRow.amount) !== settlement.advance) return { refused: { kind: 'advance-differs', row: negateMoney(advanceRow.amount), advance: settlement.advance } }
  if (payoutRow !== null && negateMoney(payoutRow.amount) !== settlement.payout) return { refused: { kind: 'payout-differs', row: negateMoney(payoutRow.amount), payout: settlement.payout } }

  const shares = settleOpenRows(
    placed.map((line) => line.amount),
    settlement.advance,
    () => false,
    () => true,
  )
  const advanceShare = (index: number): Money | null => shares.find((share) => share.index === index)?.applied ?? null
  const toAdvance = placed.flatMap((line, index) => {
    const applied = advanceShare(index)
    return applied === null ? [] : [{ category: line.category, payment: line.payment, amount: negateMoney(applied) }]
  })
  const toPayout = placed.flatMap((line, index) => {
    const left = subtractMoney(line.amount, advanceShare(index) ?? ZERO)
    return left > 0 ? [{ category: line.category, payment: line.payment, amount: negateMoney(left) }] : []
  })
  const rows: TripRowSplit[] = []
  if (advanceRow !== null) {
    const returned = subtractMoney(settlement.advance, sumMoney(toAdvance.map((part) => negateMoney(part.amount))))
    if (returned > 0 && advanceRow.category === '') return { refused: { kind: 'no-category-for-return' } }
    const parts = returned > 0 ? [...toAdvance, { category: advanceRow.category, payment: null, amount: negateMoney(returned) }] : toAdvance
    rows.push({ link: 'advance', row: advanceRow, parts: mergedParts(parts) })
  }
  if (payoutRow !== null) rows.push({ link: 'payout', row: payoutRow, parts: mergedParts(toPayout) })
  return { rows }
}

/** Whether a linked row is already filed as the settlement files it: whole in its one category, or split into its parts. */
export function filedBySettlement(split: TripRowSplit, splits: readonly LedgerSplit[]): boolean {
  const items = rowItemsOf(splits)(split.row)
  if (items.length !== split.parts.length) return false
  const key = (part: { readonly category: string; readonly amount: Money }) => `${part.category} ${part.amount}`
  const wanted = split.parts.map(key).sort()
  return items
    .map(key)
    .sort()
    .every((part, index) => part === wanted[index])
}
