import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { BILLING_WRITES } from '../src/features/billingPlan/application/billingWrites'
import { LEDGER_WRITES } from '../src/features/imports/application/ledgerWrites'
import { installedPack } from '../src/features/packs/packContribution'
import { INVOICE_WRITES } from '../src/features/receivables/application/invoiceWrites'
import { DISMISSAL_WRITES } from '../src/features/review/application/dismissalWrites'
import { RULE_WRITES } from '../src/features/rules/application/ruleWrites'
import { SETTING_WRITES } from '../src/features/settings/application/settingWrites'
import { ACCOUNT_WRITES, CATEGORY_WRITES, CLIENT_WRITES } from '../src/features/settings/application/namedRecordWrites'
import { SPLIT_WRITES } from '../src/features/transactions/application/splitWrites'
import { canUndo } from '../src/features/workbook/application/createWorkbookStore'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import { CATEGORY_RECORDS, CLIENT_RECORDS, INVOICE_RECORDS } from '../src/features/workbook/domain/recordKind'
import type { WriteRules } from '../src/features/workbook/domain/writeRules'
import { spreadsheetTabOfKind } from '../src/features/workbook/infrastructure/spreadsheetTab'
import type { Cells } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { WORKBOOK_TABS } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, SheetRow, WorkbookSnapshot, WorkbookTab, WorkbookTabs } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { templateColumnNames } from '../src/features/workbook/infrastructure/workbookTemplate'
import { idOfCells, recordOf, recordOnScreen, recordsOnScreen } from './fixtures/records'
import { excelHarness, forgetCaches, googleHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

/** A storage under test, started empty with every kind's header, and a way to play an edit made outside the app. */
interface StorageUnderTest {
  readonly store: WorkbookStore<WorkbookSnapshot>
  /** Puts a row in at the top of the tab, above every row the app wrote. */
  insertAbove(tab: WorkbookTab, cells: Cells): Promise<void>
  /** Sets a cell of the one row the test picks. */
  setCell(tab: WorkbookTab, holds: (cells: Cells) => boolean, column: string, value: CellValue): Promise<void>
  deleteRow(tab: WorkbookTab, holds: (cells: Cells) => boolean): Promise<void>
  /** Everything the storage holds, to show that a refused write left it alone. */
  held(): string
}

/** Every tab with its template header and the seed rows given, values from row 1. */
function gridsOf(seed: Readonly<Partial<Record<WorkbookTab, readonly Cells[]>>>): Record<string, CellValue[][]> {
  return Object.fromEntries(
    WORKBOOK_TABS.map((tab) => {
      const header = templateColumnNames(tab)
      return [tab, [header, ...(seed[tab] ?? []).map((cells) => header.map((column) => cells[column] ?? ''))]]
    }),
  )
}

async function googleStorage(seed: Readonly<Partial<Record<WorkbookTab, readonly Cells[]>>>): Promise<StorageUnderTest> {
  const { store, sheets } = await googleHarness(used, gridsOf(seed))
  const rowIndex = (tab: WorkbookTab, holds: (cells: Cells) => boolean): number => {
    const [header = [], ...rows] = sheets.grids[tab]!
    const index = rows.findIndex((row) => holds(Object.fromEntries(header.map((column, at) => [String(column), row[at] ?? '']))))
    expect(index).toBeGreaterThanOrEqual(0)
    return index + 1
  }
  return {
    store,
    async insertAbove(tab, cells) {
      sheets.grids[tab]!.splice(1, 0, templateColumnNames(tab).map((column) => cells[column] ?? ''))
      await store.sync()
    },
    async setCell(tab, holds, column, value) {
      sheets.grids[tab]![rowIndex(tab, holds)]![templateColumnNames(tab).indexOf(column)] = value
      await store.sync()
    },
    async deleteRow(tab, holds) {
      sheets.grids[tab]!.splice(rowIndex(tab, holds), 1)
      await store.sync()
    },
    held: () => JSON.stringify(sheets.grids),
  }
}

async function browserStorage(seed: Readonly<Partial<Record<WorkbookTab, readonly Cells[]>>>): Promise<StorageUnderTest> {
  const { store } = await excelHarness(used, gridsOf(seed))
  /** Another tab of the app, or an import, leaving the workbook kept in this browser with these rows. */
  const replaceRows = async (tab: WorkbookTab, rowsOf: (rows: readonly SheetRow[]) => SheetRow[]): Promise<void> => {
    const { meta: _meta, ...tabs } = store.state.snapshot!
    const rows = rowsOf(tabs[tab]).map((row, index) => ({ sheetRow: index + 2, cells: row.cells }))
    await store.replaceLocalWorkbook({ ...(tabs as WorkbookTabs), [tab]: rows }, 'Books')
  }
  const filled = (cells: Cells): Cells => Object.fromEntries(Object.entries(cells).filter(([, cell]) => cell !== ''))
  return {
    store,
    insertAbove: (tab, cells) => replaceRows(tab, (rows) => [{ sheetRow: 2, cells: filled(cells) }, ...rows]),
    setCell: (tab, holds, column, value) =>
      replaceRows(tab, (rows) => {
        expect(rows.filter((row) => holds(row.cells))).toHaveLength(1)
        return rows.map((row) => (holds(row.cells) ? { sheetRow: row.sheetRow, cells: filled({ ...row.cells, [column]: value }) } : row))
      }),
    deleteRow: (tab, holds) => replaceRows(tab, (rows) => rows.filter((row) => !holds(row.cells))),
    held: () => {
      const { meta: _meta, ...tabs } = store.state.snapshot!
      return JSON.stringify(tabs)
    },
  }
}

/**
 * One kind's records for the suite: two valid records the app adds, one added from outside, a
 * change to the first, an optional field of the first that a change clears, and a row the domain
 * refuses with what fixes it. Rules and settings rows are never refused by their factory.
 */
interface KindFixture {
  readonly records: readonly [Cells, Cells]
  readonly outside: Cells
  readonly change: { readonly column: string; readonly value: CellValue }
  readonly cleared: string
  readonly refused: { readonly cells: Cells; readonly reason: string; readonly fixed: Cells; readonly beside?: readonly Cells[] } | null
  /** Records of other kinds the checks need, by tab. */
  readonly seed?: Readonly<Partial<Record<WorkbookTab, readonly Cells[]>>>
}

const CATEGORIES = [
  { category: 'groceries', family: 'operating', bucket: 'operating' },
  { category: 'telecom', family: 'operating', bucket: 'operating' },
  { category: 'office-supplies', family: 'operating', bucket: 'operating' },
  { category: 'ai-services', family: 'operating', bucket: 'operating' },
]
const CLIENTS = [{ client: 'northwind', iban: 'GB82WEST12345698765432' }]
const ids = (prefix: string, count: number): string[] => Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-0000${prefix}${String(index + 1).padStart(6, '0')}`)
const [BILLING_A, BILLING_B, BILLING_C, BILLING_R] = ids('01', 4)
const [SPLIT_A, SPLIT_B, SPLIT_C, SPLIT_R] = ids('02', 4)
const [DISMISSAL_A, DISMISSAL_B, DISMISSAL_C, DISMISSAL_R] = ids('03', 4)
const [ADVANCE_A, ADVANCE_B, ADVANCE_C, ADVANCE_R] = ids('04', 4)
const [ASSET_A, ASSET_B, ASSET_C, ASSET_R] = ids('05', 4)
const [YEAR_END_A, YEAR_END_B, YEAR_END_C, YEAR_END_R] = ids('06', 4)
const [PLAN_A, PLAN_B, PLAN_C, PLAN_R] = ids('07', 4)
const SPLIT_ROW = { date: 46300, account: 'main', row_amount: -10, row_balance: 90 }

const FIXTURES: Readonly<Record<string, KindFixture>> = {
  'ledger-row': {
    seed: { categories: CATEGORIES },
    records: [
      { date: 46300, account: 'main', statement: 's-1', counterparty: 'Corner Shop', description: 'Card purchase', amount: -12.5, balance: 987.5, category: 'groceries', flagged_by: 'ai', reference: '00123' },
      { date: 46300, account: 'spare', statement: 's-2', counterparty: 'Bank', description: 'Fee', amount: -1, balance: 99, category: 'telecom', flagged_by: 'rule', reference: 'R-B' },
    ],
    outside: { date: 46301, account: 'other', description: 'Deposit', amount: 5, balance: 5, reference: 'R-C' },
    change: { column: 'flagged_by', value: 'ivan' },
    cleared: 'flagged_by',
    refused: {
      cells: { date: 'yesterday', account: 'third', amount: -3, balance: 7, category: 'groceries', reference: 'R-X' },
      reason: 'is not a date cell',
      fixed: { date: 46302, account: 'third', amount: -3, balance: 7, category: 'groceries', reference: 'R-X' },
    },
  },
  category: {
    records: [
      { category: 'groceries', family: 'operating', bucket: 'operating', colour: '#aabbcc', roles: 'watched', label: 'Groceries', vat: 'deductible-25' },
      { category: 'rent', family: 'operating', bucket: 'operating' },
    ],
    outside: { category: 'travel', family: 'operating', bucket: 'operating' },
    change: { column: 'family', value: 'office' },
    cleared: 'colour',
    refused: { cells: { category: 'misc', family: 'operating', bucket: 'operatng' }, reason: '"operatng" is not a bucket', fixed: { category: 'misc', family: 'operating', bucket: 'operating' } },
  },
  account: {
    records: [
      { account: 'main', iban: 'GB82WEST12345698765432', currency: 'EUR', label: 'Main' },
      { account: 'spare', iban: 'DE89370400440532013000' },
    ],
    outside: { account: 'other', iban: 'GB33BUKB20201555555555' },
    change: { column: 'label', value: 'Main account' },
    cleared: 'label',
    refused: { cells: { iban: 'FR1420041010050500013M02606' }, reason: 'no account name', fixed: { account: 'third', iban: 'FR1420041010050500013M02606' } },
  },
  'client-iban': {
    records: [
      { client: 'northwind', name: 'Northwind', iban: 'GB82WEST12345698765432', address: '1 Example Road', mail_language: 'en', reverse_charge: true },
      { client: 'lumen', iban: 'DE89370400440532013000' },
    ],
    outside: { client: 'acme', iban: 'GB33BUKB20201555555555' },
    change: { column: 'name', value: 'Northwind Analytics' },
    cleared: 'address',
    refused: { cells: { client: 'nobank' }, reason: 'no IBAN', fixed: { client: 'nobank', iban: 'FR1420041010050500013M02606' } },
  },
  invoice: {
    seed: { clients: CLIENTS },
    records: [
      { number: '0042', client: 'northwind', item: 'Work', amount: 1200.5, issued: 46300, due: 46330, period_from: 46270, period_to: 46299 },
      { number: '2-1-26', client: 'northwind', amount: 300, issued: 46301 },
    ],
    outside: { number: '3-1-26', client: 'northwind', amount: 10, issued: 46302 },
    change: { column: 'item', value: 'Work, revised' },
    cleared: 'due',
    refused: { cells: { number: '4-1-26', client: 'northwind', amount: 'lots', issued: 46303 }, reason: 'is not a number', fixed: { number: '4-1-26', client: 'northwind', amount: 50, issued: 46303 } },
  },
  'billing-item': {
    seed: { clients: CLIENTS },
    records: [
      { item: 'Monthly Fee', date: 46300, amount: 100, client: 'northwind', description: 'Fee', id: BILLING_A! },
      { item: 'Bonus', date: 46301, amount: 50, client: 'northwind', id: BILLING_B! },
    ],
    outside: { item: 'Hotel', date: 46302, amount: 80, client: 'northwind', id: BILLING_C! },
    change: { column: 'description', value: 'October fee' },
    cleared: 'description',
    refused: {
      cells: { item: 'Extra', date: 46303, amount: -5, client: 'northwind', id: BILLING_R! },
      reason: 'must be more than zero',
      fixed: { item: 'Extra', date: 46303, amount: 5, client: 'northwind', id: BILLING_R! },
    },
  },
  'split-part': {
    seed: { categories: CATEGORIES, ledger: [{ date: 46300, account: 'main', description: 'Card purchase', amount: -10, balance: 90, category: 'groceries', reference: 'R-S' }] },
    records: [
      { ...SPLIT_ROW, amount: -6, category: 'groceries', note: 'Food', id: SPLIT_A! },
      { ...SPLIT_ROW, amount: -4, category: 'telecom', id: SPLIT_B! },
    ],
    outside: { date: 46200, account: 'main', row_amount: -3, row_balance: 50, amount: -3, category: 'telecom', id: SPLIT_C! },
    change: { column: 'note', value: 'Food and drink' },
    cleared: 'note',
    refused: {
      cells: { ...SPLIT_ROW, amount: 'six', category: 'groceries', id: SPLIT_R! },
      reason: 'is not a number',
      fixed: { ...SPLIT_ROW, amount: -6, category: 'groceries', id: SPLIT_R! },
      beside: [{ ...SPLIT_ROW, amount: -4, category: 'telecom', id: SPLIT_B! }],
    },
  },
  dismissal: {
    records: [
      { kind: 'not-covered', key: 'name:corner shop', category: 'groceries', dismissed_on: 46300, id: DISMISSAL_A! },
      { kind: 'exception', key: 'name:bank|bank-fees', id: DISMISSAL_B! },
    ],
    outside: { kind: 'not-covered', key: 'name:kiosk', id: DISMISSAL_C! },
    change: { column: 'category', value: 'telecom' },
    cleared: 'dismissed_on',
    refused: { cells: { kind: 'maybe', key: 'name:x', id: DISMISSAL_R! }, reason: 'is not a kind of suggestion', fixed: { kind: 'not-covered', key: 'name:x', id: DISMISSAL_R! } },
  },
  setting: {
    records: [
      { key: 'review_label', value: 'tester' },
      { key: 'invoice_place', value: 'Testtown' },
    ],
    outside: { key: 'invoice_country', value: 'Testland' },
    change: { column: 'value', value: 'reviewer' },
    cleared: 'value',
    refused: null,
  },
  rule: {
    records: [
      { rule: 'shop', order: 100, enabled: true, counterparty_contains: 'SHOP', confidence: 'review', note: 'Shops' },
      { rule: 'bank', order: 200, enabled: false, confidence: 'review' },
    ],
    outside: { rule: 'other', order: 300, enabled: true, description_contains: 'X', confidence: 'review' },
    change: { column: 'note', value: 'Corner shops' },
    cleared: 'note',
    refused: null,
  },
  'owner-advance': {
    seed: { categories: CATEGORIES },
    records: [
      { date: 46300, amount: 12.5, description: 'Pens', category: 'office-supplies', id: ADVANCE_A! },
      { date: 46301, amount: 3, category: 'office-supplies', id: ADVANCE_B! },
    ],
    outside: { date: 46302, amount: 7, category: 'telecom', id: ADVANCE_C! },
    change: { column: 'description', value: 'Pens and paper' },
    cleared: 'description',
    refused: {
      cells: { date: 46302, amount: -4, category: 'office-supplies', id: ADVANCE_R! },
      reason: 'belongs on the splits tab',
      fixed: { date: 46302, amount: 4, category: 'office-supplies', id: ADVANCE_R! },
    },
  },
  asset: {
    records: [
      { asset: 'Laptop', bought: 46300, in_use: 46302, cost_net: 1500.75, group: 'computers', doubled: true, ledger_reference: 'REF-1', note: 'Work laptop', id: ASSET_A! },
      { asset: 'Desk', bought: 46301, cost_net: 200, group: 'equipment', id: ASSET_B! },
    ],
    outside: { asset: 'Lamp', bought: 46302, cost_net: 40, group: 'equipment', id: ASSET_C! },
    change: { column: 'note', value: 'Laptop for work' },
    cleared: 'note',
    refused: {
      cells: { asset: 'Chair', bought: 46301, cost_net: 100, group: 'sofa', id: ASSET_R! },
      reason: '"sofa" is not a group',
      fixed: { asset: 'Chair', bought: 46301, cost_net: 100, group: 'equipment', id: ASSET_R! },
    },
  },
  grant: {
    records: [
      {
        grant: 'start-grant',
        received: 46300,
        amount: 1000,
        fixed_part: 400,
        variable_part: 600,
        period_from: 46300,
        period_to: 46664,
        release: 'fixed-then-assets',
        clawback_year1: 'whole',
        clawback_year2: 250,
        employment_required_until: 46664,
        note: 'Start-up grant',
      },
      { grant: 'second-grant', received: 46301, amount: 500, release: 'straight-line', period_from: 46301, period_to: 46665 },
    ],
    outside: { grant: 'third-grant', received: 46302, amount: 100, fixed_part: 100, variable_part: 0 },
    change: { column: 'note', value: 'Regional start-up grant' },
    cleared: 'note',
    refused: {
      cells: { grant: 'bad-grant', received: 46300, amount: 100, fixed_part: 30, variable_part: 30 },
      reason: 'add up to',
      fixed: { grant: 'bad-grant', received: 46300, amount: 100, fixed_part: 30, variable_part: 70 },
    },
  },
  'year-end-line': {
    records: [
      { year: 2025, statement: 'pl', line: 'sales', label: 'Sales', amount: 57000.5, source: 'package.pdf', note: 'As filed', id: YEAR_END_A! },
      { year: 2025, statement: 'pl', line: 'other-operating-income', amount: 2050, id: YEAR_END_B! },
    ],
    outside: { year: 2025, statement: 'pl', line: 'financial-income', amount: 0.04, id: YEAR_END_C! },
    change: { column: 'label', value: 'Sales revenue' },
    cleared: 'note',
    refused: {
      cells: { year: 2024, statement: 'pl', line: 'nonsense', amount: 1, id: YEAR_END_R! },
      reason: 'is not a line of pl',
      fixed: { year: 2024, statement: 'pl', line: 'sales', amount: 1, id: YEAR_END_R! },
    },
  },
  'plan-line': {
    seed: { categories: CATEGORIES },
    records: [
      { year: 2027, month: 5, item: 'ai-services', amount: 20, note: 'Seats', id: PLAN_A! },
      { year: 2027, item: 'purchase', amount: 420, note: 'Monitor', date: 46400, group: 'equipment', id: PLAN_B! },
    ],
    outside: { year: 2027, month: 7, item: 'telecom', amount: 15, id: PLAN_C! },
    change: { column: 'note', value: 'More seats' },
    cleared: 'note',
    refused: {
      cells: { year: 2027, month: 13, item: 'ai-services', amount: 5, id: PLAN_R! },
      reason: 'is not a month',
      fixed: { year: 2027, month: 6, item: 'ai-services', amount: 5, id: PLAN_R! },
    },
  },
  'scenario-component': {
    records: [
      { scenario: 'base', label: 'Base', year: 2027, component: 'salary_gross', amount: 'floor' },
      { scenario: 'base', year: 2027, component: 'dividend', amount: 'max' },
    ],
    outside: { scenario: 'other', label: 'Other', year: 2027, component: 'salary_gross', amount: 'floor' },
    change: { column: 'label', value: 'Base pay' },
    cleared: 'label',
    refused: {
      cells: { scenario: 'third', year: 2027, component: 'salary_gross', amount: 'floor', from: 46000 },
      reason: 'is outside 2027',
      fixed: { scenario: 'third', year: 2027, component: 'salary_gross', amount: 'floor', from: 46400 },
    },
  },
}

const CORE_WRITES: readonly WriteRules<unknown>[] = [
  LEDGER_WRITES,
  CATEGORY_WRITES,
  ACCOUNT_WRITES,
  CLIENT_WRITES,
  INVOICE_WRITES,
  BILLING_WRITES,
  SPLIT_WRITES,
  DISMISSAL_WRITES,
  SETTING_WRITES,
  RULE_WRITES,
]

const KINDS = [...CORE_WRITES, ...installedPack().workbook!.kinds].map((rules) => [rules.kind.name, rules] as const)

const STORAGES = [
  ['a Google Sheet', googleStorage],
  ['the workbook kept in this browser', browserStorage],
] as const

it('has a fixture for every kind, core’s and the pack’s', () => {
  expect(KINDS.map(([name]) => name).filter((name) => FIXTURES[name] === undefined)).toEqual([])
  expect(KINDS).toHaveLength(16)
})

describe.each(STORAGES)('records kept in %s', (_storage, open) => {
  describe.each(KINDS)('of the kind %s', (name, rules) => {
    const fixture = FIXTURES[name]!
    const { kind } = rules
    const { tab } = spreadsheetTabOfKind(kind)
    const [first, second] = fixture.records
    const firstId = idOfCells(kind, first)
    const holdsFirst = (cells: Cells): boolean => idOfCells(kind, cells) === firstId

    async function withBoth(): Promise<StorageUnderTest> {
      const storage = await open(fixture.seed ?? {})
      await storage.store.write('Added', (unit) => fixture.records.forEach((cells) => unit.of(rules).add(recordOf(kind, cells))), { addMissingKinds: true })
      return storage
    }

    it('reads a record back as written, field by field, and a cleared field reads blank', async () => {
      const { store } = await withBoth()

      for (const cells of fixture.records) {
        expect(recordOnScreen(store, kind, idOfCells(kind, cells)).record).toEqual(recordOf(kind, cells))
      }
      const cleared = { ...first, [fixture.cleared]: '' }
      await store.write('Cleared', (unit) => unit.of(rules).change(recordOnScreen(store, kind, firstId).record, recordOf(kind, cleared)))
      expect(recordOnScreen(store, kind, firstId).record).toEqual(recordOf(kind, cleared))
      expect(recordOnScreen(store, kind, firstId).fields[fixture.cleared]).toBeUndefined()
    })

    it('finds the records it changes and removes by identity, after a row was added above them from outside', async () => {
      const storage = await withBoth()
      const { store } = storage
      await storage.insertAbove(tab, fixture.outside)

      const changed = { ...first, [fixture.change.column]: fixture.change.value }
      await store.write('Changed', (unit) => unit.of(rules).change(recordOnScreen(store, kind, firstId).record, recordOf(kind, changed)))
      expect(recordOnScreen(store, kind, firstId).record).toEqual(recordOf(kind, changed))

      const both = fixture.records.map((cells) => recordOnScreen(store, kind, idOfCells(kind, cells)).record)
      await store.write('Removed', (unit) => both.forEach((record) => unit.of(rules).remove(record)))
      expect(recordsOnScreen(store, kind).records.map((stored) => stored.id)).toEqual([idOfCells(kind, fixture.outside)])
    })

    it('refuses a change to a record that differs from what the app read, or is gone, and writes nothing', async () => {
      const storage = await withBoth()
      const { store } = storage
      const stale = recordOnScreen(store, kind, firstId).record
      const changed = recordOf(kind, { ...first, [fixture.change.column]: fixture.change.value })
      await storage.setCell(tab, holdsFirst, fixture.change.column, 'edited outside')
      const held = storage.held()

      await expect(store.write('Changed', (unit) => unit.of(rules).change(stale, changed))).rejects.toThrow('changed since the app read it')
      expect(storage.held()).toBe(held)

      await storage.deleteRow(tab, holdsFirst)
      const gone = storage.held()
      await expect(store.write('Changed', (unit) => unit.of(rules).change(stale, changed))).rejects.toThrow(WorkbookWriteRefused)
      await expect(store.write('Removed', (unit) => unit.of(rules).remove(stale))).rejects.toThrow('is no longer in the workbook')
      expect(storage.held()).toBe(gone)
      expect(recordsOnScreen(store, kind).records.map((stored) => stored.id)).toEqual([idOfCells(kind, second)])
    })

    it.skipIf(fixture.refused === null)(
      rules.changeable === undefined ? 'reads a refused row with its fields and reason, and stores it repaired as a valid record' : 'reads a refused row with its fields and reason, and leaves its repair to the workbook',
      async () => {
        const refused = fixture.refused!
        const storage = await open(fixture.seed ?? {})
        for (const cells of [...(refused.beside ?? []), refused.cells]) {
          await storage.insertAbove(tab, cells)
        }
        const { store } = storage
        const [held] = recordsOnScreen(store, kind).refused

        expect(held?.reason).toContain(refused.reason)
        expect(Object.fromEntries(Object.entries(held!.fields).map(([field, stored]) => [field, stored.text]))).toEqual(
          Object.fromEntries(Object.entries(refused.cells).map(([field, cell]) => [field, String(cell)])),
        )
        const repair = store.write('Repaired', (unit) => unit.of(rules).repair(held!, recordOf(kind, refused.fixed)))
        if (rules.changeable !== undefined) {
          await expect(repair).rejects.toThrow('is fixed in the workbook itself')
          return
        }
        await repair
        expect(recordsOnScreen(store, kind).refused).toEqual([])
        expect(recordOnScreen(store, kind, idOfCells(kind, refused.fixed)).record).toEqual(recordOf(kind, refused.fixed))
      },
    )

    it.skipIf(fixture.refused === null || rules.changeable !== undefined)('takes a refused row out, and keeps no Undo of it', async () => {
      const refused = fixture.refused!
      const storage = await withBoth()
      for (const cells of [...(refused.beside ?? []), refused.cells]) {
        await storage.insertAbove(tab, cells)
      }
      const { store } = storage
      const held = recordsOnScreen(store, kind).refused.find((candidate) => candidate.reason.includes(refused.reason))

      await store.write('Discarded', (unit) => unit.of(rules).discard(held!))

      expect(recordsOnScreen(store, kind).refused.filter((candidate) => candidate.reason.includes(refused.reason))).toEqual([])
      expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(false)
    })

    it(rules.undoable ? 'brings removed records back with the same identity on Undo' : 'keeps no Undo', async () => {
      const storage = await withBoth()
      const { store } = storage
      await storage.insertAbove(tab, fixture.outside)
      const both = fixture.records.map((cells) => recordOnScreen(store, kind, idOfCells(kind, cells)).record)
      await store.write('Removed', (unit) => both.forEach((record) => unit.of(rules).remove(record)))
      const [removed] = store.state.writes

      expect(canUndo(removed!, store.state.writes)).toBe(rules.undoable)
      if (!rules.undoable) {
        await expect(store.undo(removed!)).rejects.toThrow('cannot be undone')
        return
      }
      await store.undo(removed!)
      expect(fixture.records.map((cells) => recordOnScreen(store, kind, idOfCells(kind, cells)).record)).toEqual(both)
      await expect(store.undo(removed!)).rejects.toThrow('cannot be undone')
    })
  })

  describe('a write across two kinds', () => {
    const category = { category: 'groceries', family: 'operating', bucket: 'operating' }
    const client = { client: 'northwind', iban: 'GB82WEST12345698765432' }

    it('applies whole', async () => {
      const storage = await open({})
      const { store } = storage

      await store.write('Added', (unit) => {
        unit.of(CATEGORY_WRITES).add(recordOf(CATEGORY_RECORDS, category))
        unit.of(CLIENT_WRITES).add(recordOf(CLIENT_RECORDS, client))
      })

      expect(store.state.workbook!.categories.map((held) => held.slug)).toEqual(['groceries'])
      expect(store.state.workbook!.clients.map((held) => held.slug)).toEqual(['northwind'])
      expect(store.state.writes).toHaveLength(1)
    })

    it('or not at all, when one kind refuses its part', async () => {
      const storage = await open({})
      const { store } = storage
      const held = storage.held()

      await expect(
        store.write('Added', (unit) => {
          unit.of(CATEGORY_WRITES).add(recordOf(CATEGORY_RECORDS, category))
          unit.of(INVOICE_WRITES).add(recordOf(INVOICE_RECORDS, { number: '1-1-26', client: 'nobody', amount: 10, issued: 46300 }))
        }),
      ).rejects.toThrow('nobody is not on the clients tab')

      expect(storage.held()).toBe(held)
      expect(store.state.workbook!.categories).toEqual([])
      expect(store.state.writes).toEqual([])
    })
  })
})
