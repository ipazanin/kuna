import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../../shared/money/money'
import { registerLinesProblems } from '../../invoicing/domain/invoiceLine'
import type { RegisterLinesProblem } from '../../invoicing/domain/invoiceLine'

/** What the checks need of one invoices row. */
interface InvoiceCells {
  readonly number: string
  /** The amount cell, a number on a row the reader reads. */
  readonly amount: string | number | boolean
  /** The lines cell, blank on a row that keeps no lines. */
  readonly lines: string
}

/** One invoices row before and after a change. `before` is null for an added row, `after` for a deleted one. */
export interface InvoiceEdit {
  readonly before: InvoiceCells | null
  readonly after: InvoiceCells | null
}

/** Why a change to the invoices tab is refused, with the invoice's number as typed. */
export type InvoiceRefusal =
  | { readonly kind: 'number-taken'; readonly number: string }
  | { readonly kind: 'not-above-zero'; readonly number: string; readonly amount: number }
  | { readonly kind: 'bad-lines'; readonly number: string; readonly problems: readonly RegisterLinesProblem[] }

/**
 * What the invoice generator keeps, so a row the app writes reads like one it wrote. Its number is
 * on no other row of the tab, whatever the client, since the generator refuses a number already
 * filed and the payment matching would count the invoice twice. Its amount is above zero. A change
 * that gives new lines or a new amount keeps lines that add up to the amount, so a row whose lines
 * were broken in the sheet still takes a change of its due date.
 */
export function invoiceChangeRefusals(edits: readonly InvoiceEdit[], untouched: readonly { readonly number: string }[]): InvoiceRefusal[] {
  const refusals: InvoiceRefusal[] = []
  const key = (number: string): string => number.trim().toLowerCase()
  for (const edit of edits) {
    const after = edit.after
    if (after === null) {
      continue
    }
    if (key(after.number) !== '' && key(after.number) !== key(edit.before?.number ?? '')) {
      const holder = untouched.find((row) => key(row.number) === key(after.number)) ?? edits.find((other) => other !== edit && other.after !== null && key(other.after.number) === key(after.number))
      if (holder !== undefined) {
        refusals.push({ kind: 'number-taken', number: after.number.trim() })
      }
    }
    if (typeof after.amount === 'number' && after.amount <= 0) {
      refusals.push({ kind: 'not-above-zero', number: after.number.trim(), amount: after.amount })
    }
    const linesGiven = edit.before === null || after.lines !== edit.before.lines || after.amount !== edit.before.amount
    const lines = linesGiven && typeof after.amount === 'number' ? registerLinesProblems(after.lines, moneyFromAmount(after.amount)) : []
    if (lines.length > 0) {
      refusals.push({ kind: 'bad-lines', number: after.number.trim(), problems: lines })
    }
  }
  return refusals
}

/** What is wrong with an invoice's dates: a due day before its issue day, and a delivery period with one end only or ending before it starts. */
export interface InvoiceDatesProblems {
  readonly due: 'before-issue' | null
  readonly period: 'one-end' | 'order' | null
}

/** An invoice falls due on or after its issue day, and its delivery period has both ends or none, the first not after the last. */
export function invoiceDatesProblems(issued: CivilDate | null, due: CivilDate | null, from: CivilDate | null, to: CivilDate | null): InvoiceDatesProblems {
  return {
    due: due !== null && issued !== null && due < issued ? 'before-issue' : null,
    period: (from === null) !== (to === null) ? 'one-end' : from !== null && to !== null && to < from ? 'order' : null,
  }
}
