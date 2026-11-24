import { UNREADABLE_AMOUNT } from '../../../../shared/money/money'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import type { InvoiceLine } from '../domain/invoiceLine'

/** A line as typed, the amount as text until it reads as money. */
export interface LineDraft {
  description: string
  amount: string
  /** The plan items the line sums, kept while its text or amount is typed over. */
  readonly items: readonly string[]
}

export function linesOf(drafts: readonly LineDraft[]): InvoiceLine[] {
  return drafts.map((draft) => ({ description: draft.description.trim(), amount: typedAmount(draft.amount) ?? UNREADABLE_AMOUNT, items: draft.items }))
}

export function draftOf(line: InvoiceLine): LineDraft {
  return { description: line.description, amount: amountForTyping(line.amount), items: line.items }
}
