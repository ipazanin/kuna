import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** An entry the person adds again and again, such as the morning coffee, which one tap writes for today. Its parts say where the money goes. */
export interface Shortcut {
  readonly id: RecordId
  /** Ascending, the order the buttons show in. */
  readonly order: number
  /** What the button says, or blank to show the payee. */
  readonly name: string
  readonly account: RecordId
  readonly payee: string
}

/** One part of the entry a shortcut writes. One part writes an entry not split, and two or more write one entry split into them. */
export interface ShortcutPart {
  readonly id: RecordId
  readonly shortcut: RecordId
  /** Signed as the entry is, below zero for money out and never zero, in the account's currency. */
  readonly amount: AccountMoney
  readonly category: RecordId
  readonly note: string
  readonly labels: readonly RecordId[]
}
