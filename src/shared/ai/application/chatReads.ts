import type { AppReader, AssistantReport, ReadableField, ReadableKind, ReadableRow } from '../../app/assistantReader'
import { accountMoneyFromCents } from '../../money/accountMoney'
import { currencyCodeOf } from '../../money/currencyCode'
import { moneyFromCents, plainAmount } from '../../money/money'
import { percentFromBasisPoints, percentText } from '../../money/percent'
import { nameIn } from '../../privacy/domain/names'
import type { KnownPerson, Pseudonyms } from '../../privacy/domain/pseudonyms'
import type { RecordNoun } from '../../storage/domain/recordKind'
import { fold, normaliseIban } from '../../text/fold'
import type { ChatRefs, FigureAmount } from '../domain/chatRefs'

/** A page of records, and the most a page may hold whatever a model asks for. */
const DEFAULT_LIMIT = 20
const MOST_LIMIT = 50

/** What one chat keeps to read through, none of it stored. `mayRead` is the gate: nothing reads an app's books before it says yes. */
export interface ChatReads {
  readonly readers: ReadonlyMap<string, { readonly name: string; readonly reader: AppReader }>
  readonly pseudonyms: Pseudonyms
  readonly refs: ChatRefs
  /** Whether Anonymise is on, read at each call, so a change of the setting holds from the next read. */
  anonymising(): boolean
  /** The people the apps know by name, read at each call, as the books change. */
  persons(): readonly KnownPerson[]
  mayRead(app: string): Promise<boolean>
}

/** What a read sent, in terms the row that shows it can word in either language. */
export type ReadSent =
  | { readonly kind: 'records'; readonly app: string; readonly noun: RecordNoun; readonly count: number }
  | { readonly kind: 'figures'; readonly app: string; readonly title: string }
  | { readonly kind: 'refusal'; readonly app: string }

export interface ChatToolAnswer {
  readonly text: string
  readonly isError: boolean
  /** Set on an answer that holds something from a person's books, which the row under the answer shows as sent. */
  readonly read?: ReadSent
}

export interface FindRecordsInput {
  readonly app: string
  readonly kind: string
  readonly query: string | null
  readonly from: string | null
  readonly to: string | null
  readonly about: string | null
  readonly limit: number | null
  readonly cursor: string | null
}

const PERIOD = /^\d{4}-\d{2}(?:-\d{2})?$/
const NO_APP = 'That app has nothing to read in this chat. Take the app from the instructions.'
const NOT_ALLOWED = 'The person did not allow reading this app. Carry on with what you have and say what you could not read.'
const ABOUT_AN_EMPLOYEE = 'That record is about an employee or their pay, so it stays on this device while Anonymise is on. Say so.'

function refusal(text: string): ChatToolAnswer {
  return { text, isError: true }
}

function fileNotOpen(status: 'opening' | 'none'): ChatToolAnswer {
  return refusal(
    status === 'opening'
      ? 'This app is still opening its file. Ask the person to try again in a moment.'
      : 'This app has no file open on this device, so there is nothing to read. Say so, and link its screen.',
  )
}

type ValueOfRow = Extract<ReadableField, { readonly value: unknown }>

function hasValue(field: ReadableField): field is ValueOfRow {
  return 'value' in field
}

/** Gives the people the apps know an alias each, before anything leaves, so an alias reads the same however a read went. */
function knownPersons(reads: ChatReads): readonly KnownPerson[] {
  const persons = reads.persons()
  reads.pseudonyms.know(persons.filter((person) => !person.employee).map((person) => person.name))
  return persons
}

/** Whether a record names an employee in any of its text, or goes to an IBAN an employee is paid into. */
function aboutAnEmployee(row: ReadableRow, employees: readonly KnownPerson[]): boolean {
  return row.fields.some((field) => {
    if (!hasValue(field) || typeof field.value !== 'string' || field.value === '') return false
    const text = field.value
    if (field.exposure === 'identifier') return employees.some((employee) => employee.ibans.includes(normaliseIban(text)))
    return employees.some((employee) => nameIn(text, employee.name))
  })
}

/** A text field as it leaves while Anonymise is on: an identifier under its token, and known people under their alias in what a person wrote. */
function pseudonymisedField(field: ValueOfRow, value: string, pseudonyms: Pseudonyms): string {
  if (value === '' || field.exposure === 'plain') return value
  return field.exposure === 'identifier' ? pseudonyms.identifierToken(value) : pseudonyms.pseudonymised(value)
}

/** A field's value as it leaves: pseudonymised while Anonymise is on, or as stored otherwise. The model loop masks IBANs and OIBs either way. */
function leaving(field: ValueOfRow, reads: ChatReads): unknown {
  return typeof field.value === 'string' && reads.anonymising() ? pseudonymisedField(field, field.value, reads.pseudonyms) : field.value
}

/** A record's amount as a figure the answer can cite, in an account's currency or the app's, or null for a currency Kuna does not know. */
function amountOf(field: Extract<ReadableField, { readonly cents: number }>): FigureAmount | null {
  const currency = currencyCodeOf(field.currency)
  if (currency === null) return null
  return field.of === 'account' ? { of: 'account', cents: accountMoneyFromCents(field.cents), currency } : { of: 'app', cents: moneyFromCents(field.cents), currency }
}

/** One record as the model reads it: a ref for itself and each it points at, each amount with a figure ref the answer can cite, blanks and false flags left out. */
function shownRow(app: string, kind: ReadableKind, row: ReadableRow, reads: ChatReads): Readonly<Record<string, unknown>> {
  const shown: Record<string, unknown> = { ref: reads.refs.recordRef({ app, kind: kind.name, id: row.id }) }
  for (const field of row.fields) {
    if (field.name === 'id') continue
    if (field.exposure === 'ref') {
      if (field.id !== null && field.id !== '') shown[field.name] = reads.refs.recordRef({ app, kind: field.to, id: field.id })
    } else if ('cents' in field) {
      const amount = amountOf(field)
      shown[field.name] =
        amount === null
          ? `${plainAmount(field.cents)} ${field.currency}`
          : { amount: `${plainAmount(field.cents)} ${field.currency}`, ref: reads.refs.figureRef(`${app}/${kind.name}/${row.id}/${field.name}`, amount) }
      reads.refs.noteAmount(field.cents)
    } else {
      const value = leaving(field, reads)
      if (value !== '' && value !== null && value !== false) shown[field.name] = value
    }
  }
  return shown
}

/**
 * Whether the query is in a field as it would leave. While Anonymise is on, a person's name matches only as their alias,
 * so a search cannot spell out a name letter by letter. An identifier never matches, so it cannot be guessed digit by digit.
 */
function holdsQuery(row: ReadableRow, query: string, reads: ChatReads): boolean {
  const alias = reads.anonymising() && reads.pseudonyms.valueOf(query) !== null ? query.trim() : null
  const exactly = alias === null ? null : new RegExp(`(?<![\\p{L}\\p{N}])${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}]| #\\d)`, 'u')
  const words = fold(query)
  return row.fields.some((field) => {
    if (!hasValue(field) || typeof field.value !== 'string' || field.exposure === 'identifier') return false
    const text = String(leaving(field, reads))
    return exactly !== null ? exactly.test(text) : fold(text).includes(words)
  })
}

function dateOf(row: ReadableRow, kind: ReadableKind): string {
  const field = row.fields.find((candidate) => candidate.name === kind.dated)
  return field !== undefined && hasValue(field) && typeof field.value === 'string' ? field.value : ''
}

function pointsAt(row: ReadableRow, id: string): boolean {
  return row.id === id || row.fields.some((field) => field.exposure === 'ref' && field.id === id)
}

/** The employees whose records stay home: every one the apps know while Anonymise is on, and none while it is off. */
function employeesKeptHome(persons: readonly KnownPerson[], reads: ChatReads): readonly KnownPerson[] {
  return reads.anonymising() ? persons.filter((person) => person.employee) : []
}

/** Searches an app's records, newest first, by words or an alias, by a span of days, and by a record they point at. Records about employees stay out while Anonymise is on, and the answer counts them. */
export async function findRecords(input: FindRecordsInput, reads: ChatReads): Promise<ChatToolAnswer> {
  const app = reads.readers.get(input.app)
  if (app === undefined) return refusal(NO_APP)
  const kind = app.reader.kinds.find((candidate) => candidate.name === input.kind)
  if (kind === undefined) return refusal(`That kind cannot be read. It can be one of: ${app.reader.kinds.map((known) => known.name).join(', ')}.`)
  if ((input.from !== null && !PERIOD.test(input.from)) || (input.to !== null && !PERIOD.test(input.to))) return refusal('A date reads as 2026-10-31 or 2026-10.')
  if ((input.from !== null || input.to !== null) && kind.dated === null) return refusal('This kind has no date to filter by.')
  const about = input.about === null ? null : reads.refs.recordOf(input.about)
  if (input.about !== null && (about === null || about.app !== input.app)) return refusal('That ref is not one Kuna handed out in this app.')
  const start = input.cursor === null ? 0 : Number(input.cursor)
  if (!Number.isInteger(start) || start < 0) return refusal('Take the cursor from the last page.')
  if (input.limit !== null && (!Number.isInteger(input.limit) || input.limit < 1)) return refusal('A limit is a whole number above zero.')

  if (!(await reads.mayRead(input.app))) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotOpen(status)

  const employees = employeesKeptHome(knownPersons(reads), reads)
  const query = input.query === null || input.query.trim() === '' ? null : input.query
  const inRange = kind
    .rows()
    .filter((row) => about === null || pointsAt(row, about.id))
    .filter((row) => {
      const date = dateOf(row, kind)
      return (input.from === null || date >= input.from) && (input.to === null || date.slice(0, input.to.length) <= input.to)
    })
  const kept = inRange.filter((row) => !aboutAnEmployee(row, employees))
  const matching = query === null ? kept : kept.filter((row) => holdsQuery(row, query, reads))
  const newestFirst = kind.dated === null ? matching : [...matching].sort((left, right) => dateOf(right, kind).localeCompare(dateOf(left, kind)))
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MOST_LIMIT)
  const page = newestFirst.slice(start, start + limit)
  const next = start + limit < newestFirst.length ? String(start + limit) : null
  const leftOut = inRange.length - kept.length
  const text = JSON.stringify({
    source: `${input.app}/${kind.name}`,
    untrusted: true,
    total: newestFirst.length,
    ...(leftOut > 0 ? { leftOutAboutEmployees: leftOut } : {}),
    records: page.map((row) => shownRow(input.app, kind, row, reads)),
    nextCursor: next,
  })
  return { text, isError: false, read: { kind: 'records', app: app.name, noun: kind.noun, count: page.length } }
}

/** One record, by a ref Kuna handed out in this chat. A record about an employee stays home while Anonymise is on. */
export async function getRecord(appId: string, ref: string, reads: ChatReads): Promise<ChatToolAnswer> {
  const app = reads.readers.get(appId)
  if (app === undefined) return refusal(NO_APP)
  const record = reads.refs.recordOf(ref)
  if (record === null || record.app !== appId) return refusal('That ref is not one Kuna handed out in this app.')
  const kind = app.reader.kinds.find((candidate) => candidate.name === record.kind)
  if (kind === undefined) return refusal('That kind cannot be read.')
  if (!(await reads.mayRead(appId))) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotOpen(status)
  const row = kind.rows().find((candidate) => candidate.id === record.id)
  if (row === undefined) return refusal('That record is no longer in the file.')
  if (aboutAnEmployee(row, employeesKeptHome(knownPersons(reads), reads))) return refusal(ABOUT_AN_EMPLOYEE)
  return {
    text: JSON.stringify({ source: `${appId}/${kind.name}`, untrusted: true, record: shownRow(appId, kind, row, reads) }),
    isError: false,
    read: { kind: 'records', app: app.name, noun: kind.noun, count: 1 },
  }
}

function shownFigures(appId: string, report: AssistantReport, period: string | null, reads: ChatReads): readonly Readonly<Record<string, unknown>>[] {
  return report.figures(period).map((figure) => {
    if ('cents' in figure) {
      return {
        ref: reads.refs.figureRef(`${appId}/${report.id}/${period ?? ''}/${figure.label}`, figure),
        label: figure.label,
        amount: `${plainAmount(figure.cents)} ${figure.currency}`,
      }
    }
    if ('basisPoints' in figure) {
      const points = Math.abs(figure.basisPoints)
      reads.refs.noteRate(points)
      return { label: figure.label, rate: `${figure.basisPoints < 0 ? '-' : ''}${percentText(percentFromBasisPoints(points))}` }
    }
    return { label: figure.label, count: figure.count }
  })
}

/** Figures Kuna computed with its own functions, each amount with a ref the answer can quote. */
export async function readFigures(appId: string, reportId: string, period: string | null, reads: ChatReads): Promise<ChatToolAnswer> {
  const app = reads.readers.get(appId)
  if (app === undefined) return refusal(NO_APP)
  const report = app.reader.reports.find((candidate) => candidate.id === reportId)
  if (report === undefined) return refusal(`There is no such report. It can be one of: ${app.reader.reports.map((known) => known.id).join(', ')}.`)
  if (period !== null && !PERIOD.test(period)) return refusal(report.period === 'month' ? 'A month reads as 2026-10.' : 'A day reads as 2026-10-31.')
  if (!(await reads.mayRead(appId))) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotOpen(status)
  try {
    const figures = shownFigures(appId, report, period, reads)
    return { text: JSON.stringify({ source: `${appId}/${report.id}`, computedBy: 'Kuna', period, figures }), isError: false, read: { kind: 'figures', app: app.name, title: report.title } }
  } catch (failure) {
    if (failure instanceof RangeError) return refusal(report.period === 'month' ? 'A month reads as 2026-10.' : 'A day reads as 2026-10-31.')
    throw failure
  }
}
