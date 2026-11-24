import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { linesTotal } from '../../invoicing/domain/invoiceLine'
import type { InvoiceLine } from '../../invoicing/domain/invoiceLine'
import { registerItemOf } from '../../invoicing/domain/invoiceLines'
import { invoiceIdOf } from '../../workbook/domain/invoicesReading'
import type { Invoice } from '../../workbook/domain/workbook'

/** The parts of an invoice an edit gives. A part left out keeps what the invoice holds, and null clears the due date or the work period. */
export interface InvoiceChanges {
  readonly number?: string
  readonly client?: string
  /** The lines the invoice now has, which also give it its item and amount. */
  readonly lines?: readonly InvoiceLine[]
  readonly issued?: CivilDate
  readonly due?: CivilDate | null
  readonly deliveryPeriod?: Invoice['deliveryPeriod']
}

/** The invoice an edit leaves: what the edit gives and the rest as the invoice holds it, with the id following its client and number. */
export function changedInvoice(before: Invoice, changes: InvoiceChanges): Invoice {
  const number = changes.number ?? before.number
  const client = changes.client ?? before.client
  const { lines } = changes
  const linesPart =
    lines === undefined
      ? { item: before.item, ...(before.lines === undefined ? {} : { lines: before.lines }), amount: before.amount }
      : { item: registerItemOf(lines), lines, amount: linesTotal(lines) }
  return {
    number,
    client,
    ...linesPart,
    issued: changes.issued ?? before.issued,
    due: changes.due === undefined ? before.due : changes.due,
    deliveryPeriod: changes.deliveryPeriod === undefined ? before.deliveryPeriod : changes.deliveryPeriod,
    id: invoiceIdOf({ client, number }),
  }
}
