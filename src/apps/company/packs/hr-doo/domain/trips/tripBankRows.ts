import { daysBetween } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { ZERO, negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { settleOpenRows } from '../../../../../../shared/money/settleOpenRows'
import { normaliseIban } from '../../../../../../shared/text/fold'
import { mainItemOf, rowItemsOf } from '../../../../workbook/domain/splits'
import type { SplitPart } from '../../../../workbook/domain/splits'
import type { Category, Transaction, Workbook } from '../../../../workbook/domain/workbook'
import type { RecordId } from '../../../../../../shared/storage/domain/recordId'
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

/** The bank rows a trip's links are read against: the ledger, as read or as booked, and its rows of several items. */
export type TripBooks = Pick<Workbook, 'transactions' | 'splits'>

/** The payment one of a trip's links names: the bank row as booked, and those of its items the link names. */
export interface LinkedPayment {
  readonly row: Transaction
  /** Larger first. */
  readonly items: readonly SplitPart[]
}

/** The items a trip lists for one of its links. */
function listedItems(trip: Trip, link: TripRowLink): readonly RecordId[] {
  return link === 'advance' ? trip.advanceItems : trip.payoutItems
}

/** The row id a trip of books from before items links for one of its links, or null. */
function linkedRowId(trip: Trip, link: TripRowLink): string | null {
  return link === 'advance' ? trip.advanceRow : trip.payoutRow
}

/** Whether one of the trip's links names a payment, whether or not the ledger still holds it. */
export function isLinked(trip: Trip, link: TripRowLink): boolean {
  return listedItems(trip, link).length > 0 || linkedRowId(trip, link) !== null
}

/** What a link names, as its field holds it: the items' ids, or a row id in books from before items. */
function linkedNames(trip: Trip, link: TripRowLink): string {
  const items = listedItems(trip, link)
  return items.length > 0 ? items.join(', ') : (linkedRowId(trip, link) ?? '')
}

/** Why a trip cannot link a row, as a fact the screens and the chat word. */
export type TripRowProblem =
  | { readonly kind: 'row-gone'; readonly link: TripRowLink; readonly named: string; readonly byItems: boolean }
  | { readonly kind: 'no-advance' }
  | { readonly kind: 'linked-twice'; readonly link: TripRowLink; readonly number: string }

/** The bank rows as booked, each once however many parts it is split into. */
function wholeRows(transactions: readonly Transaction[]): Transaction[] {
  return [...new Map(transactions.map((row) => [row.split?.whole.id ?? row.id, row.split?.whole ?? row] as const)).values()]
}

/**
 * The payment one of the trip's links names, or null when it names none or no debit of the ledger holds it: the debit holding every
 * item the link lists, or in books from before items the debit carrying the row id it links, with all its items.
 */
export function linkedPayment(trip: Trip, link: TripRowLink, books: TripBooks): LinkedPayment | null {
  const listed = listedItems(trip, link)
  const rowId = linkedRowId(trip, link)
  if (listed.length === 0 && rowId === null) return null
  const itemsOf = rowItemsOf(books.splits)
  for (const row of wholeRows(books.transactions)) {
    if (row.amount >= 0) continue
    const items = itemsOf(row)
    if (listed.length === 0) {
      if (row.rowId === rowId) return { row, items }
    } else if (listed.every((id) => items.some((item) => item.id === id))) {
      return { row, items: items.filter((item) => listed.includes(item.id)) }
    }
  }
  return null
}

/** Every item of the payments a trip set aside: those it lists, and in books from before items every item of each row it set aside. */
function dismissedItems(trip: Trip, books: TripBooks): ReadonlySet<RecordId> {
  const itemsOf = rowItemsOf(books.splits)
  const rows = wholeRows(books.transactions).filter((row) => row.rowId !== null && trip.dismissedRows.includes(row.rowId))
  return new Set([...trip.dismissedItems, ...rows.flatMap((row) => itemsOf(row).map((item) => item.id))])
}

/** Every item the trips' links name, by the trip and link that name it. */
function linkedItems(trips: readonly Trip[], books: TripBooks): { readonly trip: Trip; readonly link: TripRowLink; readonly items: ReadonlySet<RecordId> }[] {
  return trips.flatMap((trip) =>
    TRIP_ROW_LINKS.flatMap((link) => {
      const payment = linkedPayment(trip, link, books)
      return payment === null ? [] : [{ trip, link, items: new Set(payment.items.map((item) => item.id)) }]
    }),
  )
}

/**
 * Whether a trip's link holds: it names items of a debit of the ledger, an advance link belongs to a trip with an advance, and no
 * other link of this or another trip names one of the same items. The reader shows it as a problem on the trip, and a write that
 * sets the link refuses it.
 */
export function tripRowProblem(trip: Trip, link: TripRowLink, trips: readonly Trip[], books: TripBooks): TripRowProblem | null {
  if (!isLinked(trip, link)) return null
  if (link === 'advance' && trip.advance === null) return { kind: 'no-advance' }
  const payment = linkedPayment(trip, link, books)
  if (payment === null) return { kind: 'row-gone', link, named: linkedNames(trip, link), byItems: listedItems(trip, link).length > 0 }
  const other = linkedItems(trips, books).find((named) => (named.trip.id !== trip.id || named.link !== link) && payment.items.some((item) => named.items.has(item.id)))
  return other === undefined ? null : { kind: 'linked-twice', link, number: other.trip.number }
}

/** Each problem of each trip's links. */
export function tripRowProblems(trips: readonly Trip[], books: TripBooks): { readonly trip: Trip; readonly problem: TripRowProblem }[] {
  return trips.flatMap((trip) =>
    TRIP_ROW_LINKS.flatMap((link) => {
      const problem = tripRowProblem(trip, link, trips, books)
      return problem === null ? [] : [{ trip, problem }]
    }),
  )
}

/**
 * The items each trip's links name, each kept from being taken out or changed by hand since the trip's settlement files it, by
 * the trip's number.
 */
export function itemsTripsFile(trips: readonly Trip[], books: TripBooks): ReadonlyMap<RecordId, string> {
  return new Map(linkedItems(trips, books).flatMap(({ trip, items }) => [...items].map((id) => [id, trip.number] as const)))
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
export function tripRowSuggestions(file: TripFile, settlement: WorkedSettlement | null, traveller: Employee | null, trips: readonly Trip[], books: TripBooks): TripRowSuggestion[] {
  if (traveller === null) return []
  const { trip } = file
  const linked = new Set(linkedItems(trips, books).flatMap(({ items }) => [...items]))
  const dismissed = dismissedItems(trip, books)
  const itemsOf = rowItemsOf(books.splits)
  const ibans = new Set(traveller.ibans)
  const open = wholeRows(books.transactions).filter(
    (row) => row.amount < 0 && row.rowId !== null && itemsOf(row).every((item) => !linked.has(item.id) && !dismissed.has(item.id)) && ibans.has(normaliseIban(row.counterpartyIban)),
  )
  const nearest = (amount: Money, around: CivilDate): Transaction | null =>
    open
      .filter((row) => negateMoney(row.amount) === amount && Math.abs(daysBetween(around, row.date)) <= SUGGESTION_DAYS)
      .reduce<Transaction | null>((best, row) => (best === null || Math.abs(daysBetween(around, row.date)) < Math.abs(daysBetween(around, best.date)) ? row : best), null)
  const advance = !isLinked(trip, 'advance') && trip.advance !== null ? nearest(trip.advance, trip.departs) : null
  const payout = !isLinked(trip, 'payout') && trip.settledOn !== null && settlement !== null && settlement.payout > 0 ? nearest(settlement.payout, trip.settledOn) : null
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

/** A linked payment with the parts the settlement files its items in. */
export interface TripRowSplit {
  readonly link: TripRowLink
  /** The bank row as booked. */
  readonly row: Transaction
  /** The items of the row the link names, which the settlement's parts take the place of. */
  readonly items: readonly SplitPart[]
  readonly parts: readonly TripRowPart[]
  /** What the linked items hold beyond what the settlement pays through them, which stays in their category outside the trip, or null. */
  readonly rest: TripRowPart | null
  /** The row's items the trip does not name, which stay as they are, larger first. */
  readonly others: readonly SplitPart[]
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
  | { readonly kind: 'no-category-for-rest'; readonly link: TripRowLink }

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

/** What the linked items pay, read positive. */
function paidBy(payment: LinkedPayment): Money {
  return negateMoney(sumMoney(payment.items.map((item) => item.amount)))
}

/**
 * The linked payments of a settled trip filed by its settlement: per diems, kilometres and the costs the traveller paid, each in
 * the category that holds its tax-free payment. The advance fills first, line by line in that order, and the payout takes the
 * rest. The advance's items must pay at least the order's advance and the payout's items at least the settlement's payout. An
 * advance larger than what the trip owes keeps what the traveller pays back in the items' own category. Items that pay more than
 * the settlement pays through them keep the rest as one item in their category outside the trip, when `keepsRest` says the books
 * can keep it apart, which only books with an items tab can. Otherwise they must pay exactly that.
 */
export function tripRowsSplit(file: TripFile, settlement: WorkedSettlement, books: TripBooks, categories: readonly Category[], keepsRest: boolean): TripSplit {
  const { trip } = file
  if (trip.settledOn === null) return { refused: { kind: 'not-settled' } }
  if (!isLinked(trip, 'advance') && !isLinked(trip, 'payout')) return { refused: { kind: 'nothing-linked' } }
  const advancePayment = linkedPayment(trip, 'advance', books)
  const payoutPayment = linkedPayment(trip, 'payout', books)
  if (isLinked(trip, 'advance') && advancePayment === null) return { refused: { kind: 'row-gone', link: 'advance' } }
  if (isLinked(trip, 'payout') && payoutPayment === null) return { refused: { kind: 'row-gone', link: 'payout' } }
  const payments = settlementPayments(settlement)
  const placed: { payment: TripPaymentKey; category: string; amount: Money }[] = []
  for (const { payment, amount } of payments) {
    const category = categoryOfPayment(payment, categories)
    if (category === null) return { refused: { kind: 'no-category', payment } }
    placed.push({ payment, category: category.slug, amount })
  }
  const fits = (paid: Money, owed: Money) => paid === owed || (keepsRest && paid > owed)
  if (advancePayment !== null && !fits(paidBy(advancePayment), settlement.advance)) return { refused: { kind: 'advance-differs', row: paidBy(advancePayment), advance: settlement.advance } }
  if (payoutPayment !== null && !fits(paidBy(payoutPayment), settlement.payout)) return { refused: { kind: 'payout-differs', row: paidBy(payoutPayment), payout: settlement.payout } }

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
  const restOf = (payment: LinkedPayment, owed: Money): TripRowPart | null | 'no-category' => {
    const rest = subtractMoney(paidBy(payment), owed)
    if (rest <= 0) return null
    const { category } = mainItemOf(payment.items)
    return category === '' ? 'no-category' : { category, payment: null, amount: negateMoney(rest) }
  }
  const itemsOf = rowItemsOf(books.splits)
  const othersOf = (payment: LinkedPayment) => itemsOf(payment.row).filter((item) => !payment.items.some((linked) => linked.id === item.id))
  const rows: TripRowSplit[] = []
  if (advancePayment !== null) {
    const { category } = mainItemOf(advancePayment.items)
    const returned = subtractMoney(settlement.advance, sumMoney(toAdvance.map((part) => negateMoney(part.amount))))
    if (returned > 0 && category === '') return { refused: { kind: 'no-category-for-return' } }
    const parts = returned > 0 ? [...toAdvance, { category, payment: null, amount: negateMoney(returned) }] : toAdvance
    const rest = restOf(advancePayment, settlement.advance)
    if (rest === 'no-category') return { refused: { kind: 'no-category-for-rest', link: 'advance' } }
    rows.push({ link: 'advance', row: advancePayment.row, items: advancePayment.items, parts: mergedParts(parts), rest, others: othersOf(advancePayment) })
  }
  if (payoutPayment !== null) {
    const rest = restOf(payoutPayment, settlement.payout)
    if (rest === 'no-category') return { refused: { kind: 'no-category-for-rest', link: 'payout' } }
    rows.push({ link: 'payout', row: payoutPayment.row, items: payoutPayment.items, parts: mergedParts(toPayout), rest, others: othersOf(payoutPayment) })
  }
  return { rows }
}

/** What a linked payment pays outside the travel order, read positive: the rest the filing keeps apart and the row's items the trip does not name. */
export function paidOutsideTrip(split: TripRowSplit): Money {
  return negateMoney(sumMoney([...(split.rest === null ? [] : [split.rest.amount]), ...split.others.map((item) => item.amount)]))
}

/** Whether a linked payment's items are already filed as the settlement files them: one item per part, of the same category and amount. */
export function filedBySettlement(split: TripRowSplit): boolean {
  if (split.items.length !== split.parts.length) return false
  const key = (part: { readonly category: string; readonly amount: Money }) => `${part.category} ${part.amount}`
  const wanted = split.parts.map(key).sort()
  return split.items
    .map(key)
    .sort()
    .every((part, index) => part === wanted[index])
}
