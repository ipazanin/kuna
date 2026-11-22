import { CLIENT_RECORDS } from './coreKinds'
import { ibanListOf } from '../../../../shared/text/iban'
import { filledKey, labelWords } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { problemOf, refusedProblems } from '../../../../shared/storage/domain/recordsRead'
import type { Reading, RecordProblem, RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { sharedKeys } from '../../../../shared/storage/domain/sharedKeys'
import { booleanOf, keyedId, refuse, slugOf, storedFieldOfValue, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Client, ClientInvoicing } from './workbook'
import { words } from './words'
import { templateOfText, templateProblems, textOfTemplate } from '../../invoicing/domain/invoiceTemplate'
import type { InvoiceTemplateLine } from '../../invoicing/domain/invoiceTemplate'
import { templateProblemsInWords } from '../../invoicing/domain/words'

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
      invoice_lines: client.invoicing.lines === undefined ? null : textOfTemplate(client.invoicing.lines),
    }),
}

/** The text fields of a client a dialog or the chat may change, by their stored names. */
export type ClientTextField = 'client' | 'name' | 'iban' | 'address' | 'country' | 'tax_id' | 'invoice_mail' | 'mail_language'

/** What a change sets on a client, each absent to keep what the client holds. */
export interface ClientChanges {
  readonly texts?: Partial<Readonly<Record<ClientTextField, string>>>
  readonly reverseCharge?: boolean
  readonly lines?: readonly InvoiceTemplateLine[]
}

/**
 * The client's stored fields with the changes made, as the clients grid writes them: each text trimmed and absent
 * when blank, the short name in lower case, reverse charge TRUE or absent, and the invoice lines absent while there
 * are none. Fields the change does not name stay as stored.
 */
export function clientFieldsWith(stored: StoredFields, changes: ClientChanges): StoredFields {
  const fields: Record<string, StoredField> = { ...stored }
  const set = (name: string, value: string | boolean | null): void => {
    if (value === null || value === '' || value === false) delete fields[name]
    else fields[name] = storedFieldOfValue(value)
  }
  for (const [name, text] of Object.entries(changes.texts ?? {})) {
    set(name, name === 'client' ? text.trim().toLowerCase() : text.trim())
  }
  if (changes.reverseCharge !== undefined) set('reverse_charge', changes.reverseCharge)
  if (changes.lines !== undefined) set('invoice_lines', changes.lines.length === 0 ? null : textOfTemplate(changes.lines))
  return fields
}

/** A client made from its fields, with the id its name makes, as an editor makes one. */
export function clientOfFields(fields: StoredFields): ClientRecord {
  return clientOf(fields, recordIdOf(CLIENT_RECORDS, slugOf(fields.client)))
}

/**
 * The invoice fields of one client. A language the browser does not know, a reverse charge that is not
 * TRUE or FALSE and invoice lines that break a rule are doubted, and read as blank, FALSE and no lines.
 */
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
  const template = templateOfText(textOf(fields.invoice_lines))
  const problems = templateProblems(template)
  if (problems.length > 0) {
    doubts.push(words.clients.badLines(templateProblemsInWords(problems).join(', ')))
  }
  return {
    invoicing: {
      address: textOf(fields.address),
      country: textOf(fields.country),
      taxId: textOf(fields.tax_id),
      invoiceMail: textOf(fields.invoice_mail),
      mailLanguage,
      reverseCharge: reverseCharge ?? false,
      ...(template.length === 0 || problems.length > 0 ? {} : { lines: template }),
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
