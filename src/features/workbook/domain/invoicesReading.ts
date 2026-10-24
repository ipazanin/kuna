import { labelWords } from './recordCodec'
import type { RecordCodec } from './recordCodec'
import { amountText, filledFields } from './recordFields'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import { INVOICE_RECORDS } from './recordKind'
import { problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { sharedKeys } from './sharedKeys'
import { keyedId, optionalPeriod, refusalOr, refuse, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import type { Invoice, RecordProblem } from './workbook'

/** What an invoice is kept by: its client and its number. */
export function invoiceKeyOf(invoice: Pick<Invoice, 'client' | 'number'>): string {
  return JSON.stringify([invoice.client, invoice.number])
}

export function invoiceIdOf(invoice: Pick<Invoice, 'client' | 'number'>): RecordId {
  return recordIdOf(INVOICE_RECORDS, invoiceKeyOf(invoice))
}

/** An invoice needs its number, client, amount and issue date. A delivery period that cannot be read leaves the issue date standing for it. */
export function invoiceOf(fields: StoredFields, id: RecordId | null): Invoice {
  const number = textOf(fields.number)
  if (number === '') {
    refuse('no invoice number')
  }
  const client = slugOf(fields.client)
  if (client === '') {
    refuse('no client')
  }
  const amount = fields.amount?.money ?? refuse(`the amount "${textOf(fields.amount)}" is not a number`)
  const issued = fields.issued?.date ?? refuse(`the issue date "${textOf(fields.issued)}" is not a date cell`)
  const due = fields.due === undefined ? null : (fields.due.date ?? refuse(`the due date "${fields.due.text}" is not a date cell`))
  const period = deliveryPeriodOf(fields)
  return { number, client, item: textOf(fields.item), amount, issued, due, deliveryPeriod: 'made' in period ? period.made : null, id: keyedId(id) }
}

export const INVOICE_CODEC: RecordCodec<Invoice> = {
  kind: INVOICE_RECORDS,
  key: (fields) => {
    const client = slugOf(fields.client)
    const number = textOf(fields.number)
    return client === '' || number === '' ? null : invoiceKeyOf({ client, number })
  },
  label: (fields) => labelWords([textOf(fields.number)]),
  make: invoiceOf,
  fieldsOf: (invoice) =>
    filledFields({
      number: invoice.number,
      client: invoice.client,
      item: invoice.item,
      amount: amountText(invoice.amount),
      issued: invoice.issued,
      due: invoice.due,
      period_from: invoice.deliveryPeriod?.from,
      period_to: invoice.deliveryPeriod?.to,
    }),
}

function deliveryPeriodOf(fields: StoredFields) {
  return refusalOr(() => optionalPeriod(fields, 'period_from', 'period_to'))
}

/**
 * A number used twice for one client leaves out every record of it, since the matching would count
 * the invoice twice. A client the clients tab lacks and a delivery period that cannot be read are
 * reported, and the invoice kept.
 */
export function readInvoices(read: RecordsRead<Invoice>, clientSlugs: ReadonlySet<string>): Reading<Invoice> {
  const keyOf = (invoice: Invoice): string => `${invoice.client} ${invoice.number}`
  const shared = sharedKeys(
    read.records.map((stored) => stored.record),
    keyOf,
  )
  const invoices: Invoice[] = []
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    const invoice = stored.record
    if (shared.has(keyOf(invoice))) {
      problems.push(problemOf(stored, `invoice ${invoice.number} for ${invoice.client} is listed on more than one row, so none of them counts`))
      continue
    }
    if (!clientSlugs.has(invoice.client)) {
      problems.push(problemOf(stored, `${invoice.client} is not on the clients tab, so no payment can be matched to invoice ${invoice.number}`))
    }
    const period = deliveryPeriodOf(stored.fields)
    if ('refused' in period) {
      problems.push(problemOf(stored, `${period.refused}, so the issue date stands for the delivery period`))
    }
    invoices.push(invoice)
  }
  return { facts: invoices, problems }
}
