import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { words } from '../src/apps/company/packs/hr-doo/assistant/words'
import { hrDooOperations, PACK_OPERATIONS } from '../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import {
  ASSET_RECORDS,
  EMPLOYEE_RECORDS,
  GRANT_RECORDS,
  OWNER_ADVANCE_RECORDS,
  PLAN_RECORDS,
  SCENARIO_RECORDS,
  TRIP_COST_RECORDS,
  TRIP_LEG_RECORDS,
  TRIP_RECORDS,
  YEAR_END_RECORDS,
} from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { saveTripCost, saveTripLeg, tripOfOrder, tripOfSettlement } from '../src/apps/company/packs/hr-doo/application/tripWrites'
import { grantOfFields } from '../src/apps/company/packs/hr-doo/domain/grants/grantsReading'
import { GRANT_WRITES, TRIP_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { CATEGORY_RECORDS, LEDGER_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { wholeRowPartId } from '../src/apps/company/workbook/domain/splits'
import { SPLIT_WRITES, removeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { storedSplitOf } from '../src/apps/company/workbook/domain/splitsReading'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { CheckedProposal } from '../src/shared/app/assistantOperations'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { defaultsOnAdd } from '../src/apps/company/packs/hr-doo/assistant/operations/proposalLines'
import { packFieldsInLabel } from '../src/apps/company/packs/hr-doo/assistant/operations/proposalLines'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import { addMoney, negateMoney, subtractMoney } from '../src/shared/money/money'
import { amountText } from '../src/shared/storage/domain/recordFields'
import { companyChat, deskPorts } from './fixtures/companyDesk'
import { civil, euros } from './fixtures/ledger'
import { recordOf } from './fixtures/records'
import type { CompanyChat } from './fixtures/companyDesk'
import { browserHarness, forgetCaches } from './fixtures/writeBack'
import { expectCountsOfChanges } from './fixtures/cardCounts'
import { stepOf } from './fixtures/operationSteps'
import { exampleInput } from './fixtures/exampleInput'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** The record an example names by the name it gives it, as the chat reads its id, from the fake company's books. */
function exampleRecords(desk: PackDesk): Readonly<Record<string, string>> {
  const books = desk.store.state as CompanyBooks
  const first = <R>(kind: RecordKind<R>, pick: (record: R) => boolean, idOf: (record: R) => string) => idOf(recordsOf(recordsOfKindIn(books.records, kind)).find(pick)!)
  return {
    category: 'ai-services',
    advance: first(
      OWNER_ADVANCE_RECORDS,
      () => true,
      (advance) => advance.id,
    ),
    'plan-line': first(
      PLAN_RECORDS,
      (line) => line.kind === 'amount' && line.year === 2026,
      (line) => line.id,
    ),
    component: first(
      SCENARIO_RECORDS,
      (row) => row.slug === 'floor-salary' && row.component.component === 'dividend',
      (row) => row.component.id,
    ),
    'year-end-line': first(
      YEAR_END_RECORDS,
      (line) => line.statement === 'konto',
      (line) => line.id,
    ),
    asset: first(
      ASSET_RECORDS,
      () => true,
      (asset) => asset.id,
    ),
    grant: first(
      GRANT_RECORDS,
      (grant) => grant.slug === 'startup-grant',
      (grant) => grant.slug,
    ),
    'grant-unused': first(
      GRANT_RECORDS,
      (grant) => grant.slug === 'unused-grant',
      (grant) => grant.slug,
    ),
    employee: first(
      EMPLOYEE_RECORDS,
      () => true,
      (employee) => employee.slug,
    ),
    trip: first(
      TRIP_RECORDS,
      () => true,
      (trip) => trip.id,
    ),
    'trip-leg': first(
      TRIP_LEG_RECORDS,
      () => true,
      (leg) => leg.id,
    ),
    'trip-cost': first(
      TRIP_COST_RECORDS,
      () => true,
      (cost) => cost.id,
    ),
    'ledger-row': tripRows(books).payout.id,
  }
}

/** The traveller's first two payments, which the desk's trip takes as its advance and its payout. */
function tripRows(books: CompanyBooks): { readonly advance: Transaction; readonly payout: Transaction } {
  const iban = recordsOf(recordsOfKindIn(books.records, EMPLOYEE_RECORDS)).at(-1)!.ibans[0]
  const [advance, payout] = books.workbook.transactions
    .filter((row) => row.amount < 0 && row.rowId !== null && row.counterpartyIban === iban)
    .sort((first, second) => first.date.localeCompare(second.date))
  return { advance: advance!, payout: payout! }
}

/** Categories that hold the tax-free payments of the desk's trip, so its rows can be filed by its settlement. */
const TRIP_CATEGORIES: readonly (readonly [string, string])[] = [
  ['per-diems', 'tax-free:domestic-per-diem-over-12-hours'],
  ['car-kilometres', 'tax-free:private-car-business-travel'],
  ['trip-costs', 'tax-free:business-travel-cost'],
]

/** A grant no asset is funded by, so the example of a delete has one to take. */
const UNUSED_GRANT = grantOfFields(storedFieldsOfValues({ grant: 'unused-grant', received: '2026-03-01', amount: '500', fixed_part: '500', variable_part: '0' }))

/** A made-up order to Split by private car, which the trip operations' examples change. */
const SPLIT_ORDER = {
  number: '1/2026',
  issued: '2026-03-10',
  traveller: '',
  role: 'Director',
  destination: 'Split',
  country: '',
  task: 'Client meeting',
  departs: '2026-03-12',
  days: '2',
  transport: 'private-car',
  car: 'Made-up Estate',
  plate: 'ZG-000-XX',
  kmRate: '0.50',
  advance: '',
  settleBy: '',
  note: '',
}

interface PackDesk extends CompanyChat {
  readonly store: WorkbookStore<CompanyBooks>
  anonymising: boolean
}

/** The fake company with five employees, and the chat proposing to it through Company's proposer with the pack's operations. */
async function packDesk(): Promise<PackDesk> {
  const { store } = await browserHarness(used, fakeWorkbookDocument('2026-11-07T09:00:00.000Z', 'browser', fakeStaffOf('five-employees')))
  await store.write('A grant and a travel order', (unit) => {
    unit.of(GRANT_WRITES).add(UNUSED_GRANT)
    // The last employee travels, so the examples' first employee stays free to delete.
    const traveller = recordsOf(recordsOfKindIn(store.state.records!, EMPLOYEE_RECORDS)).at(-1)!.slug
    const ordered = tripOfOrder({ ...SPLIT_ORDER, traveller }, null)
    if (!('made' in ordered)) throw new Error(ordered.refused)
    const settled = tripOfSettlement(ordered.made, {
      left: '2026-03-12 07:00',
      returned: '2026-03-13 20:00',
      borderOut: '',
      borderIn: '',
      odometerStart: '10000',
      odometerEnd: '10900',
      meals: '',
      report: '',
      settledOn: '',
    })
    if (!('made' in settled)) throw new Error(settled.refused)
    const trip = settled.made
    // The advance is the traveller's first payment, linked, and a ticket brings what the trip owes to that and their second payment.
    const { advance, payout } = tripRows(store.state as CompanyBooks)
    const linked = { ...trip, advance: negateMoney(advance.amount), advanceRow: advance.rowId, report: 'Met the client.', settledOn: civil('2026-03-16') }
    unit.of(TRIP_WRITES).add(linked)
    saveTripLeg(unit, linked, { date: '2026-03-12', from: 'Zagreb', to: 'Split', km: '410' }, null)
    saveTripCost(unit, linked, { date: '2026-03-12', kind: 'toll', description: 'Motorway', amount: '27.40', foreignAmount: '', currency: '', paidBy: 'traveller' }, null)
    // 60.00 of per diems for two days over 12 hours and 410 km at 0.50, beside the toll.
    const ticket = subtractMoney(negateMoney(addMoney(advance.amount, payout.amount)), euros(60 + 205 + 27.4))
    saveTripCost(unit, linked, { date: '2026-03-12', kind: 'ticket', description: 'Ferry', amount: amountText(ticket), foreignAmount: '', currency: '', paidBy: 'traveller' }, null)
    for (const [category, role] of TRIP_CATEGORIES) {
      unit.of(CATEGORY_WRITES).add(recordOf(CATEGORY_RECORDS, { category, family: 'owner', bucket: 'owner-pay', roles: role }))
    }
  })
  const desk = { anonymising: false } as { anonymising: boolean }
  return Object.assign(desk, { ...companyChat(store, deskPorts({ pack: hrDooOperations(() => desk.anonymising) }), false), store })
}

/** Fields Kuna keeps by itself or shows through another field, which a card leaves off. */
const NOT_ON_CARD: ReadonlySet<string> = new Set(['id', 'ownerPart', 'kind', 'key'])

/** For each record a card adds or changes, the field names it shows and the names of the fields the change sets. */
function fieldsOnCard(card: CheckedProposal): { readonly shown: readonly string[]; readonly set: readonly string[] }[] {
  const { changes } = card.held as { readonly changes: readonly RuledChange[] }
  const taken = new Map<string, number>()
  return changes.flatMap(({ change }) => {
    if (change.verb !== 'add' && change.verb !== 'change') return []
    const group = card.groups.find((candidate) => candidate.verb === change.verb && candidate.noun === change.kind.noun)!
    const at = taken.get(group.verb + group.noun.en.one) ?? 0
    taken.set(group.verb + group.noun.en.one, at + 1)
    const before = (change.verb === 'change' ? change.before : defaultsOnAdd(change.kind)) as Readonly<Record<string, unknown>>
    const after = change.after as Readonly<Record<string, unknown>>
    const said = (value: unknown) => JSON.stringify(value === undefined || value === '' || (Array.isArray(value) && value.length === 0) ? null : value)
    const inLabel = change.verb === 'add' ? packFieldsInLabel(change.kind) : new Set<string>()
    const set = Object.keys({ ...before, ...after }).filter((field) => !NOT_ON_CARD.has(field) && !inLabel.has(field) && said(before[field]) !== said(after[field]))
    return [{ shown: group.lines[at]!.fields.map((field) => field.name), set: set.map((field) => (words.proposals.fields as Readonly<Record<string, string>>)[field] ?? field) }]
  })
}

const recordsOfKind = <R>(desk: PackDesk, kind: RecordKind<R>) => recordsOf(recordsOfKindIn(desk.store.state.records!, kind))

/** The operations on a row Kuna cannot read, which have no Undo, as the editor's save of such a row has none. */
const ON_UNREADABLE_ROWS = PACK_OPERATIONS.filter((operation) => operation.name.includes('-unreadable-'))

describe('every operation of the d.o.o. pack', () => {
  it.each(PACK_OPERATIONS.filter((operation) => !ON_UNREADABLE_ROWS.includes(operation)).map((operation) => [operation.name, operation] as const))(
    'has an example that passes the checks, writes once and is undone once: %s',
    async (_name, operation) => {
      const desk = await packDesk()
      const before = JSON.stringify(desk.store.state.records)

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(operation, desk, exampleRecords(desk)) }])

      expect(answer.text).toContain('The card shows')
      const [card] = desk.cards
      expectCountsOfChanges(card!)
      expect(card!.undoable).toBe(true)
      for (const { shown, set } of fieldsOnCard(card!)) expect(shown).toEqual(expect.arrayContaining([...set]))
      const accepted = await desk.accept()
      expect(accepted.kind).toBe('done')
      expect(desk.store.state.writes).toHaveLength(2)
      expect(accepted.kind === 'done' && (await accepted.undo!())).toEqual({ kind: 'undone' })
      expect(JSON.stringify(desk.store.state.records)).toBe(before)
    },
  )
})

describe('employees and pay', () => {
  it('refuses to change an employee or a pay scenario while Anonymise is on, and asks to turn it off', async () => {
    const desk = await packDesk()
    desk.anonymising = true
    for (const name of ['change-employee', 'add-employee', 'add-component']) {
      const operation = PACK_OPERATIONS.find((candidate) => candidate.name === name)!

      const answer = await desk.propose([{ op: name, input: exampleInput(operation, desk, exampleRecords(desk)) }])

      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('turn Anonymise off')
    }
    expect(desk.cards).toEqual([])
  })

  it("plans and clears the owner's own pay while Anonymise is on, as it is the owner's", async () => {
    const desk = await packDesk()
    desk.anonymising = true
    const switched = recordsOfKind(desk, PLAN_RECORDS).find((line) => line.kind === 'owner-pay-scenario' && line.from !== null)!

    const planned = await desk.propose([stepOf(PACK_OPERATIONS, 'plan-owner-pay', { year: 2027, scenario: 'early-exit' })])
    const cleared = await desk.propose([stepOf(PACK_OPERATIONS, 'clear-plan', { line: desk.ref(PLAN_RECORDS.name, switched.id) })])

    for (const answer of [planned, cleared]) expect(answer.isError, answer.text).toBe(false)
    expect(desk.cards).toHaveLength(2)
  })

  it("warns on the accounts an employee's pay goes to", async () => {
    const desk = await packDesk()
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'change-employee')!

    await desk.propose([{ op: 'change-employee', input: exampleInput(operation, desk, exampleRecords(desk)) }])

    const [line] = desk.cards[0]!.groups[0]!.lines
    expect(line!.fields[0]).toMatchObject({ before: expect.any(String), after: 'HR1210010051863000160', warns: true })
  })

  it("keeps an employee's other columns as they were when only one changes", async () => {
    const desk = await packDesk()
    const [employee] = recordsOfKind(desk, EMPLOYEE_RECORDS)
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'change-employee')!

    await desk.propose([{ op: 'change-employee', input: { ...exampleInput(operation, desk, exampleRecords(desk)), iban: null, dependants: '2' } }])
    await desk.accept()

    const [after] = recordsOfKind(desk, EMPLOYEE_RECORDS)
    expect(after).toEqual({ ...employee, dependants: 2 })
  })
})

describe('the plan', () => {
  it('refuses a purchase on a day outside its year', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([stepOf(PACK_OPERATIONS, 'plan-purchase', { year: 2026, date: '2027-01-02', amount: 100, group: 'computers', name: 'Chair' })])

    expect(answer).toMatchObject({ isError: true, text: 'date is a day of 2026.' })
  })

  it("replaces the year's owner pay with one scenario, taking the switch row away", async () => {
    const desk = await packDesk()

    await desk.propose([stepOf(PACK_OPERATIONS, 'plan-owner-pay', { year: 2027, scenario: 'early-exit' })])
    await desk.accept()

    const ownerPay = recordsOfKind(desk, PLAN_RECORDS).filter((line) => line.kind === 'owner-pay-scenario')
    expect(ownerPay).toEqual([expect.objectContaining({ year: 2027, scenario: 'early-exit', from: null })])
  })

  it("clears both owner pay rows of a year from either one, as the plan's Clear does", async () => {
    const desk = await packDesk()
    const switched = recordsOfKind(desk, PLAN_RECORDS).find((line) => line.kind === 'owner-pay-scenario' && line.from !== null)!

    await desk.propose([stepOf(PACK_OPERATIONS, 'clear-plan', { line: desk.ref(PLAN_RECORDS.name, switched.id) })])

    expect(desk.cards[0]!.count).toBe(2)
  })

  it('refuses a copy of a scenario under a short name another scenario holds', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([stepOf(PACK_OPERATIONS, 'copy-scenario', { scenario: 'floor-extras', slug: 'early-exit' })])

    expect(answer).toMatchObject({ isError: true, text: 'early-exit is already the short name of a scenario.' })
  })
})

describe('the editors', () => {
  it("refuses a row the editor's factory refuses, with its reason", async () => {
    const desk = await packDesk()
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'add-asset')!

    const answer = await desk.propose([{ op: 'add-asset', input: { ...exampleInput(operation, desk, exampleRecords(desk)), bought: 'soon' } }])

    expect(answer.isError).toBe(true)
    expect(desk.cards).toEqual([])
  })

  it("names the asset on the card and shows its cost in the company's money", async () => {
    const desk = await packDesk()
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'add-asset')!

    await desk.propose([{ op: 'add-asset', input: exampleInput(operation, desk, exampleRecords(desk)) }])

    const [line] = desk.cards[0]!.groups[0]!.lines
    expect(line!.label).toBe('Laptop')
    expect(line!.fields.find((field) => field.name === 'Cost without VAT')?.after).toMatch(/1,500\.00/)
  })
})

describe('linking an asset to its payment', () => {
  it('links an asset to the payment out a ledger row names, by the row id', async () => {
    const desk = await packDesk()
    const [asset] = recordsOf(recordsOfKindIn(desk.store.state.records!, ASSET_RECORDS))
    const payment = desk.store.state.workbook!.transactions.find((row) => row.amount < 0 && row.rowId !== null)!

    await desk.propose([{ op: 'change-asset', input: { ...editorRow('change-asset', {}), row: desk.ref(ASSET_RECORDS.name, asset!.id), payment: desk.ref(LEDGER_RECORDS.name, payment.id) } }])
    expect(desk.cards[0]!.groups[0]!.lines[0]!.fields.map((field) => field.name)).toEqual(['Payment'])
    await desk.accept()

    expect(recordsOf(recordsOfKindIn(desk.store.state.records!, ASSET_RECORDS)).find((candidate) => candidate.id === asset!.id)!.rowId).toBe(payment.rowId)
  })

  it('refuses money coming in as an asset’s payment', async () => {
    const desk = await packDesk()
    const [asset] = recordsOf(recordsOfKindIn(desk.store.state.records!, ASSET_RECORDS))
    const income = desk.store.state.workbook!.transactions.find((row) => row.amount > 0 && row.rowId !== null)!

    const answer = await desk.propose([
      { op: 'change-asset', input: { ...editorRow('change-asset', {}), row: desk.ref(ASSET_RECORDS.name, asset!.id), payment: desk.ref(LEDGER_RECORDS.name, income.id) } },
    ])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('brings money in') })
    expect(desk.cards).toEqual([])
  })
})

describe("filing a trip's rows by its settlement", () => {
  it('refuses to take off by hand the split a travel order filed, in the chat and on the screen, naming the order', async () => {
    const desk = await packDesk()
    const trip = recordsOf(recordsOfKindIn(desk.store.state.records!, TRIP_RECORDS))[0]!
    await desk.propose([{ op: 'file-trip-rows', input: { trip: desk.ref(TRIP_RECORDS.name, trip.id) } }])
    expect((await desk.accept()).kind).toBe('done')
    const { advance } = tripRows(desk.store.state as CompanyBooks)
    const said = 'keeps its split, since the travel order 1/2026 files it.'

    const answer = await desk.propose([{ op: 'delete-split', input: { row: desk.ref(LEDGER_RECORDS.name, advance.id) } }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining(said) })
    const books = desk.store.state as CompanyBooks
    const stored = storedSplitOf(books.records.splits, books.workbook.splits, advance)
    await expect(desk.store.write('Removed', (unit) => removeSplit(unit, books, advance, stored))).rejects.toThrow(said)
    expect(desk.store.state.workbook!.splits.some((split) => split.row.id === advance.id)).toBe(true)
  })

  it('files a row again with each part it holds in a category the settlement files kept, by its id and with its note', async () => {
    const desk = await packDesk()
    const trip = recordsOf(recordsOfKindIn(desk.store.state.records!, TRIP_RECORDS))[0]!
    const fileRows = async () => {
      await desk.propose([{ op: 'file-trip-rows', input: { trip: desk.ref(TRIP_RECORDS.name, trip.id) } }])
      expect((await desk.accept()).kind).toBe('done')
    }
    const { advance } = tripRows(desk.store.state as CompanyBooks)
    const partsOfAdvance = () => desk.store.state.workbook!.splits.find((split) => split.row.id === advance.id)!.parts
    await fileRows()
    const filed = partsOfAdvance()
    expect(filed.map((part) => part.id)).toContain(wholeRowPartId(advance))
    // A person moves a euro between the two smaller parts and notes one, so the settlement has something to put back.
    const [, larger, smaller] = recordsOf(desk.store.state.records!.splits)
      .filter((part) => filed.some((held) => held.id === part.id))
      .sort((one, other) => Math.abs(other.amount) - Math.abs(one.amount))
    await desk.store.write('Changed', (unit) => {
      unit.of(SPLIT_WRITES).change(larger!, { ...larger!, amount: addMoney(larger!.amount, euros(1)) })
      unit.of(SPLIT_WRITES).change(smaller!, { ...smaller!, amount: subtractMoney(smaller!.amount, euros(1)), note: 'Two days in Split' })
    })

    await fileRows()

    expect(partsOfAdvance().map((part) => [part.id, part.amount, part.note])).toEqual(filed.map((part) => [part.id, part.amount, part.id === smaller!.id ? 'Two days in Split' : part.note]))
  })
})

/** The input of an editor's add, every column left as it is but the ones given. */
function editorRow(name: string, columns: Readonly<Record<string, string>>): Record<string, unknown> {
  const operation = PACK_OPERATIONS.find((candidate) => candidate.name === name)!
  const fields = Object.keys((operation.input as { readonly properties: object }).properties)
  return { ...Object.fromEntries(fields.map((field) => [field, null])), ...columns }
}

describe('what the write check refuses for the chat as for the screens', () => {
  it('refuses an employee under a short name another employee holds', async () => {
    const desk = await packDesk()
    const [employee] = recordsOfKind(desk, EMPLOYEE_RECORDS)

    const answer = await desk.propose([{ op: 'add-employee', input: editorRow('add-employee', { employee: employee!.slug, name: 'Ana Two', residence_city: 'Zagreb', from: '2026-11-01' }) }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining(`"${employee!.slug}" is in the workbook already`) })
    expect(desk.cards).toEqual([])
  })

  it('refuses a second director, since neither would then count', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([
      { op: 'add-employee', input: editorRow('add-employee', { employee: 'second-boss', name: 'Second Boss', residence_city: 'Zagreb', from: '2026-11-01', director: 'TRUE' }) },
    ])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('more than one row is marked director') })
    expect(desk.cards).toEqual([])
  })

  it('refuses a year-end line its statement lacks by naming the lines it has', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([{ op: 'add-year-end-line', input: editorRow('add-year-end-line', { year: '2026', statement: 'pl', line: 'made-up', amount: '5' }) }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('"made-up" is not a line of pl, which has sales, own-use') })
  })

  it('refuses a year-end line under a year, statement and line another line holds', async () => {
    const desk = await packDesk()
    const [line] = recordsOfKind(desk, YEAR_END_RECORDS)

    const answer = await desk.propose([{ op: 'add-year-end-line', input: editorRow('add-year-end-line', { year: String(line!.year), statement: line!.statement, line: line!.line, amount: '5' }) }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('is listed on more than one row') })
    expect(desk.cards).toEqual([])
  })

  it('refuses an owner advance in a category outside the operating and taxes buckets, added or moved there', async () => {
    const desk = await packDesk()
    const [advance] = recordsOfKind(desk, OWNER_ADVANCE_RECORDS)
    const revenue = desk.ref('category', 'revenue')

    const added = await desk.propose([stepOf(PACK_OPERATIONS, 'add-owner-advance', { date: '2026-10-10', amount: 10, description: 'Lamp', category: revenue })])
    const moved = await desk.propose([stepOf(PACK_OPERATIONS, 'change-owner-advance', { advance: desk.ref(OWNER_ADVANCE_RECORDS.name, advance!.id), category: revenue })])

    for (const answer of [added, moved]) expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('"revenue" is in the income bucket') })
    expect(desk.cards).toEqual([])
  })

  it("sets an owner advance's share as Transactions does, and refuses one off operating cost", async () => {
    const desk = await packDesk()
    const advance = recordsOfKind(desk, OWNER_ADVANCE_RECORDS).find(
      (candidate) => desk.store.state.workbook!.categories.find((category) => category.slug === candidate.category)?.bucket === 'operating',
    )!
    const change = (fields: Record<string, unknown>) => ({
      op: 'change-owner-advance',
      input: { advance: desk.ref(OWNER_ADVANCE_RECORDS.name, advance.id), date: null, amount: null, description: null, category: null, ownerShare: null, ...fields },
    })

    const set = await desk.propose([change({ ownerShare: '30' })])
    const wrong = await desk.propose([change({ ownerShare: '130' })])

    expect(set.isError, set.text).toBe(false)
    expect((await desk.accept(0)).kind).toBe('done')
    expect(recordsOfKind(desk, OWNER_ADVANCE_RECORDS).find((candidate) => candidate.id === advance.id)!.ownerShare).toBe(30)
    expect(wrong).toMatchObject({ isError: true, text: expect.stringContaining('whole number from 0 to 100') })
  })

  it('refuses to delete a grant an asset is funded by', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([stepOf(PACK_OPERATIONS, 'delete-grant', { row: desk.ref(GRANT_RECORDS.name, 'startup-grant') })])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('"startup-grant" cannot be deleted') })
  })

  it('refuses to rename a scenario the plan picks', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([stepOf(PACK_OPERATIONS, 'rename-scenario', { scenario: 'floor-salary', slug: 'renamed' })])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('"floor-salary" cannot be renamed') })
  })

  it.each([
    ['a first day outside the scenario year', { kind: 'rent_monthly', amount: 400, item: null, from: '2030-03-01', to: null }, 'is outside 2027'],
    ['a last day before the first', { kind: 'rent_monthly', amount: 400, item: null, from: '2027-05-01', to: '2027-03-01' }, 'to 2027-03-01 is before from 2027-05-01'],
    ['a tax-free item the year does not list', { kind: 'nontaxable', amount: 50, item: 'made-up-item', from: null, to: null }, 'is not a tax-free payment the ruleset lists for 2027'],
  ])('refuses a scenario part with %s', async (_case, part, reason) => {
    const desk = await packDesk()

    const answer = await desk.propose([{ op: 'add-component', input: { scenario: 'early-exit', basis: null, ...part } }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining(reason) })
  })
})

describe('the plan rows', () => {
  it('refuses to move a planned purchase to another year', async () => {
    const desk = await packDesk()
    const purchase = recordsOfKind(desk, PLAN_RECORDS).find((line) => line.kind === 'purchase')!

    const answer = await desk.propose([
      stepOf(PACK_OPERATIONS, 'plan-purchase', {
        purchase: desk.ref(PLAN_RECORDS.name, purchase.id),
        year: purchase.year + 1,
        date: `${purchase.year + 1}-02-01`,
        amount: 100,
        group: 'computers',
        name: 'Moved',
      }),
    ])

    expect(answer).toMatchObject({ isError: true, text: `That purchase is planned for ${purchase.year}, so year is ${purchase.year}.` })
  })

  it('refuses an amount below zero, as the plan dialog takes zero or more', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([stepOf(PACK_OPERATIONS, 'plan-category', { category: desk.ref('category', 'ai-services'), year: 2027, amount: -40 })])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('zero or more') })
  })

  it("shows a category's amount for every month as every month", async () => {
    const desk = await packDesk()

    await desk.propose([stepOf(PACK_OPERATIONS, 'plan-category', { category: desk.ref('category', 'ai-services'), year: 2027, amount: 40 })])

    const [line] = desk.cards[0]!.groups[0]!.lines
    expect(line!.fields).toContainEqual(expect.objectContaining({ name: 'Month', after: 'every month' }))
  })
})

/** The fake company with an asset whose cost reads as no amount, as a person might type it in a file, so the Assets editor cannot read the row. */
async function unreadableAssetDesk(): Promise<PackDesk> {
  const document = fakeWorkbookDocument('2026-11-07T09:00:00.000Z', 'browser', fakeStaffOf('five-employees'))
  const assets = (document.records['hr-doo.asset'] ?? []).map((record, at) => (at === 0 ? { ...record, cost_net: 'lots' } : record))
  const { store } = await browserHarness(used, { ...document, records: { ...document.records, 'hr-doo.asset': assets } })
  const desk = { anonymising: false } as { anonymising: boolean }
  return Object.assign(desk, { ...companyChat(store, deskPorts({ pack: hrDooOperations(() => desk.anonymising) }), false), store })
}

describe('a row the editor cannot read', () => {
  it('is fixed through the editor’s columns on a card with no Undo, which shows the row as it will be', async () => {
    const desk = await unreadableAssetDesk()
    expect(recordsOfKindIn(desk.store.state.records!, ASSET_RECORDS).refused).toHaveLength(1)

    const answer = await desk.propose([{ op: 'fix-unreadable-asset', input: { ...editorRow('fix-unreadable-asset', { cost_net: '1519.20' }), row: 1 } }])

    expect(answer.isError, answer.text).toBe(false)
    const [card] = desk.cards
    expect(card!.undoable).toBe(false)
    expect(card!.groups).toEqual([expect.objectContaining({ verb: 'change', lines: [expect.objectContaining({ label: 'Laptop 14 inch' })] })])
    const accepted = await desk.accept()
    expect(accepted).toEqual({ kind: 'done', undo: null })
    expect(recordsOfKindIn(desk.store.state.records!, ASSET_RECORDS).refused).toEqual([])
    expect(recordsOfKind(desk, ASSET_RECORDS).find((asset) => asset.name === 'Laptop 14 inch')?.costNet).toBe(151920)
  })

  it('is removed on a card with no Undo that names it', async () => {
    const desk = await unreadableAssetDesk()

    await desk.propose([stepOf(PACK_OPERATIONS, 'remove-unreadable-asset', { row: 1 })])

    expect(desk.cards[0]!.undoable).toBe(false)
    expect(desk.cards[0]!.groups).toEqual([expect.objectContaining({ verb: 'remove', lines: [expect.objectContaining({ label: 'Laptop 14 inch' })] })])
    await desk.accept()
    expect(recordsOfKindIn(desk.store.state.records!, ASSET_RECORDS).refused).toEqual([])
  })

  it('goes alone on its card, so a fix never takes the Undo of other changes with it', async () => {
    const desk = await unreadableAssetDesk()
    const [waiting] = recordsOf(recordsOfKindIn(desk.store.state.records!, LEDGER_RECORDS))

    const answer = await desk.propose([
      { op: 'file-row', input: { row: desk.ref(LEDGER_RECORDS.name, waiting!.id), category: desk.ref(CATEGORY_RECORDS.name, 'office-supplies') } },
      { op: 'fix-unreadable-asset', input: { ...editorRow('fix-unreadable-asset', { cost_net: '1519.20' }), row: 1 } },
    ])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('A change with no Undo goes alone on a card') })
    expect(desk.cards).toEqual([])
  })

  it('is refused by a place past the rows Kuna cannot read, and when it reads every row', async () => {
    const unreadable = await unreadableAssetDesk()
    const readable = await packDesk()

    const past = await unreadable.propose([stepOf(PACK_OPERATIONS, 'remove-unreadable-asset', { row: 2 })])
    const none = await readable.propose([stepOf(PACK_OPERATIONS, 'remove-unreadable-grant', { row: 1 })])

    expect(past).toMatchObject({ isError: true, text: 'row is a whole number from 1 to 1.' })
    expect(none).toMatchObject({ isError: true, text: 'Kuna reads every grant row.' })
  })

  it("leaves an employee's row to the person while Anonymise is on", async () => {
    const desk = await packDesk()
    desk.anonymising = true

    const answer = await desk.propose([stepOf(PACK_OPERATIONS, 'remove-unreadable-employee', { row: 1 })])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('turn Anonymise off') })
  })
})
