import { normaliseIban } from '../../../shared/text/fold'
import { recordIdOf } from './recordId'
import type { RecordId } from './recordId'
import { CLIENT_RECORDS } from './recordKind'
import { problemOf, refusedProblems } from './recordsRead'
import type { Reading, RecordsRead } from './recordsRead'
import { sharedKeys } from './sharedKeys'
import { booleanOf, keyedId, refuse, slugOf, textOf } from './storedFields'
import type { StoredFields } from './storedFields'
import { NO_CLIENT_INVOICING } from './workbook'
import type { Client, ClientInvoicing, RecordProblem } from './workbook'

/** One record of the `clients` tab: a client and one IBAN it pays from. */
export interface ClientRow {
  readonly slug: string
  readonly name: string
  readonly iban: string
  readonly invoicing: ClientRowInvoicing
  /** By its IBAN. */
  readonly id: RecordId
}

/** The invoice fields of one clients record, with `reverseCharge` null where the field is blank. */
type ClientRowInvoicing = Omit<ClientInvoicing, 'reverseCharge'> & { readonly reverseCharge: boolean | null }

export function clientRowOf(fields: StoredFields, id: RecordId | null): ClientRow {
  const slug = slugOf(fields.client)
  const iban = normaliseIban(textOf(fields.iban))
  if (slug === '' || iban === '') {
    refuse(slug === '' ? 'no client name' : 'no IBAN')
  }
  return { slug, name: textOf(fields.name), iban, invoicing: invoicingOf(fields).invoicing, id: keyedId(id) }
}

/** A client row made from its fields, with the id its IBAN makes, as an editor makes one. */
export function clientRowOfFields(fields: StoredFields): ClientRow {
  return clientRowOf(fields, recordIdOf(CLIENT_RECORDS, normaliseIban(textOf(fields.iban))))
}

/** The invoice fields of one clients record. A language the browser does not know or a reverse charge that is not TRUE or FALSE is doubted, and read as blank. */
function invoicingOf(fields: StoredFields): { readonly invoicing: ClientRowInvoicing; readonly doubts: readonly string[] } {
  const doubts: string[] = []
  let mailLanguage = textOf(fields.mail_language).toLowerCase()
  if (mailLanguage !== '' && !knownLanguage(mailLanguage)) {
    doubts.push(`"${mailLanguage}" is not a language such as en or hr, so the mail is written in English`)
    mailLanguage = ''
  }
  const stored = fields.reverse_charge
  const reverseCharge = stored === undefined || stored.text === '' ? null : booleanOf(stored)
  if (reverseCharge === null && stored !== undefined && stored.text !== '') {
    doubts.push(`reverse_charge "${stored.text}" is neither TRUE nor FALSE, so it reads as FALSE`)
  }
  return {
    invoicing: {
      address: textOf(fields.address),
      country: textOf(fields.country),
      taxId: textOf(fields.tax_id),
      invoiceMail: textOf(fields.invoice_mail),
      mailLanguage,
      reverseCharge,
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
 * One record per IBAN. An IBAN on more than one record would attribute a payment by where a row
 * sits, so every record of it is left out. A name or invoice detail a client's records give
 * differently is reported on each of them, and reads blank.
 */
export function readClients(read: RecordsRead<ClientRow>): Reading<ClientRow> {
  const problems: RecordProblem[] = refusedProblems(read)
  for (const stored of read.records) {
    problems.push(...invoicingOf(stored.fields).doubts.map((doubt) => problemOf(stored, doubt)))
  }
  const shared = sharedKeys(read.records, (stored) => stored.record.iban)
  for (const stored of read.records.filter((candidate) => shared.has(candidate.record.iban))) {
    problems.push(problemOf(stored, `${stored.record.iban} is on more than one row, so none of them counts`))
  }
  const kept = read.records.filter((stored) => !shared.has(stored.record.iban))
  const facts = kept.map((stored) => stored.record)
  for (const [slug, ofClient] of rowsByClient(facts)) {
    const { differing } = clientOf(slug, ofClient)
    if (differing.length > 0) {
      const reason = `the rows of ${slug} give ${differing.join(', ')} differently, so ${differing.length === 1 ? 'it reads' : 'they read'} blank`
      problems.push(...kept.filter((stored) => stored.record.slug === slug).map((stored) => problemOf(stored, reason)))
    }
  }
  return { facts, problems }
}

/** The clients the records name, by the same rule the reader applies. */
export function definedClientSlugs(read: RecordsRead<ClientRow>): ReadonlySet<string> {
  return new Set(readClients(read).facts.map((row) => row.slug))
}

export function clientsOf(rows: readonly ClientRow[]): Client[] {
  return [...rowsByClient(rows)].map(([slug, ofClient]) => clientOf(slug, ofClient).client)
}

function rowsByClient(rows: readonly ClientRow[]): Map<string, ClientRow[]> {
  const bySlug = new Map<string, ClientRow[]>()
  for (const row of rows) {
    bySlug.set(row.slug, [...(bySlug.get(row.slug) ?? []), row])
  }
  return bySlug
}

/** One client from its records: every IBAN they give, and each name and invoice detail they agree on, by the field it comes from. */
function clientOf(slug: string, rows: readonly ClientRow[]): { readonly client: Client; readonly differing: readonly string[] } {
  const differing: string[] = []
  const agreed = <Value extends string | boolean>(field: string, values: readonly (Value | null)[]): Value | null => {
    const filled = [...new Set(values.filter((value): value is Value => value !== null && value !== ''))]
    if (filled.length > 1) {
      differing.push(field)
    }
    return filled.length === 1 ? filled[0]! : null
  }
  const client: Client = {
    slug,
    name: agreed('name', rows.map((row) => row.name)) ?? '',
    ibans: rows.map((row) => row.iban),
    invoicing: {
      address: agreed('address', rows.map((row) => row.invoicing.address)) ?? NO_CLIENT_INVOICING.address,
      country: agreed('country', rows.map((row) => row.invoicing.country)) ?? NO_CLIENT_INVOICING.country,
      taxId: agreed('tax_id', rows.map((row) => row.invoicing.taxId)) ?? NO_CLIENT_INVOICING.taxId,
      invoiceMail: agreed('invoice_mail', rows.map((row) => row.invoicing.invoiceMail)) ?? NO_CLIENT_INVOICING.invoiceMail,
      mailLanguage: agreed('mail_language', rows.map((row) => row.invoicing.mailLanguage)) ?? NO_CLIENT_INVOICING.mailLanguage,
      reverseCharge: agreed('reverse_charge', rows.map((row) => row.invoicing.reverseCharge)) ?? NO_CLIENT_INVOICING.reverseCharge,
    },
  }
  return { client, differing }
}
