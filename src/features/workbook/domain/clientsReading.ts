import { ibanListOf } from './iban'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import { CLIENT_RECORDS } from './recordKind'
import { problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { sharedKeys } from './sharedKeys'
import { booleanOf, keyedId, refuse, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import type { Client, ClientInvoicing, RecordProblem } from './workbook'

/** A client as the clients tab holds it, with the id its name makes. */
export type ClientRecord = Client & { readonly id: RecordId }

/** An IBAN given twice in the list is read once. */
export function clientOf(fields: StoredFields, id: RecordId | null): ClientRecord {
  const slug = slugOf(fields.client)
  const ibans = [...new Set(ibanListOf(textOf(fields.iban)))]
  if (slug === '' || ibans.length === 0) {
    refuse(slug === '' ? 'no client name' : 'no IBAN')
  }
  return { slug, name: textOf(fields.name), ibans, invoicing: invoicingOf(fields).invoicing, id: keyedId(id) }
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
    doubts.push(`"${mailLanguage}" is not a language such as en or hr, so the mail is written in English`)
    mailLanguage = ''
  }
  const stored = fields.reverse_charge
  const reverseCharge = stored === undefined || stored.text === '' ? false : booleanOf(stored)
  if (reverseCharge === null) {
    doubts.push(`reverse_charge "${stored?.text ?? ''}" is neither TRUE nor FALSE, so it reads as FALSE`)
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
    problems.push(problemOf(stored, `${stored.record.slug} is on ${rows} rows, so none of them counts. Put all its IBANs in the first row, separated by commas, and delete the others`))
  }
  const kept = read.records.filter((stored) => !sharedSlugs.has(stored.record.slug))
  const sharedIbans = sharedKeys(
    kept.flatMap((stored) => stored.record.ibans),
    (iban) => iban,
  )
  for (const stored of kept) {
    for (const iban of stored.record.ibans.filter((candidate) => sharedIbans.has(candidate))) {
      problems.push(problemOf(stored, `${iban} is on another client too, so a payment from it counts for neither`))
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
