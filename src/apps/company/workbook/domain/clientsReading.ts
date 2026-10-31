import { CLIENT_RECORDS } from './coreKinds'
import { ibanListOf } from './iban'
import { filledKey, labelWords } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { booleanOf, keyedId, refuse, slugOf, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Client, ClientInvoicing } from './workbook'
import { words } from './words'

/** A client as the clients tab holds it, with the id its name makes. */
export type ClientRecord = Client & { readonly id: RecordId }

/** An IBAN given twice in the list is read once. */
export function clientOf(fields: StoredFields, id: RecordId | null): ClientRecord {
  const slug = slugOf(fields.client)
  const ibans = [...new Set(ibanListOf(textOf(fields.iban)))]
  if (slug === '' || ibans.length === 0) {
    refuse(slug === '' ? words.clients.noName : words.clients.noIban)
  }
  return { slug, name: textOf(fields.name), ibans, invoicing: invoicingOf(fields).invoicing, id: keyedId(id) }
}

export const CLIENT_CODEC: RecordCodec<ClientRecord> = {
  kind: CLIENT_RECORDS,
  key: (fields) => filledKey(slugOf(fields.client)),
  label: (fields) => labelWords([textOf(fields.client) || textOf(fields.name)]),
  make: clientOf,
  fieldsOf: (client) =>
    filledFields({
      client: client.slug,
      name: client.name,
      iban: client.ibans.join(', '),
      address: client.invoicing.address,
      country: client.invoicing.country,
      tax_id: client.invoicing.taxId,
      invoice_mail: client.invoicing.invoiceMail,
      mail_language: client.invoicing.mailLanguage,
      reverse_charge: client.invoicing.reverseCharge ? true : null,
    }),
}

/** A client made from its fields, with the id its name makes, as an editor makes one. */
export function clientOfFields(fields: StoredFields): ClientRecord {
  return clientOf(fields, recordIdOf(CLIENT_RECORDS, slugOf(fields.client)))
}

/** The invoice fields of one client. A language the browser does not know or a reverse charge that is not TRUE or FALSE is doubted, and read as blank and FALSE. */
function invoicingOf(fields: StoredFields): { readonly invoicing: ClientInvoicing; readonly doubts: readonly string[] } {
  const doubts: string[] = []
  let mailLanguage = textOf(fields.mail_language).toLowerCase()
  if (mailLanguage !== '' && !knownLanguage(mailLanguage)) {
    doubts.push(words.clients.unknownLanguage(mailLanguage))
    mailLanguage = ''
  }
  const stored = fields.reverse_charge
  const reverseCharge = stored === undefined || stored.text === '' ? false : booleanOf(stored)
  if (reverseCharge === null) {
    doubts.push(words.clients.reverseCharge(stored?.text ?? ''))
  }
  return {
    invoicing: {
      address: textOf(fields.address),
      country: textOf(fields.country),
      taxId: textOf(fields.tax_id),
      invoiceMail: textOf(fields.invoice_mail),
      mailLanguage,
      reverseCharge: reverseCharge ?? false,
    },
    doubts,
  }
}

function knownLanguage(tag: string): boolean {
  try {
    return Intl.DateTimeFormat.supportedLocalesOf([tag]).length > 0
  } catch {
    return false
  }
}

/**
 * One record per client. A client named on more than one record is read from none of them. An IBAN
 * on two clients would attribute a payment by where a row sits, so it counts for neither.
 */
export function readClients(read: RecordsRead<ClientRecord>): Reading<ClientRecord> {
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    problems.push(...invoicingOf(stored.fields).doubts.map((doubt) => problemOf(stored, doubt)))
  }
  const sharedSlugs = sharedKeys(read.records, (stored) => stored.record.slug)
  for (const stored of read.records.filter((candidate) => sharedSlugs.has(candidate.record.slug))) {
    const rows = read.records.filter((other) => other.record.slug === stored.record.slug).length
    problems.push(problemOf(stored, words.clients.onSeveralRows(stored.record.slug, rows)))
  }
  const kept = read.records.filter((stored) => !sharedSlugs.has(stored.record.slug))
  const sharedIbans = sharedKeys(
    kept.flatMap((stored) => stored.record.ibans),
    (iban) => iban,
  )
  for (const stored of kept) {
    for (const iban of stored.record.ibans.filter((candidate) => sharedIbans.has(candidate))) {
      problems.push(problemOf(stored, words.clients.sharedIban(iban)))
    }
  }
  return {
    facts: kept.map((stored) => ({ ...stored.record, ibans: stored.record.ibans.filter((iban) => !sharedIbans.has(iban)) })),
    problems,
  }
}

/** The clients the records name, by the same rule the reader applies. */
export function definedClientSlugs(read: RecordsRead<ClientRecord>): ReadonlySet<string> {
  return new Set(readClients(read).facts.map((client) => client.slug))
}
