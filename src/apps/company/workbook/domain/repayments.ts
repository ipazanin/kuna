import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** One item a new bank row's money becomes when part of it pays back a record a pack keeps, such as a cost the owner paid. */
export interface RepaymentItem {
  readonly id: RecordId
  /** The same sign as the row. */
  readonly amount: Money
  /** What it pays back, such as what the cost was for, which the item takes as its note. */
  readonly note: string
  /** The record it pays back, or null for what pays back none. */
  readonly of: RecordId | null
}

/** A new bank row's money as the items it becomes once it pays back what a pack keeps, which add up to the row. */
export interface RowRepayments {
  /** The row's id. */
  readonly row: string
  readonly items: readonly RepaymentItem[]
}
