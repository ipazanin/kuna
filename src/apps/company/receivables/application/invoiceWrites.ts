import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { ITEM_WRITES } from '../../transactions/application/itemWrites'
import { definedClientSlugs } from '../../workbook/domain/clientsReading'
import { CLIENT_RECORDS, INVOICE_RECORDS } from '../../workbook/domain/coreKinds'
import { readInvoices } from '../../workbook/domain/invoicesReading'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { ItemRecord } from '../../workbook/domain/splitsReading'
import type { Invoice } from '../../workbook/domain/workbook'
import { pickedEdits, pickedUntouched } from '../../../../shared/storage/domain/writeRules'
import type { WriteRules } from '../../../../shared/storage/domain/writeRules'
import { invoiceChangeRefusals } from '../domain/invoiceGuards'

function invoiceOfFields(fields: StoredFields): { readonly number: string; readonly amount: string | number } {
  return { number: textOf(fields.number), amount: fields.amount?.number ?? textOf(fields.amount) }
}

/** An invoice's number is on no other record, whatever the client, its amount is above zero, and its client is on the clients tab. */
export const INVOICE_WRITES: WriteRules<Invoice> = {
  kind: INVOICE_RECORDS,
  reads: [CLIENT_RECORDS],
  undoable: true,
  read: (read, records) => readInvoices(read, definedClientSlugs(records.of(CLIENT_RECORDS))),
  refusals: (change) =>
    invoiceChangeRefusals(
      pickedEdits(change, invoiceOfFields),
      pickedUntouched(change, (fields) => ({ number: textOf(fields.number) })),
    ),
}

/** Changes the invoice, and when its client or number gives it a new id, the payments placed on it follow it in the same write. */
export function changeInvoice(unit: UnitOfWork, items: RecordsRead<ItemRecord>, before: Invoice, after: Invoice): void {
  unit.of(INVOICE_WRITES).change(before, after)
  placePaymentsOn(unit, items, before.id, after.id)
}

/** Deletes the invoice, and the payments placed on it wait to be placed again. */
export function removeInvoice(unit: UnitOfWork, items: RecordsRead<ItemRecord>, invoice: Invoice): void {
  unit.of(INVOICE_WRITES).remove(invoice)
  placePaymentsOn(unit, items, invoice.id, null)
}

function placePaymentsOn(unit: UnitOfWork, items: RecordsRead<ItemRecord>, from: RecordId, to: RecordId | null): void {
  if (from === to) return
  for (const { record } of items.records) {
    if (record.invoice === from) unit.of(ITEM_WRITES).change(record, { ...record, invoice: to })
  }
}
