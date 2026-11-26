import { ACCOUNT_RECORDS, BILLING_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS, SETTING_RECORDS } from '../../workbook/domain/coreKinds'
import { counted, countedBy, usesOf } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { readAccounts } from '../../workbook/domain/accountsReading'
import { readClients } from '../../workbook/domain/clientsReading'
import type { ClientRecord } from '../../workbook/domain/clientsReading'
import type { RecordsOfKind } from '../../workbook/domain/readWorkbook'
import { ibanListOf } from '../../../../shared/text/iban'
import { slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { storedFieldsOf } from '../../../../shared/storage/domain/recordsRead'
import { pickedEdits, pickedUntouched } from '../../../../shared/storage/domain/writeRules'
import type { FreshRecords, WriteRules } from '../../../../shared/storage/domain/writeRules'
import { clientChangeRefusals } from '../domain/clientGuards'
import type { ClientCells, ClientChecks } from '../domain/clientGuards'
import { words } from './words'

/** What names each client outside its tab: invoices, billing plan rows and the billing_client setting. */
function clientUses(records: RecordsOfKind): SlugUses {
  const billingClient = storedFieldsOf(records(SETTING_RECORDS)).find((fields) => slugOf(fields.key) === 'billing_client')
  return usesOf([
    countedBy(storedFieldsOf(records(INVOICE_RECORDS)), (fields) => [slugOf(fields.client)], counted(words.uses.invoices)),
    countedBy(storedFieldsOf(records(BILLING_RECORDS)), (fields) => [slugOf(fields.client)], counted(words.uses.billingPlanRows)),
    new Map(billingClient === undefined || slugOf(billingClient.value) === '' ? [] : [[slugOf(billingClient.value), words.uses.billingClient]]),
  ])
}

/** The cells of a client its checks read. */
export function clientCellsOf(fields: StoredFields): ClientCells {
  return { slug: slugOf(fields.client), ibans: ibanListOf(textOf(fields.iban)), lines: textOf(fields.invoice_lines) }
}

/** What a change to the clients is checked against: what names each client, and the IBANs of your own accounts. */
export function clientChecksOf(records: FreshRecords): ClientChecks {
  return {
    named: clientUses((kind) => records.of(kind)),
    accountIbans: new Map(readAccounts(records.of(ACCOUNT_RECORDS), null).facts.flatMap((account) => (account.iban === '' ? [] : [[account.iban, account.slug] as const]))),
  }
}

/** A client keeps to the slug format and to one row, keeps its name while invoices, plan rows or billing_client name it, and its IBANs are valid, its own and none of the accounts'. */
export const CLIENT_WRITES: WriteRules<ClientRecord> = {
  kind: CLIENT_RECORDS,
  reads: [ACCOUNT_RECORDS, INVOICE_RECORDS, BILLING_RECORDS, SETTING_RECORDS],
  undoable: true,
  read: (read) => readClients(read),
  refusals: (change, fresh) =>
    clientChangeRefusals(
      pickedEdits(change, clientCellsOf),
      pickedUntouched(change, clientCellsOf).filter((client) => client.slug !== ''),
      clientChecksOf(fresh),
    ).map(words.clientRefusal),
}
