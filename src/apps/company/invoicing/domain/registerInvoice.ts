import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../shared/calendar/dateRange'
import { invoiceIdOf } from '../../workbook/domain/invoicesReading'
import type { Invoice } from '../../workbook/domain/workbook'
import { linesTotal, planItemsOf, registerItemOf } from './invoiceLines'
import type { InvoiceLine } from './invoiceLines'

/** What the invoice dialog holds when an invoice goes out. */
export interface MadeInvoice {
  readonly number: string
  readonly client: string
  readonly issued: CivilDate
  readonly due: CivilDate
  readonly deliveryPeriod: DateRange
  readonly lines: readonly InvoiceLine[]
}

/** The register row of a made invoice: its lines joined as the item, their total as the amount, and the plan items behind each line. */
export function registerInvoiceOf(made: MadeInvoice): Invoice {
  const number = made.number.trim()
  const client = made.client.trim().toLowerCase()
  const planItems = planItemsOf(made.lines)
  return {
    number,
    client,
    item: registerItemOf(made.lines),
    ...(planItems === '' ? {} : { planItems }),
    amount: linesTotal(made.lines),
    issued: made.issued,
    due: made.due,
    deliveryPeriod: made.deliveryPeriod,
    id: invoiceIdOf({ client, number }),
  }
}

/**
 * A re-export changes only the item, the amount and the plan items of the row on the register. It keeps
 * the plan items the row holds when its lines name none, as a re-export starts from one typed line, so a
 * retyped item keeps the old record beside it. The record is for display only. Null when nothing changes.
 */
export function reexportedInvoice(before: Invoice, made: Invoice): Invoice | null {
  const planItems = made.planItems ?? before.planItems
  const after: Invoice = { ...before, item: made.item, amount: made.amount, ...(planItems === undefined ? {} : { planItems }) }
  return after.item === before.item && after.amount === before.amount && after.planItems === before.planItems ? null : after
}
