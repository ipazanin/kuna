import { words } from './words'

/** What the checks need of one invoices row. */
interface InvoiceCells {
  readonly number: string
  /** The amount cell, a number on a row the reader reads. */
  readonly amount: string | number | boolean
}

/** One invoices row before and after a change. `before` is null for an added row, `after` for a deleted one. */
export interface InvoiceEdit {
  readonly before: InvoiceCells | null
  readonly after: InvoiceCells | null
}

/**
 * What the invoice generator keeps, so a row the app writes reads like one it wrote. Its number is
 * on no other row of the tab, whatever the client, since the generator refuses a number already
 * filed and the payment matching would count the invoice twice. Its amount is above zero.
 */
export function invoiceChangeRefusals(edits: readonly InvoiceEdit[], untouched: readonly { readonly number: string }[]): string[] {
  const refusals: string[] = []
  const key = (number: string): string => number.trim().toLowerCase()
  for (const edit of edits) {
    const after = edit.after
    if (after === null) {
      continue
    }
    if (key(after.number) !== '' && key(after.number) !== key(edit.before?.number ?? '')) {
      const holder = untouched.find((row) => key(row.number) === key(after.number)) ?? edits.find((other) => other !== edit && other.after !== null && key(other.after.number) === key(after.number))
      if (holder !== undefined) {
        refusals.push(words.numberTaken(after.number.trim()))
      }
    }
    if (typeof after.amount === 'number' && after.amount <= 0) {
      refusals.push(words.notAboveZero(after.number.trim(), after.amount))
    }
  }
  return refusals
}
