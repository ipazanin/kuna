import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { INVOICE_ROWS, invoiceCellsOf } from '../src/features/receivables/application/invoiceRows'
import { ACCOUNT_ROWS, ASSET_ROWS, CATEGORY_ROWS, CLIENT_ROWS, GRANT_ROWS, YEAR_END_ROWS } from '../src/features/settings/application/workbookTabRows'
import { rowCellsOf } from '../src/features/workbook/application/tabRowWrites'
import type { TabRowRules } from '../src/features/workbook/application/tabRowWrites'
import { canUndo, wasUndone } from '../src/features/workbook/application/workbookStore'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriter'
import type { RowAt, RowCells } from '../src/features/workbook/domain/rowChanges'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { civil, euros } from './fixtures/ledger'
import { excelHarness, forgetCaches, googleHarness, ruleRow, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { NO_CLIENT_INVOICING } from '../src/features/workbook/domain/workbook'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const ACME_IBAN = 'XX66FAKE0000000099'
const SECOND_ACME_IBAN = 'XX93FAKE0000000098'
const SAVINGS_IBAN = 'XX23FAKE0000000097'

/** The write-back workbook with every tab a person edits: clients, invoices, an advance, assets, a grant, year-end lines and a plan row. */
function everyTab(): Record<string, CellValue[][]> {
  const grids = workbookGrids()
  return {
    ...grids,
    categories: [
      ['category', 'family', 'bucket', 'colour', 'roles', 'label', 'vat'],
      ['equipment', 'operating', 'operating', '#dce9f9', 'capital-purchase', '', 'deductible-25'],
      ['ai-services', 'operating', 'operating', '', '', '', ''],
      ['revenue', 'income', 'income', '', 'revenue', '', ''],
      ['postage', 'operating', 'operating', '', '', '', ''],
      ['printing', 'operating', 'operating', '', '', '', ''],
      ['courier', 'operating', 'operating', '', '', '', ''],
    ],
    clients: [
      ['client', 'name', 'iban'],
      ['acme', 'Acme Studio', ACME_IBAN],
    ],
    invoices: [
      ['number', 'client', 'item', 'amount', 'issued', 'due', 'period_from', 'period_to'],
      ['1-1-26', 'acme', 'September work', 4000, 46295, 46325, 46266, 46295],
    ],
    'outgoing-plan': [
      ['item', 'date', 'amount', 'client', 'description'],
      ['Monthly Fee', 46326, 4000, 'acme', 'Oct 2026'],
    ],
    'owner-advances': [
      ['date', 'amount', 'description', 'category'],
      [46200, 12.5, 'Stamps', 'printing'],
    ],
    assets: [
      ['asset', 'bought', 'in_use', 'cost_net', 'group', 'doubled', 'disposed', 'funded_by', 'ledger_reference', 'note'],
      ['Laptop', 45809, '', 1519.2, 'computers', '', '', 'startup', '', ''],
    ],
    grants: [
      ['grant', 'received', 'amount', 'fixed_part', 'variable_part', 'period_from', 'period_to', 'release', 'clawback_year1', 'clawback_year2', 'employment_required_until', 'note'],
      ['startup', 45915, 5000, 2000, 3000, '', '', 'fixed-then-assets', '', '', '', ''],
      ['innovation', 45915, 1000, 400, 600, '', '', 'fixed-then-assets', '', '', '', ''],
    ],
    'year-end': [
      ['year', 'statement', 'line', 'label', 'amount', 'categories', 'aop', 'source', 'note'],
      [2025, 'pl', 'sales', 'Sales', 46800, '', '', '', ''],
      [2025, 'konto', '41850', 'Software', 435.87, 'ai-services', '', '', ''],
    ],
    plan: [
      ['year', 'month', 'item', 'amount', 'note'],
      [2027, '', 'postage', 10, ''],
    ],
  }
}

function rowOf(store: WorkbookStore, rules: TabRowRules, sheetRow: number): RowAt {
  const row = store.state.snapshot?.[rules.tab].find((candidate) => candidate.sheetRow === sheetRow)
  if (row === undefined) throw new Error(`No row ${sheetRow} on ${rules.tab}`)
  return { sheetRow, cells: rowCellsOf(row, rules.columns) }
}

function add(store: WorkbookStore, rules: TabRowRules, ...added: RowCells[]) {
  return store.changeRows(rules, { added, changed: [], removed: [] })
}

function edit(store: WorkbookStore, rules: TabRowRules, sheetRow: number, cells: RowCells) {
  const { cells: before } = rowOf(store, rules, sheetRow)
  return store.changeRows(rules, { added: [], changed: [{ sheetRow, before, after: { ...before, ...cells } }], removed: [] })
}

function remove(store: WorkbookStore, rules: TabRowRules, sheetRow: number) {
  return store.changeRows(rules, { added: [], changed: [], removed: [rowOf(store, rules, sheetRow)] })
}

const STATIONERY = { category: 'stationery', family: 'operating', bucket: 'operating' }

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('row writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds, changes and deletes categories, and Undo takes each back', async () => {
    const { store } = await harnessOf(used, everyTab())
    const slugs = () => store.state.workbook?.categories.map((category) => category.slug)

    await add(store, CATEGORY_ROWS, STATIONERY)
    await edit(store, CATEGORY_ROWS, 2, { colour: '#ffffff', vat: 'none' })
    await remove(store, CATEGORY_ROWS, 7)

    expect(slugs()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'stationery'])
    expect(store.state.workbook?.categories[0]).toMatchObject({ colour: '#ffffff', vat: 'none' })
    const [removed, changed, added] = store.state.writes
    for (const write of [removed!, changed!, added!]) await store.undo(write)

    expect(slugs()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'courier'])
    expect(store.state.workbook?.categories[0]).toMatchObject({ colour: '#dce9f9', vat: 'deductible-25' })
    expect(store.state.writes.slice(0, 3).map((write) => wasUndone(write, store.state.writes))).toEqual([false, false, false])
    expect(store.state.writes.slice(3).map((write) => [wasUndone(write, store.state.writes), canUndo(write, store.state.writes)])).toEqual([
      [true, false],
      [true, false],
      [true, false],
    ])
    expect(store.state.workbook?.problems).toEqual([])
  })

  it('refuses to rename or delete a category the ledger, the rules, the advances, the year-end or the plan tab names', async () => {
    const { store } = await harnessOf(used, everyTab())

    await expect(edit(store, CATEGORY_ROWS, 2, { category: 'hardware' })).rejects.toThrow('"equipment" cannot be renamed, since it is used by 1 ledger row.')
    await expect(remove(store, CATEGORY_ROWS, 3)).rejects.toThrow('"ai-services" cannot be deleted, since it is used by 1 ledger row, the rule merchant-model and 1 year-end konto row.')
    await expect(remove(store, CATEGORY_ROWS, 5)).rejects.toThrow('"postage" cannot be deleted, since it is used by 1 plan tab row.')
    await expect(edit(store, CATEGORY_ROWS, 6, { category: 'print' })).rejects.toThrow('"printing" cannot be renamed, since it is used by 1 owner advance.')
    expect(store.state.writes).toEqual([])
  })

  it('refuses a category name in use, one outside the slug format, a half-filled row and a bucket the advances cannot count in', async () => {
    const { store } = await harnessOf(used, everyTab())

    await expect(add(store, CATEGORY_ROWS, { ...STATIONERY, category: 'postage' })).rejects.toThrow('"postage" is already a category, on row 5.')
    await expect(add(store, CATEGORY_ROWS, { ...STATIONERY, category: 'Office Supplies' })).rejects.toThrow('is not a category name the app can use')
    await expect(add(store, CATEGORY_ROWS, { category: 'stationery', family: 'operating' })).rejects.toThrow('The new category would be left out: category, family and bucket are not all filled.')
    await expect(edit(store, CATEGORY_ROWS, 2, { vat: 'half' })).rejects.toThrow('Row 2 would read with a problem: vat "half" is not a VAT treatment')
    await expect(edit(store, CATEGORY_ROWS, 6, { bucket: 'income' })).rejects.toThrow('"printing" stays in the operating or taxes bucket, since an owner advance carries it')
    expect(store.state.writes).toEqual([])
  })

  it('adds an account with its IBAN, and refuses a bad IBAN, one already used, a client’s, and deleting an account the ledger names', async () => {
    const { store } = await harnessOf(used, everyTab())

    await add(store, ACCOUNT_ROWS, { account: 'savings', iban: SAVINGS_IBAN })

    expect(store.state.workbook?.accounts.map((account) => [account.slug, account.iban])).toEqual([
      ['main', 'XX00FAKE0000000001'],
      ['savings', SAVINGS_IBAN],
    ])
    await expect(add(store, ACCOUNT_ROWS, { account: 'spare', iban: 'XX24FAKE0000000097' })).rejects.toThrow('"XX24FAKE0000000097" is not a valid IBAN.')
    await expect(add(store, ACCOUNT_ROWS, { account: 'spare', iban: SAVINGS_IBAN })).rejects.toThrow(`${SAVINGS_IBAN} is already the IBAN of the savings account, on row 3`)
    await expect(add(store, ACCOUNT_ROWS, { account: 'spare', iban: ACME_IBAN })).rejects.toThrow(`${ACME_IBAN} is the IBAN of the client acme`)
    await expect(add(store, ACCOUNT_ROWS, { account: 'main', iban: '' })).rejects.toThrow('"main" is already an account, on row 2.')
    await expect(remove(store, ACCOUNT_ROWS, 2)).rejects.toThrow('"main" cannot be deleted, since it is used by 4 ledger rows.')
  })

  it('adds a second IBAN row for a client, and refuses an IBAN on another row or an account, a second name, and deleting a client with invoices', async () => {
    const { store } = await harnessOf(used, everyTab())

    await add(store, CLIENT_ROWS, { client: 'acme', name: '', iban: SECOND_ACME_IBAN })

    expect(store.state.workbook?.clients).toEqual([{ slug: 'acme', name: 'Acme Studio', ibans: [ACME_IBAN, SECOND_ACME_IBAN], invoicing: NO_CLIENT_INVOICING }])
    await expect(add(store, CLIENT_ROWS, { client: 'globex', name: 'Globex', iban: ACME_IBAN })).rejects.toThrow(`${ACME_IBAN} is already on the clients tab for acme, on row 2.`)
    await expect(add(store, CLIENT_ROWS, { client: 'globex', name: 'Globex', iban: 'XX00FAKE0000000001' })).rejects.toThrow('is not a valid IBAN')
    await expect(add(store, CLIENT_ROWS, { client: 'acme', name: 'Acme Ltd', iban: 'XX50FAKE0000000096' })).rejects.toThrow('acme is called "Acme Studio" on row 2.')
    await remove(store, CLIENT_ROWS, 3)
    await expect(remove(store, CLIENT_ROWS, 2)).rejects.toThrow('"acme" cannot be deleted, since it is used by 1 invoice and 1 billing plan row.')
    await expect(edit(store, CLIENT_ROWS, 2, { client: 'acme-studio' })).rejects.toThrow('"acme" cannot be renamed')
  })

  it('adds, changes and deletes an invoice as the generator files it, and refuses a number on the tab or a client not on the clients tab', async () => {
    const { store } = await harnessOf(used, everyTab())
    const october = invoiceCellsOf({
      number: ' 2-1-26 ',
      client: 'Acme',
      item: 'October work',
      amount: euros(4200),
      issued: civil('2026-10-31'),
      due: civil('2026-11-30'),
      periodFrom: civil('2026-10-01'),
      periodTo: civil('2026-10-31'),
    })

    const receipt = await add(store, INVOICE_ROWS, october)

    expect(receipt?.added).toEqual([{ sheetRow: 3, cells: { number: '2-1-26', client: 'acme', item: 'October work', amount: 4200, issued: 46326, due: 46356, period_from: 46296, period_to: 46326 } }])
    expect(store.state.workbook?.invoices.map((invoice) => [invoice.number, invoice.amount, invoice.deliveryPeriod])).toEqual([
      ['1-1-26', euros(4000), { from: '2026-09-01', to: '2026-09-30' }],
      ['2-1-26', euros(4200), { from: '2026-10-01', to: '2026-10-31' }],
    ])
    await expect(add(store, INVOICE_ROWS, { ...october, client: 'globex' })).rejects.toThrow('Invoice 2-1-26 is already on the invoices tab, on row 3, and each number is used once.')
    await expect(add(store, INVOICE_ROWS, { ...october, number: '3-1-26', client: 'globex' })).rejects.toThrow('globex is not on the clients tab')
    await expect(add(store, INVOICE_ROWS, { ...october, number: '3-1-26', period_to: '' })).rejects.toThrow('period_from and period_to go together')
    await expect(add(store, INVOICE_ROWS, { ...october, number: '3-1-26', amount: 0 })).rejects.toThrow('an invoice is for an amount above zero')

    await edit(store, INVOICE_ROWS, 3, { amount: 4300 })
    await remove(store, INVOICE_ROWS, 2)

    expect(store.state.workbook?.invoices.map((invoice) => [invoice.number, invoice.amount])).toEqual([['2-1-26', euros(4300)]])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.invoices.map((invoice) => invoice.number)).toEqual(['2-1-26', '1-1-26'])
  })

  it('adds and changes assets, grants and year-end lines through their readers, and keeps a grant an asset is funded by', async () => {
    const { store } = await harnessOf(used, everyTab())

    await add(store, ASSET_ROWS, { asset: 'Monitor', bought: 46296, cost_net: 420, group: 'computers', funded_by: 'innovation' })
    await edit(store, GRANT_ROWS, 2, { note: 'Regional start-up grant' })
    await add(store, YEAR_END_ROWS, { year: 2025, statement: 'pl', line: 'material-costs', amount: 6242.17 })

    expect(store.state.workbook?.assets.map((asset) => [asset.name, asset.fundedBy])).toEqual([
      ['Laptop', 'startup'],
      ['Monitor', 'innovation'],
    ])
    expect(store.state.workbook?.grants[0]?.note).toBe('Regional start-up grant')
    expect(store.state.workbook?.yearEndLines).toHaveLength(3)
    await expect(remove(store, GRANT_ROWS, 2)).rejects.toThrow('"startup" cannot be deleted, since it is used by 1 asset.')
    await expect(edit(store, GRANT_ROWS, 3, { grant: 'innovation-2026' })).rejects.toThrow('"innovation" cannot be renamed, since it is used by 1 asset.')
    await expect(add(store, ASSET_ROWS, { asset: 'Laptop', bought: 46296, cost_net: 420, group: 'computers' })).rejects.toThrow('The new asset would be left out: "Laptop" is already listed above.')
    await expect(add(store, ASSET_ROWS, { asset: 'Desk', bought: 46296, cost_net: 300, group: 'furniture' })).rejects.toThrow('"furniture" is not a group')
    await expect(add(store, ASSET_ROWS, { asset: 'Desk', bought: 46296, cost_net: 300, group: 'equipment', funded_by: 'lottery' })).rejects.toThrow('lottery is not on the grants tab')
    await expect(add(store, YEAR_END_ROWS, { year: 2025, statement: 'konto', line: '41200', amount: 82.04, categories: 'phones' })).rejects.toThrow('"phones" is not on the categories tab')
    await remove(store, ASSET_ROWS, 3)
    await remove(store, GRANT_ROWS, 3)
    expect(store.state.workbook?.grants.map((grant) => grant.slug)).toEqual(['startup'])
  })

  it('refuses a change to a row that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used, everyTab())
    const stale = rowOf(store, ACCOUNT_ROWS, 2)

    await edit(store, ACCOUNT_ROWS, 2, { iban: SAVINGS_IBAN })

    await expect(
      store.changeRows(ACCOUNT_ROWS, { added: [], changed: [{ sheetRow: 2, before: stale.cells, after: { ...stale.cells, iban: 'XX50FAKE0000000096' } }], removed: [] }),
    ).rejects.toThrow('The account "main" is no longer on the accounts tab as the app read it.')
  })
})

describe('row writes to a Google Sheet', () => {
  it('writes only the cells that changed, RAW, by header, and appends a new category under every header', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, everyTab())

    await edit(store, CATEGORY_ROWS, 2, { colour: '#ffffff' })
    await add(store, CATEGORY_ROWS, STATIONERY)

    expect(writtenRanges()).toEqual(['categories!D2'])
    expect(sheets.requests.filter((request) => request.kind === 'batchUpdate').map((request) => request.kind === 'batchUpdate' && request.request.valueInputOption)).toEqual(['RAW'])
    expect(sheets.requests.find((request) => request.kind === 'append')).toEqual({
      kind: 'append',
      range: 'categories!A:G',
      request: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', values: [['stationery', 'operating', 'operating', '', '', '', '']] },
    })
    expect(sheets.requests.some((request) => request.kind === 'batchUpdate' && request.request.data.some((write) => write.range.startsWith('ledger!')))).toBe(false)
  })

  it('appends an invoice in the eight columns, the number as text and every date a serial number, and deletes one by clearing its cells', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, everyTab())

    await add(store, INVOICE_ROWS, { number: '2-1-26', client: 'acme', item: 'October work', amount: 4200, issued: 46326, due: '', period_from: '', period_to: '' })
    await remove(store, INVOICE_ROWS, 2)

    expect(sheets.requests.find((request) => request.kind === 'append')).toEqual({
      kind: 'append',
      range: 'invoices!A:H',
      request: { valueInputOption: 'RAW', insertDataOption: 'INSERT_ROWS', values: [['2-1-26', 'acme', 'October work', 4200, 46326, '', '', '']] },
    })
    expect(writtenRanges()).toEqual(['invoices!A2', 'invoices!B2', 'invoices!C2', 'invoices!D2', 'invoices!E2', 'invoices!F2', 'invoices!G2', 'invoices!H2'])
    expect(sheets.grids.invoices).toHaveLength(3)
  })

  it('leaves a formula cell alone when the change does not touch it', async () => {
    const grids = everyTab()
    grids.assets![1]![3] = 1519.199999
    const { store, writtenRanges } = await googleHarness(used, grids)

    await edit(store, ASSET_ROWS, 2, { note: 'Kept in the office' })

    expect(writtenRanges()).toEqual(['assets!J2'])
  })

  it('refuses a category label on a Sheet whose categories tab has no label column, and an invoices tab without the generator’s eight columns', async () => {
    const grids = everyTab()
    const { store, sheets } = await googleHarness(used, { ...grids, categories: grids.categories!.map((row) => row.slice(0, 5)) })
    sheets.grids.invoices = sheets.grids.invoices!.map((row) => row.slice(0, 6))

    await expect(add(store, CATEGORY_ROWS, { ...STATIONERY, label: 'Paper and pens' })).rejects.toThrow('The categories tab has no "label" column for what this change writes.')
    await expect(add(store, INVOICE_ROWS, { number: '2-1-26', client: 'acme', amount: 4200, issued: 46326 })).rejects.toThrow('The invoices tab has no "period_from", "period_to" column')
    await add(store, CATEGORY_ROWS, STATIONERY)
    expect(store.state.workbook?.categories.map((category) => category.slug)).toContain('stationery')
  })

  it('refuses to leave the accounts tab without an IBAN, which the morning run needs', async () => {
    const grids = everyTab()
    const { store } = await googleHarness(used, { ...grids, ledger: [grids.ledger![0]!], rules: [grids.rules![0]!] })

    await expect(edit(store, ACCOUNT_ROWS, 2, { iban: '' })).rejects.toThrow('The accounts tab would name no IBAN')
    await expect(remove(store, ACCOUNT_ROWS, 2)).rejects.toThrow(WorkbookWriteRefused)
  })

  it('keeps a rule that names a category valid, as the Apps Script reads it', async () => {
    const grids = everyTab()
    const { store } = await googleHarness(used, { ...grids, rules: [...grids.rules!, ruleRow({ rule: 'review-postage', order: 200, enabled: false, category: 'postage', confidence: 'rule' })] })

    await expect(remove(store, CATEGORY_ROWS, 5)).rejects.toThrow('the rule review-postage')
  })
})
