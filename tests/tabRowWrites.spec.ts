import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { INVOICE_WRITES } from '../src/features/receivables/application/invoiceWrites'
import { ACCOUNT_WRITES, CATEGORY_WRITES, CLIENT_WRITES } from '../src/features/settings/application/namedRecordWrites'
import { ASSET_WRITES, GRANT_WRITES, YEAR_END_WRITES } from '../src/packs/hr-doo/domain/hrDooWrites'
import { canUndo, wasUndone } from '../src/features/workbook/application/createWorkbookStore'
import { ACCOUNT_RECORDS } from '../src/features/workbook/domain/recordKind'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { euros } from './fixtures/ledger'
import { addRows as add, cellsOf, editRow as edit, recordOnRow, removeRows as remove, writeRows } from './fixtures/recordWrites'
import { withIds } from './fixtures/rowIds'
import { cellData, dateFormat, excelHarness, forgetCaches, googleHarness, ruleRow, sentRequests, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { NO_CLIENT_INVOICING } from '../src/features/workbook/domain/workbook'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'
import { GRANT_RECORDS } from '../src/packs/hr-doo/domain/hrDooKinds'
import { cellsOfRecord } from '../src/features/workbook/infrastructure/spreadsheetTab'
import { GRANTS_TAB } from '../src/packs/hr-doo/infrastructure/hrDooTabs'

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
    'outgoing-plan': withIds('item', [
      ['item', 'date', 'amount', 'client', 'description'],
      ['Monthly Fee', 46326, 4000, 'acme', 'Oct 2026'],
    ]),
    'owner-advances': withIds('advance', [
      ['date', 'amount', 'description', 'category'],
      [46200, 12.5, 'Stamps', 'printing'],
    ]),
    assets: withIds('asset', [
      ['asset', 'bought', 'in_use', 'cost_net', 'group', 'doubled', 'disposed', 'funded_by', 'ledger_reference', 'note'],
      ['Laptop', 45809, '', 1519.2, 'computers', '', '', 'startup', '', ''],
    ]),
    grants: [
      ['grant', 'received', 'amount', 'fixed_part', 'variable_part', 'period_from', 'period_to', 'release', 'clawback_year1', 'clawback_year2', 'employment_required_until', 'note'],
      ['startup', 45915, 5000, 2000, 3000, '', '', 'fixed-then-assets', '', '', '', ''],
      ['innovation', 45915, 1000, 400, 600, '', '', 'fixed-then-assets', '', '', '', ''],
    ],
    'year-end': withIds('line', [
      ['year', 'statement', 'line', 'label', 'amount', 'categories', 'aop', 'source', 'note'],
      [2025, 'pl', 'sales', 'Sales', 46800, '', '', '', ''],
      [2025, 'konto', '41850', 'Software', 435.87, 'ai-services', '', '', ''],
    ]),
    plan: withIds('plan', [
      ['year', 'month', 'item', 'amount', 'note'],
      [2027, '', 'postage', 10, ''],
    ]),
  }
}

const STATIONERY = { category: 'stationery', family: 'operating', bucket: 'operating' }

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('row writes to %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('adds, changes and deletes categories, and Undo takes each back', async () => {
    const { store } = await harnessOf(used, everyTab())
    const slugs = () => store.state.workbook?.categories.map((category) => category.slug)

    await add(store, CATEGORY_WRITES, STATIONERY)
    await edit(store, CATEGORY_WRITES, 2, { colour: '#2a78d6', vat: 'none' })
    await remove(store, CATEGORY_WRITES, 7)

    expect(slugs()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'stationery'])
    expect(store.state.workbook?.categories[0]).toMatchObject({ colour: { stored: '#2a78d6', swatch: { name: 'Blue' } }, vat: 'none' })
    const [removed, changed, added] = store.state.writes
    for (const write of [removed!, changed!, added!]) await store.undo(write)

    expect(slugs()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'courier'])
    expect(store.state.workbook?.categories[0]).toMatchObject({ colour: { stored: '#dce9f9', swatch: null }, vat: 'deductible-25' })
    expect(store.state.writes.slice(0, 3).map((write) => wasUndone(write, store.state.writes))).toEqual([false, false, false])
    expect(store.state.writes.slice(3).map((write) => [wasUndone(write, store.state.writes), canUndo(write, store.state.writes)])).toEqual([
      [true, false],
      [true, false],
      [true, false],
    ])
    expect(store.state.workbook?.problems).toEqual([])
  })

  it('deletes rows, changes a row below them and adds one in a single write, and Undo puts each deleted row back at the foot', async () => {
    const { store } = await harnessOf(used, everyTab())
    const rows = () => store.state.workbook?.categories.map((category) => category.slug) ?? []
    await add(store, CATEGORY_WRITES, STATIONERY, { ...STATIONERY, category: 'paper' })

    const receipt = await writeRows(store, CATEGORY_WRITES, {
      added: [{ ...STATIONERY, category: 'ink' }],
      changed: [{ sheetRow: 9, cells: { colour: '#2a78d6' } }],
      removed: [7, 8],
    })

    expect(rows()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'paper', 'ink'])
    expect(cellsOf(receipt, 'change').map((cells) => cells.category)).toEqual(['paper'])
    expect(cellsOf(receipt, 'remove').map((cells) => cells.category)).toEqual(['courier', 'stationery'])

    await store.undo(store.state.writes[0]!)

    expect(store.state.snapshot?.categories.map((row) => [row.cells.category, row.cells.colour ?? ''])).toEqual([
      ['equipment', '#dce9f9'],
      ['ai-services', ''],
      ['revenue', ''],
      ['postage', ''],
      ['printing', ''],
      ['paper', ''],
      ['courier', ''],
      ['stationery', ''],
    ])
    expect(store.state.workbook?.problems).toEqual([])
  })

  it('puts deleted rows back by their name, whatever the session deleted or added since', async () => {
    const { store } = await harnessOf(used, everyTab())
    const slugs = () => store.state.snapshot?.categories.map((row) => row.cells.category)

    await add(store, CATEGORY_WRITES, STATIONERY)
    await remove(store, CATEGORY_WRITES, 8)
    await remove(store, CATEGORY_WRITES, 7)
    const [later, first] = store.state.writes

    await store.undo(first!)
    expect(slugs()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'stationery'])
    await store.undo(later!)
    expect(slugs()).toEqual(['equipment', 'ai-services', 'revenue', 'postage', 'printing', 'stationery', 'courier'])
  })

  it('refuses to put a row back while the tab holds its name again', async () => {
    const { store } = await harnessOf(used, everyTab())

    await add(store, CATEGORY_WRITES, STATIONERY)
    await remove(store, CATEGORY_WRITES, 8)
    const removal = store.state.writes[0]!
    await add(store, CATEGORY_WRITES, STATIONERY)

    await expect(store.undo(removal)).rejects.toThrow('The category "stationery" is in the workbook already, so it is not added again.')
  })

  it('puts a deleted row back at the foot of its tab when rows below it were deleted since', async () => {
    const { store } = await harnessOf(used, everyTab())
    await add(store, CATEGORY_WRITES, STATIONERY)

    const first = await remove(store, CATEGORY_WRITES, 7)
    await remove(store, CATEGORY_WRITES, 7)
    await store.undo(store.state.writes.find((write) => write.receipt === first)!)

    expect(store.state.snapshot?.categories.slice(-2).map((row) => row.cells.category)).toEqual(['printing', 'courier'])
  })

  it('refuses to rename or delete a category the ledger, the rules, the advances, the year-end or the plan tab names', async () => {
    const { store } = await harnessOf(used, everyTab())

    await expect(edit(store, CATEGORY_WRITES, 2, { category: 'hardware' })).rejects.toThrow('"equipment" cannot be renamed, since it is used by 1 ledger row.')
    await expect(remove(store, CATEGORY_WRITES, 3)).rejects.toThrow('"ai-services" cannot be deleted, since it is used by 1 ledger row, the rule merchant-model and 1 year-end konto row.')
    await expect(remove(store, CATEGORY_WRITES, 5)).rejects.toThrow('"postage" cannot be deleted, since it is used by 1 plan tab row.')
    await expect(edit(store, CATEGORY_WRITES, 6, { category: 'print' })).rejects.toThrow('"printing" cannot be renamed, since it is used by 1 owner advance.')
    expect(store.state.writes).toEqual([])
  })

  it('refuses a category name in use, one outside the slug format, a half-filled row and a bucket the advances cannot count in', async () => {
    const { store } = await harnessOf(used, everyTab())

    await expect(add(store, CATEGORY_WRITES, { ...STATIONERY, category: 'postage' })).rejects.toThrow('The category "postage" is in the workbook already, so it is not added again.')
    await expect(add(store, CATEGORY_WRITES, { ...STATIONERY, category: 'Office Supplies' })).rejects.toThrow('is not a category name the app can use')
    await expect(edit(store, CATEGORY_WRITES, 6, { bucket: 'income' })).rejects.toThrow('"printing" stays in the operating or taxes bucket, since an owner advance carries it')
    expect(store.state.writes).toEqual([])
  })

  it('adds an account with its IBAN, and refuses a bad IBAN, one already used, a client’s, and deleting an account the ledger names', async () => {
    const { store } = await harnessOf(used, everyTab())

    await add(store, ACCOUNT_WRITES, { account: 'savings', iban: SAVINGS_IBAN })

    expect(store.state.workbook?.accounts.map((account) => [account.slug, account.iban])).toEqual([
      ['main', 'XX00FAKE0000000001'],
      ['savings', SAVINGS_IBAN],
    ])
    await expect(add(store, ACCOUNT_WRITES, { account: 'spare', iban: 'XX24FAKE0000000097' })).rejects.toThrow('"XX24FAKE0000000097" is not a valid IBAN.')
    await expect(add(store, ACCOUNT_WRITES, { account: 'spare', iban: SAVINGS_IBAN })).rejects.toThrow(`${SAVINGS_IBAN} is already the IBAN of the savings account`)
    await expect(add(store, ACCOUNT_WRITES, { account: 'spare', iban: ACME_IBAN })).rejects.toThrow(`${ACME_IBAN} is the IBAN of the client acme`)
    await expect(add(store, ACCOUNT_WRITES, { account: 'main', iban: '' })).rejects.toThrow('The account "main" is in the workbook already, so it is not added again.')
    await expect(remove(store, ACCOUNT_WRITES, 2)).rejects.toThrow('"main" cannot be deleted, since it is used by 4 ledger rows.')
  })

  it('adds a second IBAN to a client’s row, and refuses an IBAN on another client or an account, a second row of a client, and deleting a client with invoices', async () => {
    const { store } = await harnessOf(used, everyTab())

    await edit(store, CLIENT_WRITES, 2, { iban: `${ACME_IBAN}, ${SECOND_ACME_IBAN.toLowerCase()}` })

    expect(store.state.workbook?.clients).toEqual([{ slug: 'acme', name: 'Acme Studio', ibans: [ACME_IBAN, SECOND_ACME_IBAN], invoicing: NO_CLIENT_INVOICING }])
    expect(store.state.snapshot?.clients[0]?.cells.iban).toBe(`${ACME_IBAN}, ${SECOND_ACME_IBAN}`)
    await expect(add(store, CLIENT_WRITES, { client: 'globex', name: 'Globex', iban: `XX50FAKE0000000096, ${SECOND_ACME_IBAN}` })).rejects.toThrow(`${SECOND_ACME_IBAN} is already on the clients tab for acme.`)
    await expect(add(store, CLIENT_WRITES, { client: 'globex', name: 'Globex', iban: 'XX00FAKE0000000001' })).rejects.toThrow('is not a valid IBAN')
    await expect(add(store, CLIENT_WRITES, { client: 'globex', name: 'Globex', iban: SAVINGS_IBAN })).resolves.not.toBeNull()
    await expect(add(store, CLIENT_WRITES, { client: 'acme', name: 'Acme Ltd', iban: 'XX50FAKE0000000096' })).rejects.toThrow('The client "acme" is in the workbook already, so it is not added again.')
    await expect(writeRows(store, CLIENT_WRITES, { added: [{ client: 'acme', iban: 'XX50FAKE0000000096' }], changed: [{ sheetRow: 2, cells: { name: 'Acme' } }] })).rejects.toThrow(
      'The client "acme" is in the workbook already, so it is not added again.',
    )
    await expect(remove(store, CLIENT_WRITES, 2)).rejects.toThrow('"acme" cannot be deleted, since it is used by 1 invoice and 1 billing plan row.')
    await expect(edit(store, CLIENT_WRITES, 2, { client: 'acme-studio' })).rejects.toThrow('"acme" cannot be renamed')
  })

  it('merges two rows of one client in one write, whose Undo is refused because the client is on the tab', async () => {
    const tabs = everyTab()
    const { store } = await harnessOf(used, {
      ...tabs,
      clients: [
        ['client', 'name', 'iban', 'address'],
        ['acme', 'Acme Studio', ACME_IBAN, '1 Example Road'],
        ['acme', 'Acme Studio', SECOND_ACME_IBAN, ''],
      ],
    })
    expect(store.state.workbook?.clients).toEqual([])
    expect(store.state.workbook?.problems.filter((problem) => problem.tab === 'clients').map((problem) => problem.reason)).toEqual([
      'acme is on 2 rows, so none of them counts. Put all its IBANs in the first row, separated by commas, and delete the others',
      'acme is on 2 rows, so none of them counts. Put all its IBANs in the first row, separated by commas, and delete the others',
    ])

    await writeRows(store, CLIENT_WRITES, { changed: [{ sheetRow: 2, cells: { iban: `${ACME_IBAN}, ${SECOND_ACME_IBAN}` } }], removed: [3] })

    expect(store.state.workbook?.clients).toEqual([{ slug: 'acme', name: 'Acme Studio', ibans: [ACME_IBAN, SECOND_ACME_IBAN], invoicing: { ...NO_CLIENT_INVOICING, address: '1 Example Road' } }])
    expect(store.state.workbook?.problems).toEqual([])
    const merged = store.state.snapshot?.clients.map((row) => row.cells)

    await expect(store.undo(store.state.writes[0]!)).rejects.toThrow('The client "acme" is in the workbook already, so it is not added again.')

    expect(store.state.snapshot?.clients.map((row) => row.cells)).toEqual(merged)
  })

  it('merges two rows of one client in two writes, the second row deleted first, and Undo takes back the IBAN but not the delete', async () => {
    const tabs = everyTab()
    const { store } = await harnessOf(used, {
      ...tabs,
      clients: [
        ['client', 'name', 'iban'],
        ['acme', 'Acme Studio', ACME_IBAN],
        ['acme', 'Acme Studio', SECOND_ACME_IBAN],
      ],
    })

    const deleted = await remove(store, CLIENT_WRITES, 3)
    expect(store.state.workbook?.clients.map((client) => client.ibans)).toEqual([[ACME_IBAN]])
    await edit(store, CLIENT_WRITES, 2, { iban: `${ACME_IBAN}, ${SECOND_ACME_IBAN}` })
    expect(store.state.workbook?.clients.map((client) => client.ibans)).toEqual([[ACME_IBAN, SECOND_ACME_IBAN]])

    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.clients.map((client) => client.ibans)).toEqual([[ACME_IBAN]])
    await expect(store.undo(store.state.writes.find((write) => write.receipt === deleted)!)).rejects.toThrow('The client "acme" is in the workbook already, so it is not added again.')
  })

  it('adds, changes and deletes an invoice as the generator files it, and refuses a number on the tab or a client not on the clients tab', async () => {
    const { store } = await harnessOf(used, everyTab())
    const october = { number: '2-1-26', client: 'acme', item: 'October work', amount: 4200, issued: 46326, due: 46356, period_from: 46296, period_to: 46326 }

    const receipt = await add(store, INVOICE_WRITES, october)

    expect(cellsOf(receipt, 'add')).toEqual([{ number: '2-1-26', client: 'acme', item: 'October work', amount: 4200, issued: 46326, due: 46356, period_from: 46296, period_to: 46326 }])
    expect(store.state.workbook?.invoices.map((invoice) => [invoice.number, invoice.amount, invoice.deliveryPeriod])).toEqual([
      ['1-1-26', euros(4000), { from: '2026-09-01', to: '2026-09-30' }],
      ['2-1-26', euros(4200), { from: '2026-10-01', to: '2026-10-31' }],
    ])
    await expect(add(store, INVOICE_WRITES, { ...october, client: 'globex' })).rejects.toThrow('Invoice 2-1-26 is already on the invoices tab, and each number is used once.')
    await expect(add(store, INVOICE_WRITES, { ...october, number: '3-1-26', client: 'globex' })).rejects.toThrow('globex is not on the clients tab')
    await expect(add(store, INVOICE_WRITES, { ...october, number: '3-1-26', amount: 0 })).rejects.toThrow('an invoice is for an amount above zero')

    await edit(store, INVOICE_WRITES, 3, { amount: 4300 })
    await remove(store, INVOICE_WRITES, 2)

    expect(store.state.workbook?.invoices.map((invoice) => [invoice.number, invoice.amount])).toEqual([['2-1-26', euros(4300)]])
    await store.undo(store.state.writes[0]!)
    expect(store.state.workbook?.invoices.map((invoice) => invoice.number)).toEqual(['2-1-26', '1-1-26'])
  })

  it('adds and changes assets, grants and year-end lines through their readers, and keeps a grant an asset is funded by', async () => {
    const { store } = await harnessOf(used, everyTab())

    await add(store, ASSET_WRITES, { asset: 'Monitor', bought: 46296, cost_net: 420, group: 'computers', funded_by: 'innovation' })
    await edit(store, GRANT_WRITES, 2, { note: 'Regional start-up grant' })
    await add(store, YEAR_END_WRITES, { year: 2025, statement: 'pl', line: 'material-costs', amount: 6242.17 })

    expect(hrDooWorkbook(store.state.workbook!).assets.map((asset) => [asset.name, asset.fundedBy])).toEqual([
      ['Laptop', 'startup'],
      ['Monitor', 'innovation'],
    ])
    expect(hrDooWorkbook(store.state.workbook!).grants[0]?.note).toBe('Regional start-up grant')
    expect(hrDooWorkbook(store.state.workbook!).yearEndLines).toHaveLength(3)
    await expect(remove(store, GRANT_WRITES, 2)).rejects.toThrow('"startup" cannot be deleted, since it is used by 1 asset.')
    await expect(edit(store, GRANT_WRITES, 3, { grant: 'innovation-2026' })).rejects.toThrow('"innovation" cannot be renamed, since it is used by 1 asset.')
    await expect(add(store, ASSET_WRITES, { asset: 'Laptop', bought: 46296, cost_net: 420, group: 'computers' })).rejects.toThrow('The new asset "Laptop" would be left out: "Laptop" is listed on more than one row, so none of them counts. The asset "Laptop" would then be left out: "Laptop" is listed on more than one row, so none of them counts.')
    await expect(add(store, ASSET_WRITES, { asset: 'Desk', bought: 46296, cost_net: 300, group: 'equipment', funded_by: 'lottery' })).rejects.toThrow('lottery is not on the grants tab')
    await expect(add(store, YEAR_END_WRITES, { year: 2025, statement: 'konto', line: '41200', amount: 82.04, categories: 'phones' })).rejects.toThrow('"phones" is not on the categories tab')
    await remove(store, ASSET_WRITES, 3)
    await remove(store, GRANT_WRITES, 3)
    expect(hrDooWorkbook(store.state.workbook!).grants.map((grant) => grant.slug)).toEqual(['startup'])
  })

  it('checks an added row against the row it lands on when a delete in the same write moves that row up', async () => {
    const grids = everyTab()
    const [header, startup, innovation] = grids.grants as [CellValue[], CellValue[], CellValue[]]
    const { store } = await harnessOf(used, { ...grids, grants: [header, startup, ['spare', ...startup.slice(1)], innovation] })
    const innovationAgain = cellsOfRecord(GRANTS_TAB, recordOnRow(store, GRANT_RECORDS, 4))

    await expect(writeRows(store, GRANT_WRITES, { added: [innovationAgain], removed: [3] })).rejects.toThrow('The grant "innovation" is in the workbook already, so it is not added again.')
  })

  it('refuses a change to a row that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used, everyTab())
    const stale = recordOnRow(store, ACCOUNT_RECORDS, 2)

    await edit(store, ACCOUNT_WRITES, 2, { iban: SAVINGS_IBAN })

    await expect(store.write('Changed', (unit) => unit.of(ACCOUNT_WRITES).change(stale, { ...stale, iban: 'XX50FAKE0000000096' }))).rejects.toThrow('The account "main" changed since the app read it.')
  })
})

describe('row writes to a Google Sheet', () => {
  it('finds a category by its name after rows were inserted above it from outside, and refuses when two rows hold the name', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, everyTab())
    sheets.grids.categories!.splice(1, 0, ['parcels', 'operating', 'operating'], ['stamps', 'operating', 'operating'])

    await edit(store, CATEGORY_WRITES, 7, { colour: '#2a78d6' })

    expect(writtenRanges()).toEqual(['categories!D9'])
    sheets.grids.categories!.push(['courier', 'operating', 'operating', '#2a78d6'])
    await expect(remove(store, CATEGORY_WRITES, 9)).rejects.toThrow('2 records hold the category "courier", so the app cannot tell which one is meant.')
  })

  it('writes only the cells that changed, by header, and appends a new category under every header', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, everyTab())
    const categories = (await sheets.sheetGrids()).get('categories')!.sheetId

    await edit(store, CATEGORY_WRITES, 2, { colour: '#2a78d6' })
    await add(store, CATEGORY_WRITES, STATIONERY)

    expect(writtenRanges()).toEqual(['categories!D2'])
    expect(sentRequests(sheets).filter((request) => 'appendCells' in request)).toEqual([
      { appendCells: { sheetId: categories, rows: [{ values: ['stationery', 'operating', 'operating', '', '', '', ''].map(cellData) }], fields: 'userEnteredValue' } },
    ])
    expect(writtenRanges().some((range) => range.startsWith('ledger!'))).toBe(false)
  })

  it('appends an invoice in the eight columns, the number as text and every date a serial number, and deletes one by taking its row out', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used, everyTab())
    const invoices = (await sheets.sheetGrids()).get('invoices')!.sheetId

    await add(store, INVOICE_WRITES, { number: '2-1-26', client: 'acme', item: 'October work', amount: 4200, issued: 46326, due: '', period_from: '', period_to: '' })
    await remove(store, INVOICE_WRITES, 2)

    expect(sentRequests(sheets)).toEqual([
      { appendCells: { sheetId: invoices, rows: [{ values: ['2-1-26', 'acme', 'October work', 4200, 46326, '', '', ''].map(cellData) }], fields: 'userEnteredValue' } },
      dateFormat(invoices, 2, 4),
      { deleteDimension: { range: { sheetId: invoices, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } },
    ])
    expect(writtenRanges()).toEqual([])
    expect(sheets.grids.invoices?.map((row) => row[0])).toEqual(['number', '2-1-26'])
    expect(sheets.formats.invoices?.[1]?.[4]).toBe('yyyy-mm-dd')
  })

  it('gives every date it writes the date format, a changed date and a year-end date line too', async () => {
    const { store, sheets } = await googleHarness(used, everyTab())
    const grids = await sheets.sheetGrids()

    await edit(store, ASSET_WRITES, 2, { in_use: 45812, note: 'Moved desks' })
    await add(store, YEAR_END_WRITES, { year: 2025, statement: 'tax', line: 'filed-on', amount: 46139 }, { year: 2025, statement: 'pl', line: 'material-costs', amount: 6242.17 })

    expect(sentRequests(sheets).filter((request) => 'repeatCell' in request)).toEqual([dateFormat(grids.get('assets')!.sheetId, 1, 2), dateFormat(grids.get('year-end')!.sheetId, 3, 4)])
    expect(sheets.formats.assets?.[1]?.[2]).toBe('yyyy-mm-dd')
    expect(sheets.formats.assets?.[1]?.[9]).toBeUndefined()
    expect(sheets.formats['year-end']?.[3]?.[4]).toBe('yyyy-mm-dd')
    expect(sheets.formats['year-end']?.[4]?.[4]).toBeUndefined()
  })

  it('sends the cells, the deletions and the new rows of one write in one batchUpdate, in that order', async () => {
    const { store, sheets } = await googleHarness(used, everyTab())
    const categories = (await sheets.sheetGrids()).get('categories')!.sheetId
    await add(store, CATEGORY_WRITES, STATIONERY, { ...STATIONERY, category: 'paper' })
    sheets.requests.length = 0

    await writeRows(store, CATEGORY_WRITES, {
      added: [{ ...STATIONERY, category: 'ink' }],
      changed: [{ sheetRow: 9, cells: { colour: '#2a78d6' } }],
      removed: [7, 8],
    })

    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(sentRequests(sheets)).toEqual([
      { updateCells: { start: { sheetId: categories, rowIndex: 8, columnIndex: 3 }, rows: [{ values: [cellData('#2a78d6')] }], fields: 'userEnteredValue' } },
      { deleteDimension: { range: { sheetId: categories, dimension: 'ROWS', startIndex: 7, endIndex: 8 } } },
      { deleteDimension: { range: { sheetId: categories, dimension: 'ROWS', startIndex: 6, endIndex: 7 } } },
      { appendCells: { sheetId: categories, rows: [{ values: ['ink', 'operating', 'operating', '', '', '', ''].map(cellData) }], fields: 'userEnteredValue' } },
    ])
    expect(sheets.grids.categories?.map((row) => row[0])).toEqual(['category', 'equipment', 'ai-services', 'revenue', 'postage', 'printing', 'paper', 'ink'])

    sheets.requests.length = 0
    await store.undo(store.state.writes[0]!)

    expect(sentRequests(sheets).map((request) => Object.keys(request)[0])).toEqual(['updateCells', 'deleteDimension', 'appendCells'])
    expect(sheets.grids.categories?.map((row) => row[0])).toEqual(['category', 'equipment', 'ai-services', 'revenue', 'postage', 'printing', 'paper', 'courier', 'stationery'])
  })

  it('changes nothing in the Sheet when one request of the write is refused', async () => {
    const { store, sheets } = await googleHarness(used, everyTab())
    const before = structuredClone(sheets.grids.categories)
    const send = sheets.updateSpreadsheet.bind(sheets)
    sheets.updateSpreadsheet = (requests) => send([...requests, { deleteDimension: { range: { sheetId: 999, dimension: 'ROWS', startIndex: 1, endIndex: 2 } } }])

    await expect(writeRows(store, CATEGORY_WRITES, { added: [STATIONERY], removed: [7] })).rejects.toThrow('No grid with id: 999')

    expect(sheets.grids.categories).toEqual(before)
  })

  it('leaves a formula cell alone when the change does not touch it', async () => {
    const grids = everyTab()
    grids.assets![1]![3] = 1519.199999
    const { store, writtenRanges } = await googleHarness(used, grids)

    await edit(store, ASSET_WRITES, 2, { note: 'Kept in the office' })

    expect(writtenRanges()).toEqual(['assets!J2'])
  })

  it('refuses a category label on a Sheet whose categories tab has no label column, and an invoices tab without the generator’s eight columns', async () => {
    const grids = everyTab()
    const { store, sheets } = await googleHarness(used, { ...grids, categories: grids.categories!.map((row) => row.slice(0, 5)) })
    sheets.grids.invoices = sheets.grids.invoices!.map((row) => row.slice(0, 6))

    await expect(add(store, CATEGORY_WRITES, { ...STATIONERY, label: 'Paper and pens' })).rejects.toThrow('The categories tab has no "label" column for what this change writes.')
    await expect(add(store, INVOICE_WRITES, { number: '2-1-26', client: 'acme', amount: 4200, issued: 46326 })).rejects.toThrow('The invoices tab has no "period_from", "period_to" column')
    await add(store, CATEGORY_WRITES, STATIONERY)
    expect(store.state.workbook?.categories.map((category) => category.slug)).toContain('stationery')
  })

  it('adds the label column a categories tab lacks, once the person agreed, and the screen then knows the tab has it', async () => {
    const grids = everyTab()
    const { store, sheets } = await googleHarness(used, { ...grids, categories: grids.categories!.map((row) => row.slice(0, 5)) })
    expect(store.state.snapshot?.meta.missingColumns?.categories).toEqual(['label', 'vat', 'owner_share'])

    await writeRows(store, CATEGORY_WRITES, { added: [{ ...STATIONERY, label: 'Paper and pens' }], changed: [{ sheetRow: 3, cells: { label: 'AI services' } }] }, true)

    expect(sheets.grids.categories![0]).toEqual(['category', 'family', 'bucket', 'colour', 'roles', 'label'])
    expect(sheets.grids.categories![2]![5]).toBe('AI services')
    expect(sheets.grids.categories!.at(-1)).toEqual(['stationery', 'operating', 'operating', null, null, 'Paper and pens'])
    expect(store.state.snapshot?.meta.missingColumns?.categories).toEqual(['vat', 'owner_share'])
    expect(store.state.workbook?.categories.find((category) => category.slug === 'stationery')?.label).toBe('Paper and pens')
  })

  it('adds two columns an accounts tab lacks side by side, past a grid with no free column', async () => {
    const grids = everyTab()
    const { store, sheets } = await googleHarness(used, { ...grids, accounts: grids.accounts!.map((row) => row.slice(0, 2)) })
    sheets.columnCounts.accounts = 2

    await writeRows(store, ACCOUNT_WRITES, { changed: [{ sheetRow: 2, cells: { label: 'Main', currency: 'EUR' } }] }, true)

    expect(sheets.grids.accounts![0]).toEqual(['account', 'iban', 'currency', 'label'])
    expect(sheets.grids.accounts![1]!.slice(2)).toEqual(['EUR', 'Main'])
    expect(sheets.columnCounts.accounts).toBe(4)
    expect(store.state.snapshot?.meta.missingColumns?.accounts).toBeUndefined()
  })

  it('keeps a rule that names a category valid, as the rules reader reads it', async () => {
    const grids = everyTab()
    const { store } = await googleHarness(used, { ...grids, rules: [...grids.rules!, ruleRow({ rule: 'review-postage', order: 200, enabled: false, category: 'postage', confidence: 'rule' })] })

    await expect(remove(store, CATEGORY_WRITES, 5)).rejects.toThrow('the rule review-postage')
  })
})
