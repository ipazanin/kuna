import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { invoiceIdOf } from '../../workbook/domain/invoicesReading'
import type { Invoice } from '../../workbook/domain/workbook'
import { linesTotal, textOfLines } from './invoiceLine'
import type { InvoiceLine } from './invoiceLine'
import { registerItemOf } from './invoiceLines'

/** What the invoice dialog holds when an invoice goes out. */
export interface MadeInvoice {
  readonly number: string
  readonly client: string
  readonly issued: CivilDate
  readonly due: CivilDate
  readonly deliveryPeriod: DateRange
  readonly lines: readonly InvoiceLine[]
}

/** The register row of a made invoice: its lines, their texts joined as the item and their total as the amount. */
export function registerInvoiceOf(made: MadeInvoice): Invoice {
  const number = made.number.trim()
  const client = made.client.trim().toLowerCase()
  return {
    number,
    client,
    item: registerItemOf(made.lines),
    lines: made.lines.map((line) => ({ description: line.description.trim(), amount: line.amount, items: line.items })),
    amount: linesTotal(made.lines),
    issued: made.issued,
    due: made.due,
    deliveryPeriod: made.deliveryPeriod,
    id: invoiceIdOf({ client, number }),
  }
}

/**
 * The lines a register row stands for, which a re-export and the invoice dialog start from: the lines the invoice went out with, or
 * one line of its item at its amount for a row that keeps none.
 */
export function invoiceLinesOf(invoice: Pick<Invoice, 'item' | 'amount' | 'lines'>): readonly InvoiceLine[] {
  return invoice.lines ?? [{ description: invoice.item, amount: invoice.amount, items: [] }]
}

/** A re-export changes only the item, the amount and the lines of the row on the register. Null when none of them changes. */
export function reexportedInvoice(before: Invoice, made: Invoice): Invoice | null {
  const { lines } = made
  const after: Invoice = { ...before, item: made.item, amount: made.amount, ...(lines === undefined ? {} : { lines }) }
  return after.item === before.item && after.amount === before.amount && textOfLines(before.lines ?? []) === textOfLines(after.lines ?? []) ? null : after
}
