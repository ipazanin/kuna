import type { AppReader, AssistantReport, ReadableField, ReadableKind, ReadableRow } from '../../app/assistantReader'
import { accountMoneyFromCents } from '../../money/accountMoney'
import { currencyCodeOf } from '../../money/currencyCode'
import { moneyFromCents, plainAmount } from '../../money/money'
import { percentFromBasisPoints, percentText } from '../../money/percent'
import { nameIn } from '../../privacy/domain/names'
import type { KnownPerson, Pseudonyms } from '../../privacy/domain/pseudonyms'
import type { RecordNoun } from '../../storage/domain/recordKind'
import { fold, normaliseIban } from '../../text/fold'
import type { StoredValue } from '../../privacy/domain/exposure'
import type { PageRange } from '../domain/chatAttachments'
import type { FigureTrace } from '../domain/chatElement'
import type { ChatRefs, FigureAmount } from '../domain/chatRefs'
import type { WholePart } from './modelPort'

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
  /** A photo, with null pages, or pages of a PDF that went whole. `name` is the file's own name, which shows on the row and never leaves. */
  | { readonly kind: 'document'; readonly name: string; readonly pages: PageRange | null }

export interface ChatToolAnswer {
  readonly text: string
  readonly isError: boolean
  /** Set on an answer that holds something from a person's books, which the row under the answer shows as sent. */
  readonly read?: ReadSent
  /** A photo or PDF that goes whole after the text. */
  readonly parts?: readonly WholePart[]
}

export interface FindRecordsInput {
  readonly app: string
  readonly kind: string
  readonly query: string | null
  readonly from: string | null
  readonly to: string | null
  readonly about: string | null
  /** A set the kind names, such as `waiting`, or null for every record. */
  readonly only: string | null
  readonly limit: number | null
  readonly cursor: string | null
}

const PERIOD = /^\d{4}-\d{2}(?:-\d{2})?$/
const NO_APP = 'That app has nothing to read in this chat. Take the app from the instructions.'
const NOT_ALLOWED = 'The person did not allow reading this app. Carry on with what you have and say what you could not read.'
const ABOUT_AN_EMPLOYEE = 'That record is about an employee or their pay, so it stays on this device while Anonymise is on. Say so.'

/** Why a build-up or a report of employees' pay was not read, with what the person can do about it. */
export function aboutEmployeesPay(what: 'build-up' | 'report'): string {
  return `That ${what} is about employees' pay, so it stays on this device while Anonymise is on, and nothing was sent. Ask the person to turn Anonymise off for this AI company in Kuna settings if they want it explained.`
}

/** A tool's answer that refuses, in a sentence the model can act on. */
export function refusal(text: string): ChatToolAnswer {
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

/** The texts a value holds: one for a text, each of a list, and none for a number or a flag. */
function textsOf(value: StoredValue): readonly string[] {
  if (typeof value === 'string') return [value]
  return Array.isArray(value) ? value : []
}

/** Whether a record a person tagged stays on this device, with no ref: it is about an employee while Anonymise is on, or Kuna cannot find it to tell. */
export function recordKeptHome(app: string, kindName: string, id: string, reads: ChatReads): boolean {
  if (!reads.anonymising()) return false
  const row = reads.readers
    .get(app)
    ?.reader.kinds.find((kind) => kind.name === kindName)
    ?.rows()
    .find((candidate) => candidate.id === id)
  return row === undefined || aboutAnEmployee(row, employeesKeptHome(knownPersons(reads), reads))
}

/** Whether a record names an employee in any of its text, or goes to an IBAN an employee is paid into. */
function aboutAnEmployee(row: ReadableRow, employees: readonly KnownPerson[]): boolean {
  return row.fields.some(
    (field) =>
      hasValue(field) &&
      textsOf(field.value).some((text) => {
        if (text === '') return false
        if (field.exposure === 'identifier') return employees.some((employee) => employee.ibans.includes(normaliseIban(text)))
        return employees.some((employee) => nameIn(text, employee.name))
      }),
  )
}

/** A text as it leaves while Anonymise is on: an identifier under its token, and known people under their alias in what a person wrote. */
function pseudonymisedText(field: ValueOfRow, text: string, pseudonyms: Pseudonyms): string {
  if (text === '' || field.exposure === 'plain') return text
  return field.exposure === 'identifier' ? pseudonyms.identifierToken(text) : pseudonyms.pseudonymised(text)
}

/** A field's value as it leaves: pseudonymised while Anonymise is on, each text of a list on its own, or as stored otherwise. The model loop masks IBANs and OIBs either way. */
function leaving(field: ValueOfRow, reads: ChatReads): StoredValue {
  const { value } = field
  if (!reads.anonymising()) return value
  if (typeof value === 'string') return pseudonymisedText(field, value, reads.pseudonyms)
  return Array.isArray(value) ? value.map((text) => pseudonymisedText(field, text, reads.pseudonyms)) : value
}

/** A record's amount as a figure the answer can cite, in an account's currency or the app's, or null for a currency Kuna does not know. */
function amountOf(field: Extract<ReadableField, { readonly cents: number }>): FigureAmount | null {
  const currency = currencyCodeOf(field.currency)
  if (currency === null) return null
  return field.of === 'account' ? { of: 'account', cents: accountMoneyFromCents(field.cents), currency } : { of: 'app', cents: moneyFromCents(field.cents), currency }
}

/**
 * One record as the model reads it: a ref for itself and each it points at, each amount with a figure ref the answer can
 * cite, blanks and false flags left out. Figures in a plain field, such as a rate Kuna writes as text, are noted too.
 */
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
      if (field.exposure === 'plain') textsOf(value).forEach((text) => reads.refs.noteFiguresIn(text))
      if (value !== '' && value !== null && value !== false && !(Array.isArray(value) && value.length === 0)) shown[field.name] = value
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
    if (!hasValue(field) || field.exposure === 'identifier') return false
    return textsOf(leaving(field, reads)).some((text) => (exactly !== null ? exactly.test(text) : fold(text).includes(words)))
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

/** Searches an app's records, newest first, by words or an alias, by a span of days, by a record they point at, and by a set the kind names. Records about employees stay out while Anonymise is on, and the answer counts them. */
export async function findRecords(input: FindRecordsInput, reads: ChatReads): Promise<ChatToolAnswer> {
  const app = reads.readers.get(input.app)
  if (app === undefined) return refusal(NO_APP)
  const kind = app.reader.kinds.find((candidate) => candidate.name === input.kind)
  if (kind === undefined) return refusal(`That kind cannot be read. It can be one of: ${app.reader.kinds.map((known) => known.name).join(', ')}.`)
  if ((input.from !== null && !PERIOD.test(input.from)) || (input.to !== null && !PERIOD.test(input.to))) return refusal('A date reads as 2026-10-31 or 2026-10.')
  if ((input.from !== null || input.to !== null) && kind.dated === null) return refusal('This kind has no date to filter by.')
  const about = input.about === null ? null : reads.refs.recordOf(input.about)
  if (input.about !== null && (about === null || about.app !== input.app)) return refusal('That ref is not one Kuna handed out in this app.')
  const only = input.only === null ? null : (kind.sets ?? []).find((set) => set.name === input.only)
  if (only === undefined)
    return refusal(kind.sets === undefined ? 'This kind has no sets, so only is null.' : `That set is not one of this kind. It can be one of: ${kind.sets.map((set) => set.name).join(', ')}.`)
  const start = input.cursor === null ? 0 : Number(input.cursor)
  if (!Number.isInteger(start) || start < 0) return refusal('Take the cursor from the last page.')
  if (input.limit !== null && (!Number.isInteger(input.limit) || input.limit < 1)) return refusal('A limit is a whole number above zero.')

  if (!(await reads.mayRead(input.app))) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotOpen(status)

  const employees = employeesKeptHome(knownPersons(reads), reads)
  const query = input.query === null || input.query.trim() === '' ? null : input.query
  const inSet = only === null ? null : only.ids()
  const inRange = kind
    .rows()
    .filter((row) => inSet === null || inSet.has(row.id))
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

/** The figures of a report as they leave, each label through `labelLeaving`, and how many were left out for naming an employee kept home. */
function shownFigures(appId: string, report: AssistantReport, period: string | null, reads: ChatReads): { readonly figures: readonly Readonly<Record<string, unknown>>[]; readonly leftOut: number } {
  const figures = report.figures(period)
  const leaving = figures.flatMap((figure) => {
    const label = labelLeaving(figure.label, reads)
    return label === null ? [] : [{ figure, label }]
  })
  const shown = leaving.map(({ figure, label }): Readonly<Record<string, unknown>> => {
    reads.refs.noteFiguresIn(figure.label)
    if ('cents' in figure) {
      return { ref: reads.refs.figureRef(`${appId}/${report.id}/${period ?? ''}/${figure.label}`, figure), label, amount: `${plainAmount(figure.cents)} ${figure.currency}` }
    }
    if ('basisPoints' in figure) {
      const points = Math.abs(figure.basisPoints)
      reads.refs.noteRate(points)
      return { label, rate: `${figure.basisPoints < 0 ? '-' : ''}${percentText(percentFromBasisPoints(points))}` }
    }
    return { label, count: figure.count }
  })
  return { figures: shown, leftOut: figures.length - shown.length }
}

/** Figures Kuna computed with its own functions, each amount with a ref the answer can quote. A figure whose label names an employee stays out while Anonymise is on, and the answer counts them. */
export async function readFigures(appId: string, reportId: string, period: string | null, reads: ChatReads): Promise<ChatToolAnswer> {
  const app = reads.readers.get(appId)
  if (app === undefined) return refusal(NO_APP)
  const report = app.reader.reports.find((candidate) => candidate.id === reportId)
  if (report === undefined) return refusal(`There is no such report. It can be one of: ${app.reader.reports.map((known) => known.id).join(', ')}.`)
  if (period !== null && !PERIOD.test(period)) return refusal(report.period === 'month' ? 'A month reads as 2026-10.' : 'A day reads as 2026-10-31.')
  if (report.employees === true && reads.anonymising() && reads.persons().some((person) => person.employee)) return refusal(aboutEmployeesPay('report'))
  if (!(await reads.mayRead(appId))) return refusal(NOT_ALLOWED)
  const status = app.reader.status()
  if (status !== 'open') return fileNotOpen(status)
  try {
    const { figures, leftOut } = shownFigures(appId, report, period, reads)
    const text = JSON.stringify({ source: `${appId}/${report.id}`, computedBy: 'Kuna', period, ...(leftOut > 0 ? { leftOutAboutEmployees: leftOut } : {}), figures })
    return { text, isError: false, read: { kind: 'figures', app: app.name, title: report.title } }
  } catch (failure) {
    if (failure instanceof RangeError) return refusal(report.period === 'month' ? 'A month reads as 2026-10.' : 'A day reads as 2026-10-31.')
    throw failure
  }
}

/** A label Kuna shows, such as a tagged figure's, as it leaves: null when it names an employee kept home, and otherwise with known people under their alias while Anonymise is on. */
export function labelLeaving(label: string, reads: ChatReads): string | null {
  return namesAnEmployeeKeptHome([label], reads) ? null : sentText(label, reads)
}

/** Whether any of the texts names an employee, which keeps it home while Anonymise is on. */
function namesAnEmployeeKeptHome(texts: readonly string[], reads: ChatReads): boolean {
  const employees = employeesKeptHome(knownPersons(reads), reads)
  return texts.some((text) => employees.some((employee) => nameIn(text, employee.name)))
}

/** Text Kuna builds from the books, such as a step of a build-up or a figure's label, as it leaves: known people under their alias while Anonymise is on. */
export function sentText(text: string, reads: ChatReads): string {
  if (!reads.anonymising()) return text
  knownPersons(reads)
  return reads.pseudonyms.pseudonymised(text)
}

/** A step of a build-up as the model reads it, and the steps below it. Each amount and each figure its label writes is noted, so an answer may quote it. */
function shownStep(step: FigureTrace, reads: ChatReads): Readonly<Record<string, unknown>> {
  reads.refs.noteAmount(step.amount)
  reads.refs.noteFiguresIn(step.label)
  return {
    label: sentText(step.label, reads),
    ...(step.on === null ? {} : { on: step.on }),
    amount: plainAmount(step.amount),
    basis: sentText(step.basis, reads),
    rules: ruleIdsOf(step),
    steps: step.steps.map((below) => shownStep(below, reads)),
    ...(step.stepsLeftOut === 0 ? {} : { stepsLeftOut: step.stepsLeftOut }),
  }
}

function ruleIdsOf(step: FigureTrace): readonly string[] {
  return [...new Set(step.rules.map((rule) => rule.id))]
}

function textsOfStep(step: FigureTrace): readonly string[] {
  return [step.label, step.basis, ...step.steps.flatMap(textsOfStep)]
}

function allRuleIds(step: FigureTrace): readonly string[] {
  return [...new Set([...ruleIdsOf(step), ...step.steps.flatMap(allRuleIds)])]
}

/** How Kuna built a figure a person tagged, with the terms of the rule versions it rests on. A build-up of an employee's pay, or one whose text names an employee, stays home while Anonymise is on. */
export async function readBuildUp(ref: string, reads: ChatReads): Promise<ChatToolAnswer> {
  const buildUp = reads.refs.buildUpOf(ref)
  if (buildUp === null) return refusal('That ref is not a build-up Kuna handed out in this chat.')
  const app = reads.readers.get(buildUp.app)
  if (app === undefined) return refusal(NO_APP)
  if ((buildUp.employees && reads.anonymising()) || namesAnEmployeeKeptHome([buildUp.subtitle, ...textsOfStep(buildUp.trace)], reads)) return refusal(aboutEmployeesPay('build-up'))
  if (!(await reads.mayRead(buildUp.app))) return refusal(NOT_ALLOWED)
  const rules = app.reader.traceRules
  const versions = rules?.versionsOf(buildUp.trace) ?? []
  reads.refs.noteFiguresIn(buildUp.subtitle)
  reads.refs.noteFiguresIn(JSON.stringify(versions))
  const ruleKind = rules?.ruleKind
  const text = JSON.stringify({
    source: `${buildUp.app}/build-up`,
    computedBy: 'Kuna',
    labelsUntrusted: true,
    of: sentText(buildUp.subtitle, reads),
    figure: shownStep(buildUp.trace, reads),
    rules: versions,
    ...(ruleKind === undefined ? {} : { ruleRefs: Object.fromEntries(allRuleIds(buildUp.trace).map((id) => [id, reads.refs.recordRef({ app: buildUp.app, kind: ruleKind, id })])) }),
    ...(rules === undefined ? {} : { rulesCheckedSince: rules.checkedSince }),
  })
  return { text, isError: false, read: { kind: 'figures', app: app.name, title: buildUp.trace.label } }
}
