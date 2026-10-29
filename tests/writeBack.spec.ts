import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import type { DocumentCopy } from '../src/shared/storage/infrastructure/documentRecordStorage'
import { fileRows } from '../src/apps/company/review/application/fileRows'
import { confirmation, recategorisation, waitingRowsSettledBy } from '../src/apps/company/review/domain/verdictChanges'
import type { RowVerdict } from '../src/apps/company/review/domain/verdictChanges'
import { writeRulesChange } from '../src/apps/company/rules/application/ruleWrites'
import type { RuleFields, RulesTabChange } from '../src/apps/company/rules/domain/rulesTabChange'
import { draftOfRule } from '../src/apps/company/rules/domain/ruleDraft'
import { previewRulesChange } from '../src/apps/company/rules/domain/rulesChangePreview'
import { rulesChangeInWords } from '../src/apps/company/rules/domain/ruleSummary'
import { categorisationContextOf } from '../src/apps/company/rules/domain/transactionFacts'
import { removeSettings, setSettings } from '../src/apps/company/settings/application/settingWrites'
import { changedSettings, unreadSettingKeys } from '../src/apps/company/settings/domain/settings'
import { installedPack } from '../src/apps/company/packs/packContribution'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { canUndo } from '../src/shared/storage/application/createWorkbookStore'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WriteReceipt } from '../src/shared/storage/application/recordWrites'
import { WorkbookWriteRefused } from '../src/shared/storage/application/workbookWriteRefused'
import type { SettingEntry, Settings } from '../src/apps/company/settings/domain/settings'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import { browserHarness, forgetCaches, driveHarness, ruleRow, workbookGrids } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { hrDooWorkbook } from '../src/apps/company/packs/hr-doo/domain/hrDooPart'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

type Store = WorkbookStore<CompanyBooks, DocumentCopy>

function row(store: WorkbookStore<CompanyBooks>, counterparty: string): Transaction {
  const found = store.state.workbook?.transactions.find((transaction) => transaction.counterparty === counterparty)
  if (found === undefined) throw new Error(`no row from ${counterparty}`)
  return found
}

function settings(store: WorkbookStore<CompanyBooks>): Settings {
  return store.state.workbook!.settings
}

function ruleFields(store: Store, id: string): RuleFields {
  return store.state.records!.rules.records.find((stored) => stored.record.fields.rule === id)!.record.fields
}

/** Files the rows under their verdicts, as Review does. */
function setVerdicts(store: WorkbookStore<CompanyBooks>, verdicts: readonly RowVerdict[]): Promise<WriteReceipt | null> {
  return store.write('Filed', (unit) => fileRows(unit, store.state.records!.ledger, verdicts, store.state.workbook!.categories))
}

/** Undoes the session's write with this receipt, as its Undo does. */
function undo(store: WorkbookStore<CompanyBooks>, receipt: WriteReceipt | null): Promise<void> {
  return store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
}

function changeRules(store: WorkbookStore<CompanyBooks>, change: RulesTabChange): Promise<WriteReceipt | null> {
  return store.write('Rules saved', (unit) => writeRulesChange(unit, change))
}

function changeSettings(store: WorkbookStore<CompanyBooks>, values: readonly SettingEntry[]): Promise<WriteReceipt | null> {
  return store.write('Settings saved', (unit) => setSettings(unit, store.state.records!.settings, values))
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
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
    const expected = ruleFields(store, 'merchant-model')
    await changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected, fields: { ...expected, enabled: false } }], removed: null })
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

    await expect(setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'snacks', settings(store))])).rejects.toThrow('"snacks" is not a category on the categories tab.')
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
    const debits = { rule: 'all-debits', order: '50', enabled: true, direction: 'debit', category: 'equipment', confidence: 'rule' }

    await changeRules(store, { appended: debits, edited: [], removed: null })
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

  it('refuses a rule whose id is taken or whose category is not defined', async () => {
    const { store } = await harnessOf(used)

    await expect(
      changeRules(store, { appended: { rule: 'Merchant-Model', order: '200', enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [], removed: null }),
    ).rejects.toThrow('The rule "merchant-model" is in the workbook already, so it is not added again.')
    await expect(
      changeRules(store, { appended: { rule: 'snacks', order: '200', enabled: true, description_contains: 'X', category: 'snacks', confidence: 'rule' }, edited: [], removed: null }),
    ).rejects.toThrow('the categories tab does not define it')
    expect(store.state.workbook!.rules).toHaveLength(1)
  })

  it('saves a rule while a broken rule elsewhere on the tab stays left out', async () => {
    const grids = workbookGrids()
    grids.rules!.push(ruleRow({ rule: 'broken', order: 'soon', enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }))
    const { store } = await harnessOf(used, grids)

    await changeRules(store, { appended: { rule: 'fine', order: '300', enabled: true, description_contains: 'Y', category: 'equipment', confidence: 'rule' }, edited: [], removed: null })

    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['merchant-model', 'fine'])
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'rules').map((problem) => [problem.label, problem.reason])).toEqual([['broken', 'the order "soon" is not a number']])
  })

  it('lets two enabled rules share an order and tries them by id', async () => {
    const { store } = await harnessOf(used)

    await changeRules(store, { appended: { rule: 'also-model', order: '100', enabled: true, description_contains: 'X', category: 'equipment', confidence: 'rule' }, edited: [], removed: null })

    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['also-model', 'merchant-model'])
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'rules')).toEqual([])
  })

  it('undoes an added rule, a changed one and a deleted one, each back to what the tab held', async () => {
    const { store } = await harnessOf(used)
    const read = ruleFields(store, 'merchant-model')

    const added = await changeRules(store, {
      appended: { rule: 'desk-co', order: '200', enabled: true, counterparty_iban: 'XX00FAKE0000000013', category: 'equipment', confidence: 'rule' },
      edited: [],
      removed: null,
    })
    expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(true)
    await undo(store, added)
    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['merchant-model'])

    const { counterparty_contains: _dropped, ...withoutCounterparty } = read
    const changed = await changeRules(store, {
      appended: null,
      edited: [{ id: 'merchant-model', expected: read, fields: { ...withoutCounterparty, description_contains: 'MODEL', enabled: false, note: 'Paused' } }],
      removed: null,
    })
    expect(ruleFields(store, 'merchant-model')).not.toHaveProperty('counterparty_contains')
    await undo(store, changed)
    expect(ruleFields(store, 'merchant-model')).toEqual(read)

    const deleted = await changeRules(store, { appended: null, edited: [], removed: read })
    expect(store.state.workbook!.rules).toEqual([])
    await undo(store, deleted)
    expect(ruleFields(store, 'merchant-model')).toEqual(read)
    expect(store.state.workbook!.rules.map((rule) => rule.id)).toEqual(['merchant-model'])
  })

  it('deletes a rule as the editor does, its back-test listing the rows the rule filed', async () => {
    const grids = workbookGrids()
    grids.ledger![2]![9] = 'rule'
    const { store } = await harnessOf(used, grids)
    const workbook = store.state.workbook!
    const rows = recordsOf(store.state.records!.rules)
    const opened = draftOfRule(workbook.rules[0]!, rows, workbook.rules)!
    const deletion: RulesTabChange = { appended: null, edited: [], removed: opened.edited.expected }

    const preview = previewRulesChange(rows, deletion, new Set(workbook.categories.map((category) => category.slug)), workbook.rules, workbook.transactions, categorisationContextOf(workbook))
    expect(preview.refusals).toEqual([])
    expect(preview.backtest.brokenAgreements.map((change) => change.transaction.counterparty)).toEqual(['MODEL API INC'])
    expect(rulesChangeInWords(deletion)).toBe('Deleted merchant-model')

    await store.write(rulesChangeInWords(deletion), (unit) => writeRulesChange(unit, deletion))

    expect(store.state.workbook!.rules).toEqual([])
    expect(store.state.writes[0]!.receipt.title).toBe('Deleted merchant-model')
    await expect(changeRules(store, deletion)).rejects.toThrow('The rule "merchant-model" is no longer in the workbook. Sync and look again.')
  })

  it('switches a rule off in place by its id', async () => {
    const { store } = await harnessOf(used)
    const expected = ruleFields(store, 'merchant-model')

    await changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected, fields: { ...expected, enabled: false } }], removed: null })

    expect(store.state.workbook!.rules).toMatchObject([{ id: 'merchant-model', enabled: false }])
  })

  it('refuses to edit a rule that no longer holds what the app read', async () => {
    const { store } = await harnessOf(used)
    const read = ruleFields(store, 'merchant-model')

    await expect(
      changeRules(store, { appended: null, edited: [{ id: 'merchant-model', expected: { ...read, note: 'typed meanwhile' }, fields: { ...read, enabled: false } }], removed: null }),
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

    await changeSettings(store, [{ key: 'hr_owner_loan_interest', value: '0.02' }])

    expect(hrDooWorkbook(store.state.workbook!).companyFacts.ownerLoanInterest).toBe(200)
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
    await expect(changeSettings(store, [{ key: 'hr_company_registered', value: 'soon' }])).rejects.toThrow('"soon" is not a date such as 2025-05-12')
  })

  it('takes import profiles, one it cannot read among them, and a key the app does not know off the settings, so none is offered or reported again', async () => {
    const grids = workbookGrids()
    const { store } = await harnessOf(used, {
      ...grids,
      settings: [...grids.settings!, ['import_profile_old-bank', 'date=Datum; amount=Iznos; account=main'], ['import_profile_broken', 'nonsense'], ['old_switch', 'TRUE']],
    })
    const unread = unreadSettingKeys(recordsOf(store.state.records!.settings), installedPack().workbook?.settings ?? null)
    expect(unread).toEqual(
      new Map([
        ['import_profile_old-bank', 1],
        ['import_profile_broken', 1],
        ['old_switch', 1],
      ]),
    )
    expect(settings(store).importProfiles.map((profile) => profile.name)).toEqual(['old-bank'])
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'settings').map((problem) => problem.label)).toEqual(['import_profile_broken', 'old_switch'])

    await store.write('Removed', (unit) => removeSettings(unit, store.state.records!.settings, [...unread.keys()]))

    expect(settings(store).importProfiles).toEqual([])
    expect(store.state.workbook!.problems.filter((problem) => problem.tab === 'settings')).toEqual([])
    expect(store.state.records!.settings.records.map((stored) => stored.record.key)).toEqual(['card_settlement_ibans', 'review_label'])
  })

  it('counts an unknown key or a profile on two rows, which a write refuses to remove until one row holds it', async () => {
    const grids = workbookGrids()
    const { store } = await harnessOf(used, {
      ...grids,
      settings: [...grids.settings!, ['old_switch', 'TRUE'], ['old_switch', 'FALSE'], ['import_profile_twice', 'nonsense'], ['import_profile_twice', 'nonsense']],
    })

    expect(unreadSettingKeys(recordsOf(store.state.records!.settings), installedPack().workbook?.settings ?? null)).toEqual(
      new Map([
        ['old_switch', 2],
        ['import_profile_twice', 2],
      ]),
    )
    await expect(store.write('Removed', (unit) => removeSettings(unit, store.state.records!.settings, ['old_switch']))).rejects.toThrow(
      'The settings tab sets "old_switch" on 2 rows. Keep one of them in an export and open that file again.',
    )
  })

  it('writes the statements folder a save of Settings changes, adding its row once and changing that row after', async () => {
    const { store } = await harnessOf(used)
    const held = () => store.state.records!.settings
    const save = (next: Settings) => store.write('Settings saved', (unit) => setSettings(unit, held(), changedSettings(settings(store), next)))
    const folderRows = () => held().records.filter((stored) => stored.record.key === 'statements_folder')

    await save({ ...settings(store), statementsFolder: ['finance', 'statements'] })
    await save({ ...settings(store), statementsFolder: ['finance', 'bank statements'] })

    expect(settings(store).statementsFolder).toEqual(['finance', 'bank statements'])
    expect(folderRows().map((stored) => stored.record.value)).toEqual(['finance/bank statements'])
    expect(canUndo(store.state.writes[0]!, store.state.writes)).toBe(false)
  })

  it('refuses a setting the reader would not use', async () => {
    const { store } = await harnessOf(used)

    await expect(changeSettings(store, [{ key: 'review_label', value: 'rule' }])).rejects.toThrow('"rule" is what the categoriser writes')
    expect(settings(store).reviewLabel).toBe('ivan')
  })
})

describe('writing to a workbook kept in this browser', () => {
  it('keeps the change in the stored copy and notes it as not yet exported', async () => {
    const { store } = await browserHarness(used)

    await setVerdicts(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', settings(store))])

    expect(store.state.snapshot!.meta).toMatchObject({ syncedAt: '2026-10-17T09:00:00.000Z', unexportedSince: '2026-10-17T09:00:00.000Z' })
    expect(store.state.snapshot!.document.records['ledger-row']!.find((record) => record.counterparty === 'GADGET CORNER')).toMatchObject({
      category: 'equipment',
      flagged_by: 'ivan',
      reference: 'REF-4',
    })
  })
})
