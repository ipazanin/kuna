import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { words } from '../src/apps/company/packs/hr-doo/assistant/words'
import { hrDooOperations, PACK_OPERATIONS } from '../src/apps/company/packs/hr-doo/assistant/operations/packOperations'
import { ASSET_RECORDS, EMPLOYEE_RECORDS, GRANT_RECORDS, OWNER_ADVANCE_RECORDS, PLAN_RECORDS, SCENARIO_RECORDS, YEAR_END_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { grantOfFields } from '../src/apps/company/packs/hr-doo/domain/grants/grantsReading'
import { GRANT_WRITES } from '../src/apps/company/packs/hr-doo/domain/hrDooWrites'
import { fakeStaffOf } from '../src/apps/company/packs/hr-doo/infrastructure/fake/fakeStaff'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import { CATEGORY_RECORDS, LEDGER_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { recordsOfKindIn } from '../src/apps/company/workbook/domain/readWorkbook'
import { fakeWorkbookDocument } from '../src/apps/company/workbook/infrastructure/fake/fakeWorkbook'
import type { CheckedProposal } from '../src/shared/app/assistantOperations'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { RuledChange } from '../src/shared/storage/application/recordWrites'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import type { RecordKind } from '../src/shared/storage/domain/recordKind'
import { storedFieldsOfValues } from '../src/shared/storage/domain/storedFields'
import { companyChat, deskPorts } from './fixtures/companyDesk'
import type { CompanyChat } from './fixtures/companyDesk'
import { browserHarness, forgetCaches } from './fixtures/writeBack'

const used = new Set<string>()
afterEach(async () => forgetCaches(used))

/** The record an example names by the name it gives it, as the chat reads its id, from the fake company's books. */
function exampleRecords(books: CompanyBooks): Readonly<Record<string, { readonly kind: string; readonly id: string }>> {
  const first = <R>(kind: RecordKind<R>, pick: (record: R) => boolean, idOf: (record: R) => string) => {
    const record = recordsOf(recordsOfKindIn(books.records, kind)).find(pick)!
    return { kind: kind.name, id: idOf(record) }
  }
  return {
    category: { kind: 'category', id: 'ai-services' },
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
  }
}

/** The short names an example writes as text, a scenario being no record of its own. */
const EXAMPLE_TEXT: Readonly<Record<string, string>> = { scenario: 'floor-salary', 'scenario-unplanned': 'early-exit' }

/** A grant no asset is funded by, so the example of a delete has one to take. */
const UNUSED_GRANT = grantOfFields(storedFieldsOfValues({ grant: 'unused-grant', received: '2026-03-01', amount: '500', fixed_part: '500', variable_part: '0' }))

interface PackDesk extends CompanyChat {
  readonly store: WorkbookStore<CompanyBooks>
  anonymising: boolean
}

/** The fake company with five employees, and the chat proposing to it through Company's proposer with the pack's operations. */
async function packDesk(): Promise<PackDesk> {
  const { store } = await browserHarness(used, fakeWorkbookDocument('2026-11-07T09:00:00.000Z', 'browser', fakeStaffOf('five-employees')))
  await store.write('A grant', (unit) => unit.of(GRANT_WRITES).add(UNUSED_GRANT))
  const desk = { anonymising: false } as { anonymising: boolean }
  return Object.assign(desk, { ...companyChat(store, deskPorts({ pack: hrDooOperations(() => desk.anonymising) }), false), store })
}

/** The example's input with each record it names as a ref the chat handed out, and each scenario by a short name the fake company holds. */
function exampleInput(desk: PackDesk, operation: (typeof PACK_OPERATIONS)[number]): Record<string, unknown> {
  const records = exampleRecords(desk.store.state as CompanyBooks)
  return Object.fromEntries(
    Object.entries(operation.example).map(([field, value]) => {
      if (typeof value !== 'string') return [field, value]
      if (operation.refs[field] !== undefined) return [field, desk.ref(records[value]!.kind, records[value]!.id)]
      return [field, EXAMPLE_TEXT[value] ?? value]
    }),
  )
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
    const before = (change.verb === 'change' ? change.before : {}) as Readonly<Record<string, unknown>>
    const after = change.after as Readonly<Record<string, unknown>>
    const said = (value: unknown) => JSON.stringify(value === undefined || value === '' || (Array.isArray(value) && value.length === 0) ? null : value)
    const set = Object.keys({ ...before, ...after }).filter((field) => !NOT_ON_CARD.has(field) && said(before[field]) !== said(after[field]))
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

      const answer = await desk.propose([{ op: operation.name, input: exampleInput(desk, operation) }])

      expect(answer.text).toContain('The card shows')
      const [card] = desk.cards
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

      const answer = await desk.propose([{ op: name, input: exampleInput(desk, operation) }])

      expect(answer.isError).toBe(true)
      expect(answer.text).toContain('turn Anonymise off')
    }
    expect(desk.cards).toEqual([])
  })

  it("plans and clears the owner's own pay while Anonymise is on, as it is the owner's", async () => {
    const desk = await packDesk()
    desk.anonymising = true
    const switched = recordsOfKind(desk, PLAN_RECORDS).find((line) => line.kind === 'owner-pay-scenario' && line.from !== null)!

    const planned = await desk.propose([{ op: 'plan-owner-pay', input: { year: 2027, scenario: 'early-exit', switchTo: null, switchOn: null } }])
    const cleared = await desk.propose([{ op: 'clear-plan', input: { line: desk.ref(PLAN_RECORDS.name, switched.id) } }])

    for (const answer of [planned, cleared]) expect(answer.isError, answer.text).toBe(false)
    expect(desk.cards).toHaveLength(2)
  })

  it("warns on the accounts an employee's pay goes to", async () => {
    const desk = await packDesk()
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'change-employee')!

    await desk.propose([{ op: 'change-employee', input: exampleInput(desk, operation) }])

    const [line] = desk.cards[0]!.groups[0]!.lines
    expect(line!.fields[0]).toMatchObject({ before: expect.any(String), after: 'HR1210010051863000160', warns: true })
  })

  it("keeps an employee's other columns as they were when only one changes", async () => {
    const desk = await packDesk()
    const [employee] = recordsOfKind(desk, EMPLOYEE_RECORDS)
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'change-employee')!

    await desk.propose([{ op: 'change-employee', input: { ...exampleInput(desk, operation), iban: null, dependants: '2' } }])
    await desk.accept()

    const [after] = recordsOfKind(desk, EMPLOYEE_RECORDS)
    expect(after).toEqual({ ...employee, dependants: 2 })
  })
})

describe('the plan', () => {
  it('refuses a purchase on a day outside its year', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([{ op: 'plan-purchase', input: { purchase: null, year: 2026, date: '2027-01-02', amount: 100, group: 'computers', name: 'Chair' } }])

    expect(answer).toMatchObject({ isError: true, text: 'date is a day of 2026.' })
  })

  it("replaces the year's owner pay with one scenario, taking the switch row away", async () => {
    const desk = await packDesk()

    await desk.propose([{ op: 'plan-owner-pay', input: { year: 2027, scenario: 'early-exit', switchTo: null, switchOn: null } }])
    await desk.accept()

    const ownerPay = recordsOfKind(desk, PLAN_RECORDS).filter((line) => line.kind === 'owner-pay-scenario')
    expect(ownerPay).toEqual([expect.objectContaining({ year: 2027, scenario: 'early-exit', from: null })])
  })

  it("clears both owner pay rows of a year from either one, as the plan's Clear does", async () => {
    const desk = await packDesk()
    const switched = recordsOfKind(desk, PLAN_RECORDS).find((line) => line.kind === 'owner-pay-scenario' && line.from !== null)!

    await desk.propose([{ op: 'clear-plan', input: { line: desk.ref(PLAN_RECORDS.name, switched.id) } }])

    expect(desk.cards[0]!.count).toBe(2)
  })

  it('refuses a copy of a scenario under a short name another scenario holds', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([{ op: 'copy-scenario', input: { scenario: 'floor-extras', slug: 'early-exit', label: null } }])

    expect(answer).toMatchObject({ isError: true, text: 'early-exit is already the short name of a scenario.' })
  })
})

describe('the editors', () => {
  it("refuses a row the editor's factory refuses, with its reason", async () => {
    const desk = await packDesk()
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'add-asset')!

    const answer = await desk.propose([{ op: 'add-asset', input: { ...exampleInput(desk, operation), bought: 'soon' } }])

    expect(answer.isError).toBe(true)
    expect(desk.cards).toEqual([])
  })

  it("names the asset on the card and shows its cost in the company's money", async () => {
    const desk = await packDesk()
    const operation = PACK_OPERATIONS.find((candidate) => candidate.name === 'add-asset')!

    await desk.propose([{ op: 'add-asset', input: exampleInput(desk, operation) }])

    const [line] = desk.cards[0]!.groups[0]!.lines
    expect(line!.label).toBe('Laptop')
    expect(line!.fields.find((field) => field.name === 'Cost without VAT')?.after).toMatch(/1,500\.00/)
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

    const added = await desk.propose([{ op: 'add-owner-advance', input: { date: '2026-10-10', amount: 10, description: 'Lamp', category: revenue } }])
    const moved = await desk.propose([
      { op: 'change-owner-advance', input: { advance: desk.ref(OWNER_ADVANCE_RECORDS.name, advance!.id), date: null, amount: null, description: null, category: revenue, ownerShare: null } },
    ])

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

    const answer = await desk.propose([{ op: 'delete-grant', input: { row: desk.ref(GRANT_RECORDS.name, 'startup-grant') } }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('"startup-grant" cannot be deleted') })
  })

  it('refuses to rename a scenario the plan picks', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([{ op: 'rename-scenario', input: { scenario: 'floor-salary', slug: 'renamed', label: null } }])

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
      {
        op: 'plan-purchase',
        input: { purchase: desk.ref(PLAN_RECORDS.name, purchase.id), year: purchase.year + 1, date: `${purchase.year + 1}-02-01`, amount: 100, group: 'computers', name: 'Moved' },
      },
    ])

    expect(answer).toMatchObject({ isError: true, text: `That purchase is planned for ${purchase.year}, so year is ${purchase.year}.` })
  })

  it('refuses an amount below zero, as the plan dialog takes zero or more', async () => {
    const desk = await packDesk()

    const answer = await desk.propose([{ op: 'plan-category', input: { category: desk.ref('category', 'ai-services'), year: 2027, month: null, amount: -40 } }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('zero or more') })
  })

  it("shows a category's amount for every month as every month", async () => {
    const desk = await packDesk()

    await desk.propose([{ op: 'plan-category', input: { category: desk.ref('category', 'ai-services'), year: 2027, month: null, amount: 40 } }])

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

    await desk.propose([{ op: 'remove-unreadable-asset', input: { row: 1 } }])

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

    const past = await unreadable.propose([{ op: 'remove-unreadable-asset', input: { row: 2 } }])
    const none = await readable.propose([{ op: 'remove-unreadable-grant', input: { row: 1 } }])

    expect(past).toMatchObject({ isError: true, text: 'row is a whole number from 1 to 1.' })
    expect(none).toMatchObject({ isError: true, text: 'Kuna reads every grant row.' })
  })

  it("leaves an employee's row to the person while Anonymise is on", async () => {
    const desk = await packDesk()
    desk.anonymising = true

    const answer = await desk.propose([{ op: 'remove-unreadable-employee', input: { row: 1 } }])

    expect(answer).toMatchObject({ isError: true, text: expect.stringContaining('turn Anonymise off') })
  })
})
