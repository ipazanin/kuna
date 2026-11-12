import type { PackOperations } from '../../../../assistant/companyAssistant'
import { LEDGER_RECORDS } from '../../../../workbook/domain/coreKinds'
import { recordsOfKindIn } from '../../../../workbook/domain/readWorkbook'
import type { CompanyBooks } from '../../../../workbook/domain/readWorkbook'
import { slugProblem } from '../../../../workbook/domain/slug'
import { draftsOfRecords, fieldsOfDrafts } from '../../../../settings/domain/recordDrafts'
import type { DraftColumn, DraftFactory } from '../../../../settings/domain/recordDrafts'
import type { EditorColumn } from '../../../../settings/presentation/factTabColumns'
import { typedOwnerShare } from '../../../../owner-share/domain/ownerShare'
import type { OwnerShare } from '../../../../owner-share/domain/ownerShare'
import { ownerAdvanceOfDraft } from '../../application/ownerAdvanceWrites'
import { categoryPlanLine, dividendPlanLine, ownerPayPlanLine, purchasePlanLine, replacePlanLines } from '../../application/planWrites'
import type { KeyedLine, PlanLineDraft } from '../../application/planWrites'
import { copyScenario, renameScenario, scenarioRowsOf } from '../../application/scenarioWrites'
import { ASSET_GROUPS } from '../../domain/assets/assets'
import type { Asset, AssetGroup } from '../../domain/assets/assets'
import { paymentRowsOf } from '../../domain/assets/assetRegister'
import { assetOfFields } from '../../domain/assets/assetsReading'
import type { Employee } from '../../domain/employees/employees'
import { employeeOfFields } from '../../domain/employees/employeesReading'
import type { PlanLine } from '../../domain/forecast/plan'
import type { Grant } from '../../domain/grants/grants'
import { grantOfFields } from '../../domain/grants/grantsReading'
import { ASSET_RECORDS, EMPLOYEE_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from '../../domain/hrDooKinds'
import { hrDooWorkbook } from '../../domain/hrDooPart'
import { ASSET_WRITES, EMPLOYEE_WRITES, GRANT_WRITES, OWNER_ADVANCE_WRITES, PLAN_WRITES, SCENARIO_WRITES, YEAR_END_WRITES } from '../../domain/hrDooWrites'
import { DIRECTOR_BASES, SCENARIO_COMPONENTS } from '../../domain/scenarios/ownerPayScenarios'
import type { DirectorBasis } from '../../domain/scenarios/ownerPayScenarios'
import { scenarioRowOfComponent } from '../../domain/scenarios/scenariosReading'
import type { ScenarioRow } from '../../domain/scenarios/scenariosReading'
import { scenarioName, startingScenarios } from '../../domain/scenarios/startingScenarios'
import type { ComponentDraft } from '../../domain/scenarios/startingScenarios'
import type { YearEndLine } from '../../domain/yearEnd/yearEnd'
import { yearEndLineOfFields } from '../../domain/yearEnd/yearEndReading'
import { EMPLOYEE_COLUMNS, GRANT_COLUMNS, YEAR_END_COLUMNS, assetColumns } from '../../presentation/editorColumns'
import { words as scenarioWords } from '../../presentation/payScenarios/words'
import { packDescriber } from './proposalLines'
import { TRIP_OPERATIONS, plannedTripStep } from './tripOperations'
import type { AssistantOperation, ProposalStep } from '../../../../../../shared/app/assistantOperations'
import { NUMBER, NUMBER_OR_NULL, TEXT, TEXT_OR_NULL, dayOf, inputOf } from '../../../../../../shared/app/operationInput'
import { StepRefused } from '../../../../../../shared/app/proposedWrites'
import type { StrictSchema } from '../../../../../../shared/ai/domain/strictSchema'
import { civilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { moneyFromAmount } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import type { UnitOfWork } from '../../../../../../shared/storage/application/repository'
import { recordsOf } from '../../../../../../shared/storage/domain/recordsRead'
import type { ReadRecord, RecordsRead, StoredRecord } from '../../../../../../shared/storage/domain/recordsRead'
import { refusalOr } from '../../../../../../shared/storage/domain/storedFields'
import type { WriteRules } from '../../../../../../shared/storage/domain/writeRules'

const YEAR: StrictSchema = { type: 'integer' }
const MONTH: StrictSchema = { type: 'integer', description: 'A month from 1 to 12.' }
const MONTH_OR_NULL: StrictSchema = { type: ['number', 'null'], description: 'A month from 1 to 12, or null.' }
const DAY: StrictSchema = { type: 'string', description: 'A day such as 2026-10-31.' }

/** What a kind's add and change take beside the editor's columns, and how a step's value of it lands on the record. */
interface EditorInput<R> {
  readonly fields: Readonly<Record<string, StrictSchema>>
  readonly refs: Readonly<Record<string, string>>
  apply(record: R, field: Readonly<Record<string, never>>, books: CompanyBooks, idOf: (value: unknown) => string): R
}

/** A kind a person keeps in an editor on its screen, which the chat changes one row at a time through the editor's own columns and factory. */
interface EditorKind<R> {
  readonly rules: WriteRules<R>
  readonly columns: readonly EditorColumn[]
  readonly make: DraftFactory<R>
  /** The record a ref names, as the app read it, by the id the chat reads the kind by. */
  held(read: RecordsRead<R>, id: string): ReadRecord<R> | undefined
  readonly input?: EditorInput<R>
}

/** The asset linked to the payment a ledger row's ref names, or left as it is by null. Only a payment out with a row id can be linked. */
function withPayment(asset: Asset, field: Readonly<Record<string, never>>, books: CompanyBooks, idOf: (value: unknown) => string): Asset {
  const value = field['payment'] as string | null
  if (value === null) return asset
  const id = idOf(value)
  const row = books.workbook.transactions.find((candidate) => candidate.id === id)
  if (row === undefined) throw new StepRefused('That ledger row is no longer in the books.')
  if (row.rowId === null) throw new StepRefused('That ledger row has no id yet. Give the ledger rows their ids on Settings, Books file, first.')
  if (paymentRowsOf(row.rowId, books.workbook.transactions).length === 0) throw new StepRefused('An asset is paid by money going out, and that row brings money in.')
  return { ...asset, rowId: row.rowId }
}

const ASSET_PAYMENT: EditorInput<Asset> = {
  fields: { payment: { type: ['string', 'null'], description: 'The ledger row that paid for it, which links the asset to that row, or null to leave its link as it is.' } },
  refs: { payment: LEDGER_RECORDS.name },
  apply: withPayment,
}

const byRecordId = <R>(read: RecordsRead<R>, id: string): ReadRecord<R> | undefined => read.records.find((stored) => stored.id === id)
const bySlug = <R extends { readonly slug: string }>(read: RecordsRead<R>, slug: string): ReadRecord<R> | undefined => read.records.find((stored) => stored.record.slug === slug)

const YEAR_END_KIND: EditorKind<YearEndLine> = { rules: YEAR_END_WRITES, columns: YEAR_END_COLUMNS, make: yearEndLineOfFields, held: byRecordId }
const ASSET_KIND: EditorKind<Asset> = { rules: ASSET_WRITES, columns: assetColumns([]), make: assetOfFields, held: byRecordId, input: ASSET_PAYMENT }
const GRANT_KIND: EditorKind<Grant> = { rules: GRANT_WRITES, columns: GRANT_COLUMNS, make: grantOfFields, held: bySlug }
const EMPLOYEE_KIND: EditorKind<Employee> = { rules: EMPLOYEE_WRITES, columns: EMPLOYEE_COLUMNS, make: employeeOfFields, held: bySlug }

/** The kinds the chat changes as their editors do, by the name their operations take. */
const EDITOR_KINDS = { 'year-end-line': YEAR_END_KIND, asset: ASSET_KIND, grant: GRANT_KIND, employee: EMPLOYEE_KIND } as const

type EditorName = keyof typeof EDITOR_KINDS

const COLUMN_HINTS: Readonly<Record<DraftColumn['kind'], string>> = {
  text: 'Text.',
  word: 'A word in lower case.',
  date: 'A day such as 2026-10-31.',
  amount: 'An amount such as 1200.50.',
  'whole-number': 'A whole number.',
  percent: 'A percent such as 25.',
  flag: 'TRUE, or "" for no.',
  'amount-or-word': 'An amount such as 1200.50, or whole.',
  'iban-list': 'IBANs separated by commas.',
}

/**
 * The editor's columns as fields of an operation, each text as the editor takes it. Null leaves a field as it is, and "" blanks
 * it. A column whose menu offers a fixed list takes only one of those values.
 */
function columnFields(columns: readonly EditorColumn[]): Readonly<Record<string, StrictSchema>> {
  return Object.fromEntries(
    columns.map((column): [string, StrictSchema] => {
      const choices = column.choices?.map((choice) => choice.value) ?? []
      return [
        column.name,
        choices.length === 0
          ? { type: ['string', 'null'], description: COLUMN_HINTS[column.kind] }
          : { type: ['string', 'null'], enum: [...choices, '', null], description: 'One of these, "" to blank it, or null to leave it.' },
      ]
    }),
  )
}

/** An unreadable row of an editor, by its place among the rows Kuna cannot read, as the editor lists them from the top. */
const UNREADABLE_ROW: StrictSchema = { type: 'integer', description: 'The place of the row among the rows the editor says Kuna cannot read, 1 for the first from the top.' }

/**
 * The add, change and delete of an editor kind, and the fix and removal of a row Kuna cannot read. A row is named by `row`,
 * since each editor has a column named after its kind. Like the editor's own save, a fix or a removal of an unreadable row has no Undo.
 */
function editorOperations(
  name: EditorName,
  about: { readonly add: string; readonly change: string; readonly delete: string },
  refKind: string,
  examples: { readonly add: Readonly<Record<string, string>>; readonly change: Readonly<Record<string, string>>; readonly deleted?: string },
): AssistantOperation[] {
  const kind: EditorKind<unknown> = EDITOR_KINDS[name]
  const fields = columnFields(kind.columns)
  const extra = kind.input?.fields ?? {}
  const left = Object.fromEntries(Object.keys(fields).map((field) => [field, null]))
  const extraLeft = Object.fromEntries(Object.keys(extra).map((field) => [field, null]))
  const noun = kind.rules.kind.noun.en.one
  return [
    {
      name: `add-${name}`,
      about: about.add,
      input: inputOf({ ...fields, ...extra }),
      refs: kind.input?.refs ?? {},
      creates: null,
      alone: false,
      example: { ...left, ...extraLeft, ...examples.add },
    },
    {
      name: `change-${name}`,
      about: about.change,
      input: inputOf({ row: TEXT, ...fields, ...extra }),
      refs: { row: refKind, ...kind.input?.refs },
      creates: null,
      alone: false,
      example: { row: name, ...left, ...extraLeft, ...examples.change },
    },
    { name: `delete-${name}`, about: about.delete, input: inputOf({ row: TEXT }), refs: { row: refKind }, creates: null, alone: false, example: { row: examples.deleted ?? name } },
    {
      name: `fix-unreadable-${name}`,
      about: `Fixes an unreadable ${noun} row with the columns the person gives. Null keeps what the row holds. It has no Undo, as the editor's save of such a row has none, so it goes alone on a card.`,
      input: inputOf({ row: UNREADABLE_ROW, ...fields }),
      refs: {},
      creates: null,
      alone: true,
      example: { row: 1, ...left, ...examples.change },
    },
    {
      name: `remove-unreadable-${name}`,
      about: `Removes an unreadable ${noun} row. It has no Undo, as the editor's save without such a row has none, so it goes alone on a card.`,
      input: inputOf({ row: UNREADABLE_ROW }),
      refs: {},
      creates: null,
      alone: true,
      example: { row: 1 },
    },
  ]
}

const COMPONENT_FIELDS = {
  kind: { type: 'string', enum: [...SCENARIO_COMPONENTS] },
  amount: { type: ['number', 'null'], description: 'The monthly gross, item, rent or dividend. Null for the floor salary or the largest dividend.' },
  item: { type: ['string', 'null'], description: 'The tax-free item of a nontaxable part, such as meal-allowance-flat, else null.' },
  basis: { type: ['string', 'null'], description: `The director's basis, ${DIRECTOR_BASES.join(', ')}, else null.` },
  from: { type: ['string', 'null'], description: 'The first day it holds, in the scenario year, or null for 1 January.' },
  to: { type: ['string', 'null'], description: 'The last day it holds, or null for 31 December. A dividend and a tax-free item take none.' },
} as const satisfies Readonly<Record<string, StrictSchema>>

/** Every change the chat can propose in the Croatian d.o.o. pack. Each calls the write functions the pack's screens use. */
export const PACK_OPERATIONS: readonly AssistantOperation[] = [
  {
    name: 'add-owner-advance',
    about: 'A cost the owner paid privately for the company, which the company owes back, in an operating or taxes category, above zero.',
    input: inputOf({ date: DAY, amount: NUMBER, description: TEXT, category: TEXT }),
    refs: { category: 'category' },
    creates: null,
    alone: false,
    example: { date: '2026-10-10', amount: 117.3, description: 'Desk lamp', category: 'category' },
  },
  {
    name: 'change-owner-advance',
    about:
      "Fixes an owner advance's day, amount, description, category or owner share. One moved to another category takes that category's owner share unless ownerShare gives one. The owner share is the owner's private part in percent, a whole number from 0 to 100 or \"\" for none, only while owner pay is on and on an operating cost. Null leaves a field as it is.",
    input: inputOf({ advance: TEXT, date: TEXT_OR_NULL, amount: NUMBER_OR_NULL, description: TEXT_OR_NULL, category: TEXT_OR_NULL, ownerShare: TEXT_OR_NULL }),
    refs: { advance: OWNER_ADVANCE_RECORDS.name, category: 'category' },
    creates: null,
    alone: false,
    example: { advance: 'advance', date: null, amount: 45, description: null, category: null, ownerShare: null },
  },
  {
    name: 'delete-owner-advance',
    about: 'Deletes an owner advance.',
    input: inputOf({ advance: TEXT }),
    refs: { advance: OWNER_ADVANCE_RECORDS.name },
    creates: null,
    alone: false,
    example: { advance: 'advance' },
  },
  {
    name: 'plan-category',
    about: "A category's planned amount for a year, read positive for income and costs alike: every month with a null month, or one month 1 to 12, which wins over every month. It replaces that row.",
    input: inputOf({ category: TEXT, year: YEAR, month: MONTH_OR_NULL, amount: NUMBER }),
    refs: { category: 'category' },
    creates: null,
    alone: false,
    example: { category: 'category', year: 2026, month: 12, amount: 300 },
  },
  {
    name: 'plan-dividend',
    about: "The year's planned dividend before tax, above zero, and the month 1 to 12 it is paid. It replaces the year's dividend row. Null keeps the note.",
    input: inputOf({ year: YEAR, month: MONTH, amount: NUMBER, note: TEXT_OR_NULL }),
    refs: {},
    creates: null,
    alone: false,
    example: { year: 2026, month: 12, amount: 5000, note: null },
  },
  {
    name: 'plan-purchase',
    about: `A planned purchase, or a change to the one purchase names: what it is, the day it is bought and put in use in the year, its cost without the VAT reclaimed, and its depreciation group, ${ASSET_GROUPS.join(', ')}.`,
    input: inputOf({ purchase: TEXT_OR_NULL, year: YEAR, date: DAY, amount: NUMBER, group: { type: 'string', enum: [...ASSET_GROUPS] }, name: TEXT }),
    refs: { purchase: PLAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { purchase: null, year: 2026, date: '2026-12-01', amount: 1500, group: 'computers', name: 'Laptop' },
  },
  {
    name: 'plan-owner-pay',
    about: "The year's owner pay: a pay scenario of that year by its short name from 1 January, and optionally another one from a later day of the year. It replaces both owner pay rows of the year.",
    input: inputOf({ year: YEAR, scenario: TEXT, switchTo: TEXT_OR_NULL, switchOn: TEXT_OR_NULL }),
    refs: {},
    creates: null,
    alone: false,
    example: { year: 2027, scenario: 'scenario', switchTo: null, switchOn: null },
  },
  {
    name: 'clear-plan',
    about: "Deletes a plan row. An owner pay row takes the year's other owner pay row with it, as the plan's Clear does.",
    input: inputOf({ line: TEXT }),
    refs: { line: PLAN_RECORDS.name },
    creates: null,
    alone: false,
    example: { line: 'plan-line' },
  },
  {
    name: 'add-starting-scenarios',
    about:
      "Kuna's starting owner pay scenarios for a year, as the Pay tab adds them. The monthly rent the company pays the owner is above zero, or null for none. Refused when one of their short names is taken.",
    input: inputOf({ year: YEAR, rent: NUMBER_OR_NULL }),
    refs: {},
    creates: null,
    alone: false,
    example: { year: 2028, rent: null },
  },
  {
    name: 'add-component',
    about: 'A part of an owner pay scenario, named by its short name. The part holds in the scenario year.',
    input: inputOf({ scenario: TEXT, ...COMPONENT_FIELDS }),
    refs: {},
    creates: null,
    alone: false,
    example: { scenario: 'scenario', kind: 'rent_monthly', amount: 400, item: null, basis: null, from: null, to: null },
  },
  {
    name: 'change-component',
    about: 'A part of an owner pay scenario written again whole, as its dialog saves it.',
    input: inputOf({ component: TEXT, ...COMPONENT_FIELDS }),
    refs: { component: SCENARIO_RECORDS.name },
    creates: null,
    alone: false,
    example: { component: 'component', kind: 'dividend', amount: 5000, item: null, basis: null, from: null, to: null },
  },
  {
    name: 'delete-component',
    about: 'Deletes a part of an owner pay scenario.',
    input: inputOf({ component: TEXT }),
    refs: { component: SCENARIO_RECORDS.name },
    creates: null,
    alone: false,
    example: { component: 'component' },
  },
  {
    name: 'rename-scenario',
    about: 'Gives an owner pay scenario a new short name and name, every part of it at once. A short name the plan picks cannot change. Null keeps the name.',
    input: inputOf({ scenario: TEXT, slug: TEXT, label: TEXT_OR_NULL }),
    refs: {},
    creates: null,
    alone: false,
    example: { scenario: 'scenario-unplanned', slug: 'renamed', label: 'Renamed' },
  },
  {
    name: 'copy-scenario',
    about: 'Copies an owner pay scenario, every part of it, under a new short name and name. Null names it as a copy.',
    input: inputOf({ scenario: TEXT, slug: TEXT, label: TEXT_OR_NULL }),
    refs: {},
    creates: null,
    alone: false,
    example: { scenario: 'scenario', slug: 'copied', label: null },
  },
  ...editorOperations(
    'year-end-line',
    {
      add: "A figure from the accountant's year-end package, by the columns of the Accountant tab's editor.",
      change: "Fixes a year-end line's columns.",
      delete: 'Deletes a year-end line.',
    },
    YEAR_END_RECORDS.name,
    { add: { year: '2026', statement: 'pl', line: 'sales', amount: '50000' }, change: { note: 'Checked with the accountant' } },
  ),
  ...editorOperations('asset', { add: "A fixed asset, by the columns of the Assets tab's editor.", change: "Fixes an asset's columns.", delete: 'Deletes an asset.' }, ASSET_RECORDS.name, {
    add: { asset: 'Laptop', bought: '2026-03-02', cost_net: '1500', group: 'computers' },
    change: { disposed: '2026-10-31' },
  }),
  ...editorOperations(
    'grant',
    { add: "A grant the company received, by the columns of the Assets tab's grant editor.", change: "Fixes a grant's columns.", delete: 'Deletes a grant no asset is funded by.' },
    GRANT_RECORDS.name,
    { add: { grant: 'new-grant', received: '2026-02-01', amount: '2000', fixed_part: '2000', variable_part: '0' }, change: { note: 'Terms checked' }, deleted: 'grant-unused' },
  ),
  ...editorOperations(
    'employee',
    {
      add: "An employee, by the columns of the Salaries screen's editor. Only with Anonymise off. A null pension_pillar_2 is TRUE, as a new row is.",
      change: "Fixes an employee's columns, such as the accounts their pay goes to. Only with Anonymise off.",
      delete: 'Deletes an employee. Only with Anonymise off.',
    },
    EMPLOYEE_RECORDS.name,
    {
      add: { employee: 'ana', name: 'Ana Example', iban: 'HR1210010051863000160', residence_city: 'Zagreb', agreed_gross: '1500', from: '2026-11-01' },
      change: { iban: 'HR1210010051863000160' },
    },
  ),
  ...TRIP_OPERATIONS,
]

/** What only a person changes while Anonymise is on: the employees and the pay a scenario gives a person. Which scenario the owner's pay follows in the plan is the owner's own. */
const PAYS_A_PERSON: ReadonlySet<string> = new Set([
  'add-employee',
  'change-employee',
  'delete-employee',
  'fix-unreadable-employee',
  'remove-unreadable-employee',
  'add-starting-scenarios',
  'add-component',
  'change-component',
  'delete-component',
  'rename-scenario',
  'copy-scenario',
])

const ANONYMISING =
  'Employees and the pay a scenario plans stay on this device while Anonymise is on, so the chat cannot change them. Ask the person to turn Anonymise off for this AI company, or to make the change on the screen.'

function monthOf(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 12) throw new StepRefused('A month is a whole number from 1 to 12.')
  return value
}

function aboveZero(amount: number, what: string): Money {
  const money = moneyFromAmount(amount)
  if (money <= 0) throw new StepRefused(`${what} is above zero.`)
  return money
}

function dayInYear(text: string, year: number, what: string): CivilDate {
  const day = dayOf(text)
  if (yearOf(day) !== year) throw new StepRefused(`${what} is a day of ${year}.`)
  return day
}

function heldOf<R>(read: RecordsRead<R>, what: string, matches: (record: R) => boolean): R {
  const record = read.records.find((stored) => matches(stored.record))?.record
  if (record === undefined) throw new StepRefused(`That ${what} is no longer in the file, or the file cannot read it.`)
  return record
}

/** A scenario part as its dialog drafts it. A salary with no amount is the floor salary and a dividend with none the largest one. */
function componentOf(field: Readonly<Record<string, never>>): ComponentDraft {
  const amount = field['amount'] as number | null
  const span = { from: field['from'] === null ? null : dayOf(field['from']), to: field['to'] === null ? null : dayOf(field['to']) }
  const money = amount === null ? null : aboveZero(amount, 'amount')
  const needed = (): Money => {
    if (money === null) throw new StepRefused('That part needs an amount.')
    return money
  }
  switch (field['kind'] as ComponentDraft['component']) {
    case 'salary_gross':
      return { component: 'salary_gross', gross: money ?? 'floor', ...span }
    case 'nontaxable': {
      const item = (field['item'] as string | null)?.trim() ?? ''
      if (item === '') throw new StepRefused('A tax-free part names its item.')
      return { component: 'nontaxable', item, amount: needed(), from: span.from, to: null }
    }
    case 'rent_monthly':
      return { component: 'rent_monthly', amount: needed(), ...span }
    case 'dividend':
      return { component: 'dividend', amount: money ?? 'max', from: null, to: null }
    case 'director_basis': {
      const basis = DIRECTOR_BASES.find((candidate) => candidate === field['basis'])
      if (basis === undefined) throw new StepRefused(`basis is one of ${DIRECTOR_BASES.join(', ')}.`)
      return { component: 'director_basis', basis: basis satisfies DirectorBasis, ...span }
    }
  }
}

/** The rows of a scenario by its short name, as the app read them. */
function scenarioRows(books: CompanyBooks, slug: string): readonly ScenarioRow[] {
  const rows = recordsOf(recordsOfKindIn(books.records, SCENARIO_RECORDS)).filter((row) => row.slug === slug.trim())
  if (rows.length === 0) throw new StepRefused(`${slug} is not the short name of a pay scenario.`)
  return rows
}

function scenarioSlugs(books: CompanyBooks): ReadonlySet<string> {
  return new Set(recordsOf(recordsOfKindIn(books.records, SCENARIO_RECORDS)).map((row) => row.slug))
}

/** A scenario's new short name, as its name dialog checks it. */
function newScenarioSlug(books: CompanyBooks, from: string, text: string): string {
  const slug = text.trim()
  const problem = slugProblem(slug, 'scenario')
  if (problem !== null) throw new StepRefused(problem)
  if (slug !== from && scenarioSlugs(books).has(slug)) throw new StepRefused(`${slug} is already the short name of a scenario.`)
  return slug
}

/** A row as the editor makes it from its columns over what the row holds: the typed columns win, and a null one keeps the row's. */
function editorRowOf<R>(kind: EditorKind<R>, name: EditorName, held: StoredRecord<R> | undefined, field: Readonly<Record<string, never>>): R {
  const stored = held === undefined ? [] : [held]
  const [draft] = held === undefined ? [{ saved: null, fields: {} }] : draftsOfRecords(stored, kind.columns)
  const typed = Object.fromEntries(kind.columns.flatMap((column) => (field[column.name] === null ? [] : [[column.name, field[column.name] as string]])))
  const fields = { ...draft!.fields, ...(name === 'employee' && held === undefined && field['pension_pillar_2'] === null ? { pension_pillar_2: 'TRUE' } : {}), ...typed }
  const [rowFields] = fieldsOfDrafts([{ saved: draft!.saved, fields }], kind.columns, stored)
  const made = refusalOr(() => kind.make(rowFields!, held?.id ?? null))
  if ('refused' in made) throw new StepRefused(made.refused)
  return made.made
}

/**
 * One editor row added, changed or removed, through the editor's columns and factory, as its Save writes it, with what the kind
 * takes beside the columns.
 */
function writeEditorRow(unit: UnitOfWork, books: CompanyBooks, name: EditorName, verb: string, field: Readonly<Record<string, never>>, idOf: (value: unknown) => string): void {
  const kind = EDITOR_KINDS[name] as EditorKind<unknown>
  const read = recordsOfKindIn(books.records, kind.rules.kind)
  const held = verb === 'add' ? undefined : kind.held(read, field['row'])
  if (verb !== 'add' && held === undefined) throw new StepRefused(`That ${kind.rules.kind.noun.en.one} is no longer in the file, or the file cannot read it.`)
  const rowOf = (record: unknown): unknown => (kind.input === undefined ? record : kind.input.apply(record, field, books, idOf))
  if (verb === 'delete') unit.of(kind.rules).remove(held!.record)
  else if (held === undefined) unit.of(kind.rules).add(rowOf(editorRowOf(kind, name, undefined, field)))
  else unit.of(kind.rules).change(held.record, rowOf(editorRowOf(kind, name, held, field)))
}

/** A row Kuna cannot read, fixed through the editor's columns and factory or removed, as the editor's Save repairs or drops it. */
function writeUnreadableRow(unit: UnitOfWork, books: CompanyBooks, name: EditorName, verb: string, field: Readonly<Record<string, never>>): void {
  const kind = EDITOR_KINDS[name] as EditorKind<unknown>
  const unreadable = recordsOfKindIn(books.records, kind.rules.kind).refused
  const place = field['row'] as number
  const refused = unreadable[place - 1]
  if (!Number.isInteger(place) || refused === undefined) {
    throw new StepRefused(unreadable.length === 0 ? `Kuna reads every ${kind.rules.kind.noun.en.one} row.` : `row is a whole number from 1 to ${unreadable.length}.`)
  }
  if (verb === 'remove') unit.of(kind.rules).discard(refused)
  else unit.of(kind.rules).repair(refused, editorRowOf(kind, name, refused, field))
}

/** The owner share an advance takes, as Transactions sets it on the advance's line: only while owner pay is on, and on an operating cost. */
function advanceShare(books: CompanyBooks, category: string, text: string): OwnerShare | null {
  if (!books.workbook.settings.ownerPayModule) throw new StepRefused('Owner shares show only while owner pay is on, on Settings, General.')
  if (books.workbook.categories.find((candidate) => candidate.slug === category)?.bucket !== 'operating') throw new StepRefused('An owner share sits only on operating cost.')
  const share = typedOwnerShare(text)
  if (share === undefined) throw new StepRefused('A share is a whole number from 0 to 100.')
  return share
}

/** The plan lines of a year as the app read them, of one kind. */
function yearLines(books: CompanyBooks, year: number, matches: (line: PlanLine) => boolean): readonly PlanLine[] {
  return recordsOf(recordsOfKindIn(books.records, PLAN_RECORDS)).filter((line) => line.year === year && matches(line))
}

/** One planned line put in place of what its key held, as the plan dialogs save. */
function replaceLine(unit: UnitOfWork, held: readonly PlanLine[], key: string, line: PlanLineDraft): void {
  replacePlanLines(
    unit.of(PLAN_WRITES),
    held.map((each): KeyedLine<PlanLine> => ({ key, line: each })),
    [{ key, line }],
  )
}

function planned(unit: UnitOfWork, books: CompanyBooks, { operation, input }: ProposalStep, idOf: (value: unknown) => string, anonymising: boolean): void {
  if (anonymising && PAYS_A_PERSON.has(operation)) throw new StepRefused(ANONYMISING)
  // The chat checked the input against this operation's schema, so each field has the type the schema gives it.
  const field = input as Readonly<Record<string, never>>
  const advances = () => recordsOfKindIn(books.records, OWNER_ADVANCE_RECORDS)
  switch (operation) {
    case 'add-owner-advance':
      unit
        .of(OWNER_ADVANCE_WRITES)
        .add(
          ownerAdvanceOfDraft(
            { date: dayOf(field['date']), amount: aboveZero(field['amount'], 'amount'), description: field['description'], category: idOf(field['category']) },
            books.workbook.categories,
          ),
        )
      return
    case 'change-owner-advance': {
      const before = heldOf(advances(), 'advance', (advance) => advance.id === field['advance'])
      const draft = {
        date: field['date'] === null ? before.date : dayOf(field['date']),
        amount: field['amount'] === null ? before.amount : aboveZero(field['amount'], 'amount'),
        description: (field['description'] as string | null) ?? before.description,
        category: field['category'] === null ? before.category : idOf(field['category']),
      }
      const after = ownerAdvanceOfDraft(draft, books.workbook.categories, before)
      unit.of(OWNER_ADVANCE_WRITES).change(before, field['ownerShare'] === null ? after : { ...after, ownerShare: advanceShare(books, after.category, field['ownerShare']) })
      return
    }
    case 'delete-owner-advance':
      unit.of(OWNER_ADVANCE_WRITES).remove(heldOf(advances(), 'advance', (advance) => advance.id === field['advance']))
      return
    case 'plan-category': {
      const category = idOf(field['category'])
      const year = field['year'] as number
      const month = field['month'] === null ? null : monthOf(field['month'])
      const amount = moneyFromAmount(field['amount'])
      // The plan's dialog takes zero or more, read positive for income and costs alike.
      if (amount < 0) throw new StepRefused('amount is zero or more, read positive for income and costs alike.')
      const held = yearLines(books, year, (line) => line.kind === 'amount' && line.item === category && line.month === month)
      replaceLine(unit, held, 'category', categoryPlanLine(year, month, category, amount, held[0]?.note ?? ''))
      return
    }
    case 'plan-dividend': {
      const year = field['year'] as number
      const held = yearLines(books, year, (line) => line.kind === 'amount' && line.item === 'dividend')
      replaceLine(unit, held, 'dividend', dividendPlanLine(year, monthOf(field['month']), aboveZero(field['amount'], 'amount'), (field['note'] as string | null) ?? held[0]?.note ?? ''))
      return
    }
    case 'plan-purchase': {
      const year = field['year'] as number
      const before = field['purchase'] === null ? null : heldOf(recordsOfKindIn(books.records, PLAN_RECORDS), 'plan row', (line) => line.id === field['purchase'])
      if (before !== null && before.kind !== 'purchase') throw new StepRefused('purchase names a plan row of a purchase.')
      if (before !== null && before.year !== year) throw new StepRefused(`That purchase is planned for ${before.year}, so year is ${before.year}.`)
      const name = (field['name'] as string).trim()
      if (name === '') throw new StepRefused('A purchase has a name.')
      const line = purchasePlanLine(year, dayInYear(field['date'], year, 'date'), aboveZero(field['amount'], 'amount'), field['group'] as AssetGroup, name)
      replaceLine(unit, before === null ? [] : [before], 'purchase', line)
      return
    }
    case 'plan-owner-pay': {
      const year = field['year'] as number
      const ofYear = new Set(recordsOf(recordsOfKindIn(books.records, SCENARIO_RECORDS)).flatMap((row) => (row.year === year ? [row.slug] : [])))
      const scenarioOf = (text: string): string => {
        if (!ofYear.has(text.trim())) throw new StepRefused(`${text} is not the short name of a pay scenario of ${year}.`)
        return text.trim()
      }
      const first = scenarioOf(field['scenario'])
      const switchTo = field['switchTo'] === null ? null : scenarioOf(field['switchTo'])
      if ((switchTo === null) !== (field['switchOn'] === null)) throw new StepRefused('switchTo and switchOn go together.')
      if (switchTo === first) throw new StepRefused('switchTo is another scenario than the one from 1 January.')
      const switchOn = switchTo === null ? null : dayInYear(field['switchOn'], year, 'switchOn')
      if (switchOn === civilDate(year, 1, 1)) throw new StepRefused('switchOn is a day after 1 January.')
      const held = yearLines(books, year, (line) => line.kind === 'owner-pay-scenario')
      replacePlanLines(
        unit.of(PLAN_WRITES),
        held.map((line): KeyedLine<PlanLine> => ({ key: line.kind === 'owner-pay-scenario' && line.from !== null ? 'switch' : 'opening', line })),
        [{ key: 'opening', line: ownerPayPlanLine(year, first, null) }, ...(switchTo === null || switchOn === null ? [] : [{ key: 'switch', line: ownerPayPlanLine(year, switchTo, switchOn) }])],
      )
      return
    }
    case 'clear-plan': {
      const line = heldOf(recordsOfKindIn(books.records, PLAN_RECORDS), 'plan row', (candidate) => candidate.id === field['line'])
      const cleared = line.kind === 'owner-pay-scenario' ? yearLines(books, line.year, (candidate) => candidate.kind === 'owner-pay-scenario') : [line]
      cleared.forEach((each) => unit.of(PLAN_WRITES).remove(each))
      return
    }
    case 'add-starting-scenarios': {
      const rent = field['rent'] === null ? null : aboveZero(field['rent'], 'rent')
      const { drafts } = startingScenarios(field['year'] as number, hrDooWorkbook(books.workbook).grants, rent)
      const taken = scenarioSlugs(books)
      const clash = drafts.filter((draft) => taken.has(draft.slug)).map((draft) => draft.slug)
      if (clash.length > 0) throw new StepRefused(`These short names are taken already: ${clash.join(', ')}.`)
      scenarioRowsOf(drafts).forEach((row) => unit.of(SCENARIO_WRITES).add(row))
      return
    }
    case 'add-component': {
      const [first] = scenarioRows(books, field['scenario'])
      unit.of(SCENARIO_WRITES).add(scenarioRowOfComponent(first!.slug, '', first!.year, componentOf(field)))
      return
    }
    case 'change-component':
    case 'delete-component': {
      const read = recordsOfKindIn(books.records, SCENARIO_RECORDS)
      const before = heldOf(read, 'scenario part', (row) => row.component.id === field['component'])
      if (operation === 'delete-component') unit.of(SCENARIO_WRITES).remove(before)
      else unit.of(SCENARIO_WRITES).change(before, scenarioRowOfComponent(before.slug, before.label, before.year, componentOf(field)))
      return
    }
    case 'rename-scenario': {
      const rows = scenarioRows(books, field['scenario'])
      const slug = newScenarioSlug(books, rows[0]!.slug, field['slug'])
      const label = (field['label'] as string | null)?.trim() ?? rows[0]!.label
      renameScenario(unit.of(SCENARIO_WRITES), rows, slug, label)
      return
    }
    case 'copy-scenario': {
      const rows = scenarioRows(books, field['scenario'])
      const slug = newScenarioSlug(books, rows[0]!.slug, field['slug'])
      if (slug === rows[0]!.slug) throw new StepRefused('A copy takes a short name of its own.')
      const label = (field['label'] as string | null)?.trim() ?? scenarioWords.nameDialog.copyLabel(scenarioName(rows[0]!))
      copyScenario(unit.of(SCENARIO_WRITES), rows, slug, label)
      return
    }
    default: {
      const unreadable = /^(fix|remove)-unreadable-(.+)$/.exec(operation)
      if (unreadable !== null && unreadable[2]! in EDITOR_KINDS) {
        writeUnreadableRow(unit, books, unreadable[2] as EditorName, unreadable[1]!, field)
        return
      }
      const [verb, ...rest] = operation.split('-')
      const name = rest.join('-')
      if ((verb === 'add' || verb === 'change' || verb === 'delete') && name in EDITOR_KINDS) {
        writeEditorRow(unit, books, name as EditorName, verb, field, idOf)
        return
      }
      if (plannedTripStep(unit, books, { operation, input, as: null }, idOf, anonymising)) return
      throw new StepRefused('There is no such operation.')
    }
  }
}

/** The pack's changes for Company's proposer, which asks `anonymising` at each check, since employees and pay stay on the device while it is on. */
export function hrDooOperations(anonymising: () => boolean): PackOperations {
  return {
    operations: PACK_OPERATIONS,
    plan: (unit, books, step, idOf) => planned(unit, books, step, idOf, anonymising()),
    describer: packDescriber,
  }
}
