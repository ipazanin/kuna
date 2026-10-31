import { INVOICE_RECORDS } from './coreKinds'
import { labelWords } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { keyedId, optionalPeriod, refusalOr, refuse, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Invoice } from './workbook'
import { words } from './words'

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
    refuse(words.invoices.noNumber)
  }
  const client = slugOf(fields.client)
  if (client === '') {
    refuse(words.invoices.noClient)
  }
  const amount = fields.amount?.money ?? refuse(words.invoices.notANumber(textOf(fields.amount)))
  const issued = fields.issued?.date ?? refuse(words.invoices.issuedNotADate(textOf(fields.issued)))
  const due = fields.due === undefined ? null : (fields.due.date ?? refuse(words.invoices.dueNotADate(fields.due.text)))
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
      problems.push(problemOf(stored, words.invoices.listedTwice(invoice.number, invoice.client)))
      continue
    }
    if (!clientSlugs.has(invoice.client)) {
      problems.push(problemOf(stored, words.invoices.clientMissing(invoice.client, invoice.number)))
    }
    const period = deliveryPeriodOf(stored.fields)
    if ('refused' in period) {
      problems.push(problemOf(stored, words.invoices.periodUnread(period.refused)))
    }
    invoices.push(invoice)
  }
  return { facts: invoices, problems }
}
