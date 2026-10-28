import { definedClientSlugs } from '../../workbook/domain/clientsReading'
import { CLIENT_RECORDS, INVOICE_RECORDS } from '../../workbook/domain/coreKinds'
import { readInvoices } from '../../workbook/domain/invoicesReading'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
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
