import { definedClientSlugs } from '../../workbook/domain/clientsReading'
import { readInvoices } from '../../workbook/domain/invoicesReading'
import { CLIENT_RECORDS, INVOICE_RECORDS } from '../../workbook/domain/recordKind'
import { textOf } from '../../workbook/domain/storedFields'
import type { StoredFields } from '../../workbook/domain/storedFields'
import type { Invoice } from '../../workbook/domain/workbook'
import { pickedEdits, pickedUntouched } from '../../workbook/domain/writeRules'
import type { WriteRules } from '../../workbook/domain/writeRules'
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
