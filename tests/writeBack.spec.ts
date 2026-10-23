import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { fileRows } from '../src/features/review/application/fileRows'
import { confirmation, recategorisation, waitingRowsSettledBy } from '../src/features/review/domain/verdictChanges'
import type { RowVerdict } from '../src/features/review/domain/verdictChanges'
import { writeRulesChange } from '../src/features/rules/application/ruleWrites'
import type { RulesTabChange } from '../src/features/rules/domain/rulesTabChange'
import { ruleTabCells } from '../src/features/rules/domain/rulesTabChange'
import { categorisationContextOf } from '../src/features/rules/domain/transactionFacts'
import { removeSettings, setSettings } from '../src/features/settings/application/settingWrites'
import { removableSettingKeys } from '../src/features/settings/domain/settings'
import { installedPack } from '../src/features/packs/packContribution'
import { recordsOf } from '../src/features/workbook/domain/recordsRead'
import type { WorkbookStore } from '../src/features/workbook/application/createWorkbookStore'
import type { WriteReceipt } from '../src/features/workbook/application/recordWrites'
import type { WorkbookCopy } from '../src/features/workbook/application/workbookPorts'
import { WorkbookWriteRefused } from '../src/features/workbook/application/workbookWriteRefused'
import type { SettingCell, Settings } from '../src/features/settings/domain/settings'
import type { Transaction } from '../src/features/workbook/domain/workbook'
import type { WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { LEDGER_ROWS, cellData, excelHarness, forgetCaches, googleHarness, ruleRow, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { hrDooWorkbook } from '../src/packs/hr-doo/domain/hrDooPart'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

type Store = WorkbookStore<WorkbookSnapshot>

function row(store: WorkbookStore<WorkbookCopy>, counterparty: string): Transaction {
  const found = store.state.workbook?.transactions.find((transaction) => transaction.counterparty === counterparty)
  if (found === undefined) throw new Error(`no row from ${counterparty}`)
  return found
}

function settings(store: WorkbookStore<WorkbookCopy>): Settings {
  return store.state.workbook!.settings
}

function rulesCells(store: Store, id: string): Record<string, string | number | boolean> {
  return { ...store.state.snapshot!.rules.find((rule) => rule.cells.rule === id)!.cells }
}

/** Files the rows under their verdicts, as Review does. */
function setVerdicts(store: WorkbookStore<WorkbookCopy>, verdicts: readonly RowVerdict[]): Promise<WriteReceipt | null> {
  return store.write('Filed', (unit) => fileRows(unit, store.state.records!.ledger, verdicts))
}

/** Undoes the session's write with this receipt, as its Undo does. */
function undo(store: WorkbookStore<WorkbookCopy>, receipt: WriteReceipt | null): Promise<void> {
  return store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
}

function changeRules(store: WorkbookStore<WorkbookCopy>, change: RulesTabChange): Promise<WriteReceipt | null> {
  return store.write('Rules saved', (unit) => writeRulesChange(unit, change))
}

function changeSettings(store: WorkbookStore<WorkbookCopy>, values: readonly { readonly key: string; readonly value: SettingCell }[]): Promise<WriteReceipt | null> {
  return store.write('Settings saved', (unit) => setSettings(unit, store.state.records!.settings, values))
}

describe.each([
  ['a Google Sheet', googleHarness],
  ['a workbook kept in this browser', excelHarness],
] as const)('writing to %s', (_name, harnessOf: (used: Set<string>, grids?: ReturnType<typeof workbookGrids>) => Promise<WriteBackHarness>) => {
  it('confirms a row: the category stays and flagged_by takes the review label', async () => {
    const { store } = await harnessOf(used)

    await setVerdicts(store, [confirmation(row(store, 'MODEL API INC'), settings(store))!])

    expect(row(store, 'MODEL API INC')).toMatchObject({ category: 'ai-services', flaggedBy: 'ivan' })
  })

  it('recategorises a row, and Undo puts back exactly what was there', async () => {
    const { store } = await harnessOf(used)
    const receipt = await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'equipment', flaggedBy: 'ivan', bucket: 'operating' })

    await undo(store, receipt)

    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'unknown', flaggedBy: 'ai', bucket: 'unclassified' })
  })

  it('lists every write of the session newest first, an undo beside the write it undid, and nothing for a refused one', async () => {
    const { store } = await harnessOf(used)
    const receipt = await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])
    await undo(store, receipt)
    const expected = rulesCells(store, 'merchant-model')
    await changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected, cells: { ...expected, enabled: false } }] })
    await changeSettings(store, [{ key: 'review_label', value: 'anna' }])
    await expect(setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'snacks', settings(store))])).rejects.toThrow(WorkbookWriteRefused)

    expect(store.state.writes.map((write) => [write.id, write.receipt.title])).toEqual([
      [4, 'Settings saved'],
      [3, 'Rules saved'],
      [2, 'Undone'],
      [1, 'Filed'],
    ])
    const [, , undoing, original] = store.state.writes
    expect(original).toMatchObject({ receipt, undid: null, workbookId: store.state.workbook!.id })
    expect(undoing).toMatchObject({
      undid: receipt,
      receipt: { records: [{ change: { verb: 'change', before: { category: 'equipment', flaggedBy: 'ivan' }, after: { category: 'unknown', flaggedBy: 'ai' } } }] },
    })
    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'unknown', flaggedBy: 'ai' })
  })

  it('refuses a category the categories tab does not define, and changes nothing', async () => {
    const { store } = await harnessOf(used)

    await expect(setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'snacks', settings(store))])).rejects.toThrow(
      '"snacks" is not a category on the categories tab.',
    )
    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'unknown', flaggedBy: 'ai' })
    expect(store.state.writing).toBe(false)
  })

  it('refuses Undo once the row changed again since', async () => {
    const { store } = await harnessOf(used)
    const receipt = await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])
    await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'ai-services', settings(store))])

    await expect(undo(store, receipt)).rejects.toThrow(WorkbookWriteRefused)
    expect(row(store, 'GADGET CORNER').category).toBe('ai-services')
  })

  it('adds a rule, then files only the rows still waiting that it settles, never a confirmed one', async () => {
    const { store } = await harnessOf(used)
    const debits = { rule: 'all-debits', order: 50, enabled: true, direction: 'debit', category: 'equipment', confidence: 'rule' }

    await changeRules(store, { appended: debits, edited: [] })
    const workbook = store.state.workbook!
    const waiting = waitingRowsSettledBy('all-debits', workbook.transactions, workbook.rules, categorisationContextOf(workbook))
    await setVerdicts(store, waiting)

    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['all-debits', 'merchant-model'])
    expect(waiting.map((filed) => workbook.transactions.find((transaction) => transaction.id === filed.id)?.category)).toEqual(['unknown', 'ai-services'])
    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'equipment', flaggedBy: 'rule' })
    expect(row(store, 'MODEL API INC')).toMatchObject({ category: 'equipment', flaggedBy: 'rule' })
    expect(row(store, 'Desk Co')).toMatchObject({ category: 'equipment', flaggedBy: 'human' })
    expect(row(store, 'Cash deposit')).toMatchObject({ category: 'revenue', flaggedBy: 'rule' })
  })

  it('refuses a rule whose id is taken or whose category is not defined, as the Apps Script would', async () => {
    const { store } = await harnessOf(used)

    await expect(
      changeRules(store, { appended: { rule: 'Merchant-Model', order: 200, enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('The rule "merchant-model" is in the workbook already, so it is not added again.')
    await expect(
      changeRules(store, { appended: { rule: 'snacks', order: 200, enabled: true, description_contains: 'X', category: 'snacks', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('the categories tab does not define it')
    expect(store.state.workbook!.rules).toHaveLength(1)
  })

  it('refuses a rule that would share its order with an enabled rule, since the Apps Script breaks that tie by row', async () => {
    const { store } = await harnessOf(used)

    await expect(
      changeRules(store, { appended: { rule: 'also-model', order: 100, enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('Nothing was written. Also-model and merchant-model would share the order 100, and the Apps Script tries rules of one order by their row, so give each its own order.')
    await changeRules(store, { appended: { rule: 'parked', order: 100, enabled: false, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [] })
    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['merchant-model', 'parked'])
  })

  it('refuses any rules change while the tab has a problem elsewhere', async () => {
    const grids = workbookGrids()
    grids.rules!.push(ruleRow({ rule: 'broken', order: 'soon', enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }))
    const { store } = await harnessOf(used, grids)

    await expect(
      changeRules(store, { appended: { rule: 'fine', order: 300, enabled: true, description_contains: 'Y', category: 'equipment', confidence: 'rule' }, edited: [] }),
    ).rejects.toThrow('broken: the order "soon" is not a number')
  })

  it('switches a rule off in place by its id', async () => {
    const { store } = await harnessOf(used)
    const expected = rulesCells(store, 'merchant-model')

    await changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected, cells: { ...expected, enabled: false } }] })

    expect(store.state.workbook!.rules).toMatchObject([{ id: 'merchant-model', enabled: false }])
  })

  it('refuses to edit a rule that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used)
    const read = rulesCells(store, 'merchant-model')

    await expect(
      changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected: { ...read, note: 'typed meanwhile' }, cells: { ...read, enabled: false } }] }),
    ).rejects.toThrow('The rule "merchant-model" changed since the app read it. Sync and look again.')
  })

  it('sets a setting in place and adds a row for a key the tab lacks', async () => {
    const { store } = await harnessOf(used)

    await changeSettings(store, [
      { key: 'review_label', value: 'anna' },
      { key: 'company_name', value: 'Example Studio' },
    ])

    expect(store.state.workbook!.settings).toMatchObject({ reviewLabel: 'anna', companyName: 'Example Studio' })
  })

  it('adds a key of the pack the tab lacks, which the pack reads, and refuses a value the pack would not use', async () => {
    const { store } = await harnessOf(used)

    await changeSettings(store, [{ key: 'hr_owner_loan_interest', value: 0.02 }])

    expect(hrDooWorkbook(store.state.workbook!).companyFacts.ownerLoanInterest).toBe(200)
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
    await expect(changeSettings(store, [{ key: 'hr_birth_year', value: 'soon' }])).rejects.toThrow('use a year of birth such as 1990')
  })

  it('takes import profiles, one it cannot read among them, and a key the app does not know off the settings, so none is offered or reported again', async () => {
    const grids = workbookGrids()
    const { store } = await harnessOf(used, {
      ...grids,
      settings: [...grids.settings!, ['import_profile_old-bank', 'date=Datum; amount=Iznos; account=main'], ['import_profile_broken', 'nonsense'], ['old_switch', 'TRUE']],
    })
    const removable = removableSettingKeys(recordsOf(store.state.records!.settings), installedPack().workbook?.settings ?? null)
    expect(removable).toEqual(['import_profile_old-bank', 'import_profile_broken', 'old_switch'])
    expect(settings(store).importProfiles.map((profile) => profile.name)).toEqual(['old-bank'])
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'settings').map((problem) => problem.label)).toEqual(['import_profile_broken', 'old_switch'])

    await store.write('Removed', (unit) => removeSettings(unit, store.state.records!.settings, removable))

    expect(settings(store).importProfiles).toEqual([])
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
    expect(store.state.records!.settings.records.map((stored) => stored.record.key)).toEqual(['card_settlement_ibans', 'review_label'])
  })

  it('refuses a setting the reader would not use', async () => {
    const { store } = await harnessOf(used)

    await expect(changeSettings(store, [{ key: 'review_label', value: 'rule' }])).rejects.toThrow('"rule" is what the categoriser writes')
    expect(settings(store).reviewLabel).toBe('ivan')
  })
})

describe('writing to a Google Sheet', () => {
  it('confirms with one write of the text in flagged_by, column J, after reading the ledger and categories', async () => {
    const { store, sheets } = await googleHarness(used)

    await setVerdicts(store, [confirmation(row(store, 'MODEL API INC'), settings(store))!])

    expect(sheets.requests.map((request) => request.kind)).toEqual(['sheetGrids', 'batchGet', 'updateSpreadsheet', 'sheetGrids', 'batchGet'])
    expect(sheets.requests[1]).toEqual({ kind: 'batchGet', ranges: ['ledger', 'categories'] })
    expect(sheets.requests[2]).toEqual({
      kind: 'updateSpreadsheet',
      requests: [{ updateCells: { start: { sheetId: 0, rowIndex: 2, columnIndex: 9 }, rows: [{ values: [{ userEnteredValue: { stringValue: 'ivan' } }] }], fields: 'userEnteredValue' } }],
    })
  })

  it('recategorises with writes to I and J of that row only, in one request', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)

    await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(writtenRanges()).toEqual(['ledger!I2', 'ledger!J2'])
    expect(sheets.grids.ledger![1]).toEqual([...LEDGER_ROWS[0]!.slice(0, 8), 'equipment', 'ivan', ...LEDGER_ROWS[0]!.slice(10)])
  })

  it('finds the row again after the ingest inserted rows above it since the last sync', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)
    const target = row(store, 'MODEL API INC')
    sheets.grids.ledger!.splice(1, 0, [46301, 'main', 's-003', 'NEW ROW', '', 'x', -1, 999, 'unknown', 'ai', 'REF-5'], [46301, 'main', 's-003', 'NEWER ROW', '', 'y', -1, 998, 'unknown', 'ai', 'REF-6'])

    await setVerdicts(store, [recategorisation(target, 'equipment', settings(store))])

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

    await expect(setVerdicts(store, [recategorisation(row(store, 'MODEL API INC'), 'equipment', settings(store))])).rejects.toThrow(
      'The write reached the workbook, but the ledger row "2026-10-04, MODEL API INC, -20, balance 1038.9" does not read back as written. Check it in the workbook.',
    )
    expect(store.state.workbook!.transactions.map((transaction) => transaction.counterparty)).toContain('ARRIVED MEANWHILE')
    expect(store.state.writing).toBe(false)
  })

  it('finds a row without a reference by its date, amount, balance and description', async () => {
    const { store, writtenRanges } = await googleHarness(used)

    await setVerdicts(store, [recategorisation(row(store, 'Cash deposit'), 'equipment', settings(store))])

    expect(writtenRanges()).toEqual(['ledger!I5', 'ledger!J5'])
  })

  it('refuses without writing when no row matches, or several do', async () => {
    const { store, sheets } = await googleHarness(used)
    const gone = row(store, 'Desk Co')
    const twice = row(store, 'MODEL API INC')
    sheets.grids.ledger!.splice(3, 1)
    sheets.grids.ledger!.push([...sheets.grids.ledger![2]!])

    await expect(setVerdicts(store, [recategorisation(gone, 'revenue', settings(store))])).rejects.toThrow(
      'The ledger row "2026-10-03, Desk Co, -100, balance 1058.9" is no longer in the workbook. Sync and look again.',
    )
    await expect(setVerdicts(store, [recategorisation(twice, 'revenue', settings(store))])).rejects.toThrow('2 records hold the ledger row "2026-10-04, MODEL API INC, -20, balance 1038.9", so the app cannot tell which one is meant.')
    expect(sheets.requests.some((request) => request.kind === 'updateSpreadsheet')).toBe(false)
  })

  it('refuses a row someone changed in the Sheet since the last sync', async () => {
    const { store, sheets } = await googleHarness(used)
    const target = row(store, 'GADGET CORNER')
    sheets.grids.ledger![1]![9] = 'ivan'

    await expect(setVerdicts(store, [recategorisation(target, 'equipment', settings(store))])).rejects.toThrow('The ledger row "2026-10-05, GADGET CORNER, -38.9, balance 1000" changed since the app read it.')
    expect(sheets.requests.some((request) => request.kind === 'updateSpreadsheet')).toBe(false)
  })

  it('finds category and flagged_by by header, wherever they sit', async () => {
    const grids = workbookGrids()
    const moved = (cells: readonly (string | number | boolean | null)[]): (string | number | boolean)[] => [...cells.slice(0, 8), cells[9]!, cells[8]!, ...cells.slice(10)] as (string | number | boolean)[]
    grids.ledger = grids.ledger!.map(moved)
    const { store, writtenRanges } = await googleHarness(used, grids)

    await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(writtenRanges()).toEqual(['ledger!J2', 'ledger!I2'])
    expect(row(store, 'GADGET CORNER').category).toBe('equipment')
  })

  it('appends a rule below the last row, its cells in the header order', async () => {
    const { store, sheets } = await googleHarness(used)

    await changeRules(store, {
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

    await changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected, cells: { ...expected, enabled: false, note: 'Paused' } }] })

    expect(writtenRanges()).toEqual(['rules!C2', 'rules!U2'])
  })

  it('refuses a rules tab with a column no rule can test, as parseRules does', async () => {
    const grids = workbookGrids()
    grids.rules![0]!.push('owner')
    const { store, sheets } = await googleHarness(used, grids)

    await expect(
      changeRules(store, { appended: ruleTabCells({ id: 'x', order: 1, enabled: true, conditions: [{ column: 'is_card' }], category: 'equipment', confidence: 'rule', note: '' }), edited: [] }),
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
    await expect(changeRules(withoutClients.store, { appended: asksForClients, edited: [] })).rejects.toThrow(
      'client-pays: it tests counterparty_is_client, and the workbook has no clients tab with client and iban columns to answer it',
    )

    const headerless = workbookGrids()
    headerless.clients = [['client', 'name']]
    await expect(changeRules((await googleHarness(used, headerless)).store, { appended: asksForClients, edited: [] })).rejects.toThrow('no clients tab with client and iban columns')

    const withClients = workbookGrids()
    withClients.clients = [['client', 'name', 'iban'], ['acme', 'Acme', 'XX00FAKE0000000042']]
    const { store, sheets } = await googleHarness(used, withClients)
    await changeRules(store, { appended: asksForClients, edited: [] })
    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(store.state.workbook?.rules.map((rule) => rule.id)).toContain('client-pays')
    expect(store.state.workbook?.problems.filter((problem) => problem.tab === 'rules')).toEqual([])
  })

  it('sets a setting in the value column and appends a missing key under key and value', async () => {
    const { store, sheets, writtenRanges } = await googleHarness(used)

    await changeSettings(store, [
      { key: 'review_label', value: 'anna' },
      { key: 'company_name', value: 'Example Studio' },
    ])

    expect(writtenRanges()).toEqual(['settings!B3'])
    expect(sheets.requests.filter((request) => request.kind === 'updateSpreadsheet')).toHaveLength(1)
    expect(sheets.grids.settings!.at(-1)).toEqual(['company_name', 'Example Studio'])
  })

  it('refuses settings for a Sheet without a settings tab, and a key set on two rows', async () => {
    const withoutSettings = workbookGrids()
    delete withoutSettings.settings
    const bare = await googleHarness(used, withoutSettings)
    await expect(changeSettings(bare.store, [{ key: 'company_name', value: 'X' }])).rejects.toThrow('The workbook has no settings tab, so nothing was written.')

    const doubled = workbookGrids()
    doubled.settings!.push(['review_label', 'other'])
    const twice = await googleHarness(used, doubled)
    await expect(changeSettings(twice.store, [{ key: 'review_label', value: 'anna' }])).rejects.toThrow('sets "review_label" on 2 rows')
  })
})

describe('writing to a workbook kept in this browser', () => {
  it('keeps the change in the stored copy and notes it as not yet exported', async () => {
    const { store, sheets } = await excelHarness(used)

    await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(store.state.snapshot!.meta).toMatchObject({ syncedAt: '2026-10-17T09:00:00.000Z', unexportedSince: '2026-10-17T09:00:00.000Z' })
    expect(store.state.snapshot!.ledger.find((ledgerRow) => ledgerRow.cells.counterparty === 'GADGET CORNER')!.cells).toMatchObject({
      category: 'equipment',
      flagged_by: 'ivan',
      reference: 'REF-4',
    })
    expect(sheets.requests).toEqual([])
  })
})
