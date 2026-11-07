import type { AppReader, AssistantReport, ReadableField, ReadableKind, ReadableRow } from '../../app/assistantReader'
import { plainAmount } from '../../money/money'
import { percentFromBasisPoints, percentText } from '../../money/percent'
import type { RecordNoun } from '../../storage/domain/recordKind'
import { fold } from '../../text/fold'
import type { ChatRefs } from '../domain/chatRefs'
import { anonymisedCounterparty, anonymisedText } from '../domain/sensitiveText'
import type { AliasKind, ChatAliases } from '../domain/sensitiveText'

/** A page of records, and the most a page may hold whatever a model asks for. */
const DEFAULT_LIMIT = 20
const MOST_LIMIT = 50

/** What one chat keeps to read through, none of it stored. `mayRead` is the gate: nothing reads an app's books before it says yes. */
export interface ChatReads {
  readonly readers: ReadonlyMap<string, { readonly name: string; readonly reader: AppReader }>
  readonly aliases: ChatAliases
  readonly refs: ChatRefs
  /** Whether sensitive values go as aliases, read at each call, so a change of the setting holds from the next read. */
  anonymising(): boolean
  mayRead(app: string): Promise<boolean>
}

/** What a read sent, in terms the row that shows it can word in either language. */
export type ReadSent =
  { readonly kind: 'records'; readonly app: string; readonly noun: RecordNoun; readonly count: number } | { readonly kind: 'figures'; readonly app: string; readonly title: string }

export interface ChatToolAnswer {
  readonly text: string
  readonly isError: boolean
  /** Set on a read that returned something from a person's books. */
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

const ALIAS_KINDS: Partial<Record<ReadableField['class'], AliasKind>> = { person: 'Person', iban: 'IBAN', oib: 'OIB', address: 'Address' }

type ValueOfRow = Extract<ReadableField, { readonly value: unknown }>

/** A text field as it reads with aliases in it, as its class says. */
function anonymisedField(field: ValueOfRow, value: string, aliases: ChatAliases): string {
  if (field.class === 'plain' || value === '') return value
  const aliasKind = ALIAS_KINDS[field.class]
  if (aliasKind !== undefined) return aliases.aliasOf(aliasKind, value)
  return field.class === 'counterparty' ? anonymisedCounterparty(value, aliases) : anonymisedText(value, aliases)
}

/** A field's value as it leaves: with aliases while anonymising, or as stored otherwise. The model loop masks IBANs and OIBs either way. */
function leaving(field: ValueOfRow, reads: ChatReads): unknown {
  return typeof field.value === 'string' && reads.anonymising() ? anonymisedField(field, field.value, reads.aliases) : field.value
}

/** One record as the model reads it: a ref for itself and each it points at, amounts as Kuna's own, blanks and false flags left out. */
function shownRow(app: string, kind: ReadableKind, row: ReadableRow, reads: ChatReads): Readonly<Record<string, unknown>> {
  const shown: Record<string, unknown> = { ref: reads.refs.recordRef({ app, kind: kind.name, id: row.id }) }
  for (const field of row.fields) {
    if (field.name === 'id') continue
    if (field.class === 'ref') {
      if (field.id !== null && field.id !== '') shown[field.name] = reads.refs.recordRef({ app, kind: field.to, id: field.id })
    } else if (field.class === 'money') {
      reads.refs.noteAmount(field.cents)
      shown[field.name] = `${plainAmount(field.cents)} ${field.currency}`
    } else {
      const value = leaving(field, reads)
      if (value !== '' && value !== null && value !== false) shown[field.name] = value
    }
  }
  return shown
}

/** Whether the words are in a field a person could search for. An identifier is left out, so the search cannot be used to guess one digit by digit. */
function holdsWords(row: ReadableRow, words: string): boolean {
  return row.fields.some((field) => 'value' in field && field.class !== 'iban' && field.class !== 'oib' && typeof field.value === 'string' && fold(field.value).includes(words))
}

/** Whether a field of the record reads with this alias, so every spelling of one person is found. */
function holdsAlias(row: ReadableRow, alias: string, aliases: ChatAliases): boolean {
  const exactly = new RegExp(`(?<![\\p{L}\\p{N}])${alias}(?![\\p{L}\\p{N}])`, 'u')
  return row.fields.some((field) => 'value' in field && typeof field.value === 'string' && exactly.test(anonymisedField(field, field.value, aliases)))
}

function dateOf(row: ReadableRow, kind: ReadableKind): string {
  const field = row.fields.find((candidate) => candidate.name === kind.dated)
  return field !== undefined && 'value' in field && typeof field.value === 'string' ? field.value : ''
}

function pointsAt(row: ReadableRow, id: string): boolean {
  return row.id === id || row.fields.some((field) => field.class === 'ref' && field.id === id)
}

/** Searches an app's records, newest first, by words or an alias, by a span of days, and by a record they point at. */
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

  const alias = input.query === null || reads.aliases.valueOf(input.query) === null ? null : input.query.trim()
  const words = input.query === null ? '' : fold(input.query)
  const matching = kind
    .rows()
    .filter((row) => (alias !== null ? holdsAlias(row, alias, reads.aliases) : words === '' || holdsWords(row, words)))
    .filter((row) => about === null || pointsAt(row, about.id))
    .filter((row) => {
      const date = dateOf(row, kind)
      return (input.from === null || date >= input.from) && (input.to === null || date.slice(0, input.to.length) <= input.to)
    })
  const newestFirst = kind.dated === null ? matching : [...matching].sort((left, right) => dateOf(right, kind).localeCompare(dateOf(left, kind)))
  const limit = Math.min(input.limit ?? DEFAULT_LIMIT, MOST_LIMIT)
  const page = newestFirst.slice(start, start + limit)
  const next = start + limit < newestFirst.length ? String(start + limit) : null
  const text = JSON.stringify({ source: `${input.app}/${kind.name}`, untrusted: true, total: newestFirst.length, records: page.map((row) => shownRow(input.app, kind, row, reads)), nextCursor: next })
  return { text, isError: false, read: { kind: 'records', app: app.name, noun: kind.noun, count: page.length } }
}

/** One record, by a ref Kuna handed out in this chat. */
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
        ref: reads.refs.figureRef(`${appId}/${report.id}/${period ?? ''}/${figure.label}`, figure.cents, figure.currency),
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
