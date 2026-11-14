import { ZERO, absMoney, minMoney, negateMoney, subtractMoney, sumMoney } from '../../../../../shared/money/money'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../shared/money/money'
import { keyOfRecordId, newRecordId, recordIdOf } from '../../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../../shared/storage/domain/recordId'
import { ITEM_RECORDS } from '../../../workbook/domain/coreKinds'
import { itemIdOfRow, splitLedger, wholeItemId } from '../../../workbook/domain/splits'
import type { LedgerEntry } from '../../../workbook/domain/ledgerReading'
import type { RowRepayments } from '../../../workbook/domain/repayments'
import type { HrDooWorkbook } from './hrDooPart'
import { netReimbursements } from './reimbursements'
import type { ReimbursementRow } from './reimbursements'
import { ownerAdvanceOrder } from '../../../workbook/domain/workbook'
import type { OwnerAdvance, Transaction, Workbook } from '../../../workbook/domain/workbook'
import { ownerAdvances, paymentsToOwner, placeRepayments, storedRepayments } from './ownerAdvances'
import type { RepaidBy } from './ownerAdvancesReading'

/** One item a payment's item becomes once it is placed on the advances it pays back. */
export interface RepaymentPart {
  readonly id: RecordId
  /** The same sign as the payment. */
  readonly amount: Money
  /** What the advance was for, or for what pays back no advance the item's own note. */
  readonly note: string
  /** The advance it pays back, or null for what pays back none. */
  readonly advance: PaidBack | null
}

/** What an item that pays an advance back reads of it. */
type PaidBack = Pick<OwnerAdvance, 'id' | 'description'>

/**
 * The items a payment's item becomes once placed: first what no advance takes, then one item per advance it pays back, which
 * takes the advance's description as its note. The first keeps the item's id, as a split's first part does, and each other one
 * takes the id `idOf` gives its place among them.
 */
export function repaymentParts(
  item: { readonly id: RecordId; readonly amount: Money; readonly note: string },
  shares: readonly { readonly advance: PaidBack; readonly applied: Money }[],
  idOf: (place: number) => RecordId,
): RepaymentPart[] {
  const sign = (amount: Money): Money => (item.amount < 0 ? negateMoney(amount) : amount)
  const rest = subtractMoney(absMoney(item.amount), sumMoney(shares.map((share) => share.applied)))
  const parts = [
    ...(rest > 0 ? [{ amount: sign(rest), note: item.note, advance: null }] : []),
    ...shares.map((share) => ({ amount: sign(share.applied), note: share.advance.description, advance: share.advance })),
  ]
  return parts.map((part, place) => ({ ...part, id: place === 0 ? item.id : idOf(place) }))
}

/** The id the move gives a payment's item's later part: the item's own key with the part's place after it, so a move writes the same ids every time. */
export function movedPartId(item: RecordId, place: number): RecordId {
  return recordIdOf(ITEM_RECORDS, `${keyOfRecordId(ITEM_RECORDS, item)}-${place}`)
}

/** Why the items an advance names cannot all count as what paid it back. */
export type AdvanceItemProblem =
  /** No payment to the owner on a reimbursement category holds the item. */
  | { readonly kind: 'not-a-payment'; readonly item: RecordId }
  /** An older advance names the item already. */
  | { readonly kind: 'named-before'; readonly item: RecordId }
  /** The items add up to more than the owner paid. */
  | { readonly kind: 'more-than-paid'; readonly repaid: Money }

/**
 * What is wrong with the items each advance names, by the advance's id: each must be a payment to the owner on a reimbursement
 * category, no older advance may name it, and together they pay back no more than the owner paid.
 */
export function advanceItemProblems(
  advances: readonly OwnerAdvance[],
  repaidBy: RepaidBy,
  ledger: Pick<Workbook, 'transactions' | 'splits' | 'categories'>,
): ReadonlyMap<RecordId, readonly AdvanceItemProblem[]> {
  const payments = new Map(paymentsToOwner(splitLedger(ledger.transactions, ledger.splits), ledger.categories).map((row) => [itemIdOfRow(row), row]))
  const named = new Set<RecordId>()
  const problems = new Map<RecordId, AdvanceItemProblem[]>()
  for (const advance of [...advances].sort(ownerAdvanceOrder)) {
    const found: AdvanceItemProblem[] = []
    const repaid: Money[] = []
    for (const item of repaidBy.get(advance.id) ?? []) {
      const row = payments.get(item)
      if (row === undefined) found.push({ kind: 'not-a-payment', item })
      else if (named.has(item)) found.push({ kind: 'named-before', item })
      else repaid.push(absMoney(row.amount))
      named.add(item)
    }
    const more = repaidMoreThanPaid(advance.amount, repaid)
    if (more !== null) found.push({ kind: 'more-than-paid', repaid: more })
    if (found.length > 0) problems.set(advance.id, found)
  }
  return problems
}

/** What the payments that paid a cost back add up to when that is more than the owner paid, or null when it is not. */
export function repaidMoreThanPaid(paid: Money, repaid: readonly Money[]): Money | null {
  const total = sumMoney(repaid)
  return total > paid ? total : null
}

/**
 * What the new rows of an import pay back of the advances still open, in books that keep items: each payment to the owner on a
 * reimbursement category, less what a payment from the owner returned the same day, placed as the books matched payments before
 * items. Each such row becomes its items, what pays back no advance under the row's own item id and each advance's part under a new one.
 */
export function proposedRepayments(books: Pick<HrDooWorkbook, 'ownerAdvances' | 'transactions' | 'categories' | 'repaidBy'>, added: readonly LedgerEntry[]): RowRepayments[] {
  if (books.repaidBy === undefined || added.length === 0) return []
  const advances = [...books.ownerAdvances].sort(ownerAdvanceOrder)
  const { shares, named } = storedRepayments(advances, books.repaidBy, books.transactions, books.categories)
  const open = advances.map((advance, index) => ({ advance, open: subtractMoney(advance.amount, sumMoney(shares[index]!.map((share) => share.applied))) })).filter((advance) => advance.open > 0)
  if (open.length === 0) return []
  const last = books.transactions.reduce((highest, row) => Math.max(highest, row.sequence), 0)
  const fresh = [...added].reverse().map((entry, index) => ({ ...entry, sequence: last + index + 1 }))
  const isNew = new Set<ReimbursementRow>(fresh)
  const payments = netReimbursements([...books.transactions.filter((row) => !named.has(row)), ...fresh], books.categories).toOwner.filter((payment) => isNew.has(payment.payment))
  return placeRepayments(open, payments).flatMap((placed): RowRepayments[] => {
    const { payment } = placed
    if (placed.shares.length === 0 || payment.rowId === null) return []
    const parts = repaymentParts({ id: wholeItemId(payment), amount: payment.amount, note: '' }, placed.shares, () => recordIdOf(ITEM_RECORDS, newRecordId()))
    return [{ row: payment.rowId, items: parts.map((part) => ({ id: part.id, amount: part.amount, note: part.note, of: part.advance?.id ?? null })) }]
  })
}

/** A payment to the owner a person may name as what paid back an advance, by the item it holds. */
export interface RepaymentChoice {
  readonly item: RecordId
  /** The payment as the books list it, a part of a split row its own. */
  readonly payment: Transaction
  /** What of it pays this advance back, or for a payment no advance names what of it no advance accounts for, read positive. */
  readonly amount: Money
  /** Whether the advance names it already. */
  readonly named: boolean
}

/**
 * The payments to the owner a person may name as what paid back an advance, in books that keep items: those it names already, and
 * those no advance accounts for in full that were paid on or after the day the owner paid, oldest first. None in books from
 * before items, which match their payments on every read.
 */
export function repaymentChoices(
  books: Pick<HrDooWorkbook, 'ownerAdvances' | 'transactions' | 'categories' | 'repaidBy'>,
  advance: Pick<OwnerAdvance, 'id' | 'date'> | null,
  paidOn: CivilDate,
): RepaymentChoice[] {
  if (books.repaidBy === undefined) return []
  const named = new Set(advance === null ? [] : (books.repaidBy.get(advance.id) ?? []))
  const own = paymentsToOwner(books.transactions, books.categories)
    .filter((row) => named.has(itemIdOfRow(row)))
    .map((payment): RepaymentChoice => ({ item: itemIdOfRow(payment), payment, amount: absMoney(payment.amount), named: true }))
  const free = ownerAdvances(books.ownerAdvances, books.transactions, books.categories, books.repaidBy)
    .unaccounted.filter((line) => line.payment.date >= paidOn)
    .map((line): RepaymentChoice => ({ item: itemIdOfRow(line.payment), payment: line.payment, amount: line.amount, named: false }))
  return [...own, ...free].sort((earlier, later) => earlier.payment.date.localeCompare(later.payment.date) || earlier.payment.sequence - later.payment.sequence)
}

/** What of each chosen payment pays the advance back: all of each it names already, then of each new one what is still open, up to what no advance accounts for. Zero for one the cost no longer needs. */
export function repaymentsPlaced(amount: Money, chosen: readonly RepaymentChoice[]): Money[] {
  let open = subtractMoney(amount, sumMoney(chosen.filter((choice) => choice.named).map((choice) => choice.amount)))
  return chosen.map((choice) => {
    if (choice.named) return choice.amount
    const applied = minMoney(choice.amount, open > 0 ? open : ZERO)
    open = subtractMoney(open, applied)
    return applied
  })
}
