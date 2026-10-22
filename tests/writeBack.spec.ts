import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { confirmation, recategorisation, undoOf, waitingRowsSettledBy } from '../src/features/review/domain/verdictChanges'
import { ruleTabCells } from '../src/features/rules/domain/rulesTabChange'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import type { WorkbookStore } from '../src/features/workbook/application/workbookStore'
import type { Transaction } from '../src/features/workbook/domain/workbook'
import { LEDGER_ROWS, cellData, excelHarness, forgetCaches, googleHarness, ruleRow, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

function row(store: WorkbookStore, counterparty: string): Transaction {
  const found = store.state.workbook?.transactions.find((transaction) => transaction.counterparty === counterparty)
  if (found === undefined) throw new Error(`no row from ${counterparty}`)
  return found
}

function settings(store: WorkbookStore): { reviewLabel: string } {
  return store.state.workbook!.settings
}

function rulesCells(store: WorkbookStore, id: string): Record<string, string | number | boolean> {
  return { ...store.state.snapshot!.rules.find((rule) => rule.cells.rule === id)!.cells }
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('writing to %s', (_name, harnessOf: (used: Set<string>, grids?: ReturnType<typeof workbookGrids>) => Promise<WriteBackHarness>) => {
  it('confirms a row: the category stays and flagged_by takes the review label', async () => {
    const { store } = await harnessOf(used)

    await store.setVerdicts([confirmation(row(store, 'MODEL API INC'), settings(store))!])

    expect(row(store, 'MODEL API INC')).toMatchObject({ category: 'ai-services', flaggedBy: 'ivan' })
  })

  it('recategorises a row, and Undo puts back exactly what was there', async () => {
    const { store } = await harnessOf(used)
    const receipt = await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'equipment', flaggedBy: 'ivan', bucket: 'operating' })

    await store.setVerdicts(undoOf(receipt))

    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'unknown', flaggedBy: 'ai', bucket: 'unclassified' })
  })

  it('lists every write of the session newest first, an undo beside the write it undid, and nothing for a refused one', async () => {
    const { store } = await harnessOf(used)
    const receipt = await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])
    await store.undoVerdicts(receipt)
    const expected = rulesCells(store, 'merchant-model')
    await store.changeRules({ appended: null, edited: [{ id: 'merchant-model', expected, cells: { ...expected, enabled: false } }] })
    await store.changeSettings([{ key: 'review_label', expected: 'ivan', value: 'anna' }])
    await expect(store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'snacks', settings(store))])).rejects.toThrow(WorkbookWriteRefused)

    expect(store.state.writes.map((write) => [write.id, write.kind])).toEqual([
      [4, 'settings'],
      [3, 'rules'],
      [2, 'ledger'],
      [1, 'ledger'],
    ])
    const [, , undoing, original] = store.state.writes
    expect(original).toMatchObject({ kind: 'ledger', receipt, undid: null, workbookId: store.state.workbook!.id })
    expect(undoing).toMatchObject({ kind: 'ledger', undid: receipt, receipt: { changes: [{ from: { category: 'equipment', flaggedBy: 'ivan' }, to: { category: 'unknown', flaggedBy: 'ai' } }] } })
    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'unknown', flaggedBy: 'ai' })
  })

  it('refuses a category the categories tab does not define, and changes nothing', async () => {
    const { store } = await harnessOf(used)

    await expect(store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'snacks', settings(store))])).rejects.toThrow(
      '"snacks" is not a category on the categories tab.',
    )
    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'unknown', flaggedBy: 'ai' })
    expect(store.state.writing).toBe(false)
  })

  it('refuses Undo once the row changed again since', async () => {
    const { store } = await harnessOf(used)
    const receipt = await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])
    await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'ai-services', settings(store))])

    await expect(store.setVerdicts(undoOf(receipt))).rejects.toThrow(WorkbookWriteRefused)
    expect(row(store, 'GADGET CORNER').category).toBe('ai-services')
  })

  it('adds a rule, then files only the rows still waiting that it settles, never a confirmed one', async () => {
    const { store } = await harnessOf(used)
    const debits = { rule: 'all-debits', order: 50, enabled: true, direction: 'debit', category: 'equipment', confidence: 'rule' }

    await store.changeRules({ appended: debits, edited: [] })
    const workbook = store.state.workbook!
    const waiting = waitingRowsSettledBy('all-debits', workbook.transactions, workbook.rules, categorisationContextOf(workbook))
    await store.setVerdicts(waiting)

    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['all-debits', 'merchant-model'])
    expect(waiting.map((change) => change.from.category)).toEqual(['unknown', 'ai-services'])
    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'equipment', flaggedBy: 'rule' })
    expect(row(store, 'MODEL API INC')).toMatchObject({ category: 'equipment', flaggedBy: 'rule' })
    expect(row(store, 'Desk Co')).toMatchObject({ category: 'equipment', flaggedBy: 'human' })
    expect(row(store, 'Cash deposit')).toMatchObject({ category: 'revenue', flaggedBy: 'rule' })
  })

  it('refuses a rule whose id is taken or whose category is not defined, as the Apps Script would', async () => {
    const { store } = await harnessOf(used)

    await expect(
      store.changeRules({ appended: { rule: 'Merchant-Model', order: 200, enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('Merchant-Model: the id is on more than one row, so none of them is tried')
    await expect(
      store.changeRules({ appended: { rule: 'snacks', order: 200, enabled: true, description_contains: 'X', category: 'snacks', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('the categories tab does not define it')
    expect(store.state.workbook!.rules).toHaveLength(1)
  })

  it('refuses a rule that would share its order with an enabled rule, since the Apps Script breaks that tie by row', async () => {
    const { store } = await harnessOf(used)

    await expect(
      store.changeRules({ appended: { rule: 'also-model', order: 100, enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('Nothing was written. Also-model and merchant-model would share the order 100, and the Apps Script tries rules of one order by their row, so give each its own order.')
    await store.changeRules({ appended: { rule: 'parked', order: 100, enabled: false, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [] })
    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['merchant-model', 'parked'])
  })

  it('refuses any rules change while the tab has a problem elsewhere', async () => {
    const grids = workbookGrids()
    grids.rules!.push(ruleRow({ rule: 'broken', order: 'soon', enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }))
    const { store } = await harnessOf(used, grids)

    await expect(
      store.changeRules({ appended: { rule: 'fine', order: 300, enabled: true, description_contains: 'Y', category: 'equipment', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('broken: the order "soon" is not a number')
  })

  it('switches a rule off in place by its id', async () => {
    const { store } = await harnessOf(used)
    const expected = rulesCells(store, 'merchant-model')

    await store.changeRules({ appended: null, edited: [{ id: 'merchant-model', expected, cells: { ...expected, enabled: false } }] })

    expect(store.state.workbook!.rules).toMatchObject([{ id: 'merchant-model', enabled: false }])
  })

  it('refuses to edit a rule that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used)
    const read = rulesCells(store, 'merchant-model')

    await expect(
      store.changeRules({ appended: null, edited: [{ id: 'merchant-model', expected: { ...read, note: 'typed meanwhile' }, cells: { ...read, enabled: false } }] }),
    ).rejects.toThrow('Rule "merchant-model" changed since the app last read it')
  })

  it('sets a setting in place and adds a row for a key the tab lacks', async () => {
    const { store } = await harnessOf(used)

    await store.changeSettings([
      { key: 'review_label', expected: 'ivan', value: 'anna' },
      { key: 'company_name', expected: null, value: 'Example Studio' },
    ])

    expect(store.state.workbook!.settings).toMatchObject({ reviewLabel: 'anna', companyName: 'Example Studio' })
  })

  it('refuses a setting the reader would not use', async () => {
    const { store } = await harnessOf(used)

    await expect(store.changeSettings([{ key: 'review_label', expected: 'ivan', value: 'rule' }])).rejects.toThrow('"rule" is what the categoriser writes')
    expect(settings(store).reviewLabel).toBe('ivan')
  })
})

describe('writing to a Google Sheet', () => {
  it('confirms with one write of the text in flagged_by, column J, after reading the ledger and categories', async () => {
    const { store, sheets } = await googleHarness(used)

    await store.setVerdicts([confirmation(row(store, 'MODEL API INC'), settings(store))!])

    expect(sheets.requests.map((request) => request.kind)).toEqual(['sheetGrids', 'batchGet', 'updateSpreadsheet', 'sheetGrids', 'batchGet'])
    expect(sheets.requests[1]).toEqual({ kind: 'batchGet', ranges: ['ledger', 'categories'] })
    expect(sheets.requests[2]).toEqual({
      kind: 'updateSpreadsheet',
      requests: [{ updateCells: { start: { sheetId: 0, rowIndex: 2, columnIndex: 9 }, rows: [{ values: [{ userEnteredValue: { stringValue: 'ivan' } }] }], fields: 'userEnteredValue' } }],
    })
  })

  it('recategorises with writes to I and J of that row only, in one request', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)

    await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(writtenRanges()).toEqual(['ledger!I2', 'ledger!J2'])
    expect(sheets.grids.ledger![1]).toEqual([...LEDGER_ROWS[0]!.slice(0, 8), 'equipment', 'ivan', ...LEDGER_ROWS[0]!.slice(10)])
  })

  it('finds the row again after the ingest inserted rows above it since the last sync', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)
    const target = row(store, 'MODEL API INC')
    sheets.grids.ledger!.splice(1, 0, [46301, 'main', 's-003', 'NEW ROW', '', 'x', -1, 999, 'unknown', 'ai', 'REF-5'], [46301, 'main', 's-003', 'NEWER ROW', '', 'y', -1, 998, 'unknown', 'ai', 'REF-6'])

    await store.setVerdicts([recategorisation(target, 'equipment', settings(store))])

    expect(writtenRanges()).toEqual(['ledger!I5', 'ledger!J5'])
    expect(row(store, 'MODEL API INC')).toMatchObject({ category: 'equipment' })
  })

  it('says so loudly when rows moved between the read and the write', async () => {
    const { store, sheets } = await googleHarness(used)
    const write = sheets.updateSpreadsheet.bind(sheets)
    sheets.updateSpreadsheet = async (requests) => {
      sheets.grids.ledger!.splice(1, 0, [46301, 'main', 's-003', 'ARRIVED MEANWHILE', '', 'x', -1, 999, 'unknown', 'ai', 'REF-9'])
      await write(requests)
    }

    await expect(store.setVerdicts([recategorisation(row(store, 'MODEL API INC'), 'equipment', settings(store))])).rejects.toThrow(
      'the main row with reference REF-3 does not read back as written. Rows may have moved while it was sent.',
    )
    expect(store.state.workbook!.transactions.map((transaction) => transaction.counterparty)).toContain('ARRIVED MEANWHILE')
    expect(store.state.writing).toBe(false)
  })

  it('finds a row without a reference by its date, amount, balance and description', async () => {
    const { store, writtenRanges } = await googleHarness(used)

    await store.setVerdicts([recategorisation(row(store, 'Cash deposit'), 'equipment', settings(store))])

    expect(writtenRanges()).toEqual(['ledger!I5', 'ledger!J5'])
  })

  it('refuses without writing when no row matches, or several do', async () => {
    const { store, sheets } = await googleHarness(used)
    const gone = row(store, 'Desk Co')
    const twice = row(store, 'MODEL API INC')
    sheets.grids.ledger!.splice(3, 1)
    sheets.grids.ledger!.push([...sheets.grids.ledger![2]!])

    await expect(store.setVerdicts([recategorisation(gone, 'revenue', settings(store))])).rejects.toThrow(
      'No ledger row matches the main row with reference REF-2 any more.',
    )
    await expect(store.setVerdicts([recategorisation(twice, 'revenue', settings(store))])).rejects.toThrow('2 ledger rows match the main row with reference REF-3, so the app cannot tell which to change.')
    expect(sheets.requests.some((request) => request.kind === 'updateSpreadsheet')).toBe(false)
  })

  it('refuses a row someone changed in the Sheet since the last sync', async () => {
    const { store, sheets } = await googleHarness(used)
    const target = row(store, 'GADGET CORNER')
    sheets.grids.ledger![1]![9] = 'ivan'

    await expect(store.setVerdicts([recategorisation(target, 'equipment', settings(store))])).rejects.toThrow('changed since the app read it: it now says')
    expect(sheets.requests.some((request) => request.kind === 'updateSpreadsheet')).toBe(false)
  })

  it('finds category and flagged_by by header, wherever they sit', async () => {
    const grids = workbookGrids()
    const moved = (cells: readonly (string | number | boolean | null)[]): (string | number | boolean)[] => [...cells.slice(0, 8), cells[9]!, cells[8]!, ...cells.slice(10)] as (string | number | boolean)[]
    grids.ledger = grids.ledger!.map(moved)
    const { store, writtenRanges } = await googleHarness(used, grids)

    await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(writtenRanges()).toEqual(['ledger!J2', 'ledger!I2'])
    expect(row(store, 'GADGET CORNER').category).toBe('equipment')
  })

  it('appends a rule below the last row, its cells in the header order', async () => {
    const { store, sheets } = await googleHarness(used)

    await store.changeRules({
      appended: { rule: 'desk-co', order: 200, enabled: true, counterparty_iban: 'XX00FAKE0000000013', category: 'equipment', confidence: 'rule', note: 'Furniture' },
      edited: [],
    })

    expect(sheets.requests[1]).toEqual({ kind: 'batchGet', ranges: ['rules', 'categories'] })
    expect(sheets.requests[2]).toEqual({
      kind: 'updateSpreadsheet',
      requests: [{ appendCells: { sheetId: 4, rows: [{ values: ruleRow({ rule: 'desk-co', order: 200, enabled: true, counterparty_iban: 'XX00FAKE0000000013', category: 'equipment', confidence: 'rule', note: 'Furniture' }).map(cellData) }], fields: 'userEnteredValue' } }],
    })
    expect(sheets.grids.rules).toHaveLength(3)
  })

  it('edits a rule by writing only the cells that change', async () => {
    const { store, writtenRanges } = await googleHarness(used)
    const expected = rulesCells(store, 'merchant-model')

    await store.changeRules({ appended: null, edited: [{ id: 'merchant-model', expected, cells: { ...expected, enabled: false, note: 'Paused' } }] })

    expect(writtenRanges()).toEqual(['rules!C2', 'rules!U2'])
  })

  it('refuses a rules tab with a column no rule can test, as parseRules does', async () => {
    const grids = workbookGrids()
    grids.rules![0]!.push('owner')
    const { store, sheets } = await googleHarness(used, grids)

    await expect(
      store.changeRules({ appended: ruleTabCells({ id: 'x', order: 1, enabled: true, conditions: [{ column: 'is_card' }], category: 'equipment', confidence: 'rule', note: '' }), edited: [] }),
    ).rejects.toThrow('column V is headed "owner", which no rule can test')
    expect(sheets.requests.some((request) => request.kind === 'updateSpreadsheet')).toBe(false)
  })

  it('refuses a rule that tests counterparty_is_client until the Sheet has a clients tab with client and iban columns', async () => {
    const asksForClients = ruleTabCells({
      id: 'client-pays',
      order: 1,
      enabled: true,
      conditions: [{ column: 'direction', direction: 'credit' }, { column: 'counterparty_is_client' }],
      category: 'revenue',
      confidence: 'rule',
      note: '',
    })
    const withoutClients = await googleHarness(used)
    expect(withoutClients.store.state.workbook?.hasClientsTab).toBe(false)
    await expect(withoutClients.store.changeRules({ appended: asksForClients, edited: [] })).rejects.toThrow(
      'client-pays: it tests counterparty_is_client, and the workbook has no clients tab with client and iban columns to answer it',
    )

    const headerless = workbookGrids()
    headerless.clients = [['client', 'name']]
    await expect((await googleHarness(used, headerless)).store.changeRules({ appended: asksForClients, edited: [] })).rejects.toThrow('no clients tab with client and iban columns')

    const withClients = workbookGrids()
    withClients.clients = [['client', 'name', 'iban'], ['acme', 'Acme', 'XX00FAKE0000000042']]
    const { store, sheets } = await googleHarness(used, withClients)
    await store.changeRules({ appended: asksForClients, edited: [] })
    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(store.state.workbook?.rules.map((rule) => rule.id)).toContain('client-pays')
    expect(store.state.workbook?.problems.filter((problem) => problem.tab === 'rules')).toEqual([])
  })

  it('sets a setting in the value column and appends a missing key under key and value', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)

    await store.changeSettings([
      { key: 'review_label', expected: 'ivan', value: 'anna' },
      { key: 'company_name', expected: null, value: 'Example Studio' },
    ])

    expect(writtenRanges()).toEqual(['settings!B3'])
    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(sheets.grids.settings!.at(-1)).toEqual(['company_name', 'Example Studio'])
  })

  it('refuses settings for a Sheet without a settings tab, and a key set on two rows', async () => {
    const withoutSettings = workbookGrids()
    delete withoutSettings.settings
    const bare = await googleHarness(used, withoutSettings)
    await expect(bare.store.changeSettings([{ key: 'company_name', expected: null, value: 'X' }])).rejects.toThrow('The workbook has no settings tab, so nothing was written.')

    const doubled = workbookGrids()
    doubled.settings!.push(['review_label', 'other'])
    const twice = await googleHarness(used, doubled)
    await expect(twice.store.changeSettings([{ key: 'review_label', expected: 'ivan', value: 'anna' }])).rejects.toThrow('sets "review_label" on 2 rows')
  })
})

describe('writing to a workbook kept in this browser', () => {
  it('keeps the change in the stored copy and notes it as not yet exported', async () => {
    const { store, sheets } = await excelHarness(used)

    await store.setVerdicts([recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(store.state.snapshot!.meta).toMatchObject({ syncedAt: '2026-10-17T09:00:00.000Z', unexportedSince: '2026-10-17T09:00:00.000Z' })
    expect(store.state.snapshot!.ledger.find((ledgerRow) => ledgerRow.cells.counterparty === 'GADGET CORNER')!.cells).toMatchObject({
      category: 'equipment',
      flagged_by: 'ivan',
      reference: 'REF-4',
    })
    expect(sheets.requests).toEqual([])
  })
})
