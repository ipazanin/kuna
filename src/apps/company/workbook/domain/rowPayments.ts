import { absMoney, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ITEM_RECORDS } from './coreKinds'

/** One item a bank row's money becomes when part of it pays a record, such as an invoice or a cost the owner paid. */
export interface PaymentItem {
  readonly id: RecordId
  /** The same sign as the row. */
  readonly amount: Money
  /** The note the item takes, such as what the cost was for. */
  readonly note: string
  /** The record it pays, or null for what pays none. */
  readonly of: RecordId | null
}

/** A new bank row's money as the items it becomes once it pays the records it pays, which add up to the row. */
export interface RowPayments {
  /** The row's id. */
  readonly row: string
  readonly items: readonly PaymentItem[]
}

/** A record an item's money pays, with the note the part that pays it takes. */
export interface PaidRecord {
  readonly id: RecordId
  readonly note: string
}

/**
 * The items an item becomes once placed on the records it pays: first what pays none, which keeps the item's note, then one item
 * per record, which takes that record's note. The first keeps the item's id, as a split's first part does, and each other one
 * takes the id `idOf` gives its place among them.
 */
export function paymentParts(
  item: { readonly id: RecordId; readonly amount: Money; readonly note: string },
  shares: readonly { readonly paid: PaidRecord; readonly applied: Money }[],
  idOf: (place: number) => RecordId,
): PaymentItem[] {
  const sign = (amount: Money): Money => (item.amount < 0 ? negateMoney(amount) : amount)
  const rest = subtractMoney(absMoney(item.amount), sumMoney(shares.map((share) => share.applied)))
  const parts = [...(rest > 0 ? [{ amount: sign(rest), note: item.note, of: null }] : []), ...shares.map((share) => ({ amount: sign(share.applied), note: share.paid.note, of: share.paid.id }))]
  return parts.map((part, place) => ({ ...part, id: place === 0 ? item.id : idOf(place) }))
}

/** The id the move gives an item's later part: the item's own key with the part's place after it, so a move writes the same ids every time. */
export function movedPartId(item: RecordId, place: number): RecordId {
  return recordIdOf(ITEM_RECORDS, `${keyOfRecordId(ITEM_RECORDS, item)}-${place}`)
}
