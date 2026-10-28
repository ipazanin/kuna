import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { ownerShareOf } from '../src/apps/company/owner-share/domain/ownerShare'
import type { OwnerShare } from '../src/apps/company/owner-share/domain/ownerShare'
import { fileRows } from '../src/apps/company/review/application/fileRows'
import { confirmation, recategorisation, waitingRowsSettledBy } from '../src/apps/company/review/domain/verdictChanges'
import type { RowVerdict } from '../src/apps/company/review/domain/verdictChanges'
import { writeRulesChange } from '../src/apps/company/rules/application/ruleWrites'
import { categorisationContextOf } from '../src/apps/company/rules/domain/transactionFacts'
import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { writeSplit } from '../src/apps/company/transactions/application/splitWrites'
import { SPLIT_PART_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import type { SplitTabRow } from '../src/apps/company/workbook/domain/splitsReading'
import { changesOf } from '../src/shared/storage/application/recordWrites'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WriteReceipt } from '../src/shared/storage/application/recordWrites'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import type { Transaction } from '../src/apps/company/workbook/domain/workbook'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { ownerAdvanceOfDraft } from '../src/apps/company/packs/hr-doo/application/ownerAdvanceWrites'
import type { OwnerAdvanceEntry } from '../src/apps/company/packs/hr-doo/domain/ownerAdvancesReading'
import { OWNER_ADVANCE_RECORDS } from '../src/apps/company/packs/hr-doo/domain/hrDooKinds'
import { civil, euros } from './fixtures/ledger'
import { LEDGER_HEADER, LEDGER_ROWS, browserHarness, forgetCaches, driveHarness } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const share = (percent: number): OwnerShare => ownerShareOf(percent)!

/** AI services carry a 50% default, and a category with the owner-benefit role is there for it. */
const CATEGORIES: CellValue[][] = [
  ['category', 'family', 'bucket', 'roles', 'owner_share'],
  ['equipment', 'operating', 'operating', '', ''],
  ['ai-services', 'operating', 'operating', '', 50],
  ['revenue', 'income', 'income', '', ''],
  ['benefits', 'owner', 'owner-pay', 'owner-benefit', ''],
]

/** The harness's workbook with the share defaults. With `shares`, the ledger holds the column and the desk a 30% share of its own, as a person set it. */
function grids(shares: boolean): Record<string, CellValue[][]> {
  const ledger = shares
    ? [[...LEDGER_HEADER, 'owner_share'], ...LEDGER_ROWS.map((row) => [...row, row[3] === 'Desk Co' ? 30 : ''])]
    : [LEDGER_HEADER, ...LEDGER_ROWS.map((row) => [...row])]
  return {
    ledger,
    categories: CATEGORIES,
    accounts: [['account', 'iban'], ['main', 'XX00FAKE0000000001']],
    settings: [['key', 'value'], ['review_label', 'ivan']],
    rules: [['rule', 'order', 'enabled', 'counterparty_contains', 'category', 'confidence']],
  }
}

function row(store: WorkbookStore<CompanyBooks>, counterparty: string): Transaction {
  return store.state.workbook!.transactions.find((transaction) => transaction.counterparty === counterparty)!
}

function file(store: WorkbookStore<CompanyBooks>, verdicts: readonly RowVerdict[]): Promise<WriteReceipt | null> {
  return store.write('Filed', (unit) => fileRows(unit, store.state.records!.ledger, verdicts, store.state.workbook!.categories))
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('filing rows with their share in %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('confirms a row with its category’s default copied again, and the first share adds the owner_share column after the last one', async () => {
    const { store } = await harnessOf(used, grids(false))
    expect(row(store, 'MODEL API INC').ownerShare).toBeNull()

    await file(store, [confirmation(row(store, 'MODEL API INC'), store.state.workbook!.settings)!])

    expect(row(store, 'MODEL API INC')).toMatchObject({ category: 'ai-services', flaggedBy: 'ivan', ownerShare: 50 })
  })

  it('files a row in a category without a default with a blank share, and writes no owner_share cell or column', async () => {
    const { store } = await harnessOf(used, grids(false))

    await file(store, [recategorisation(row(store, 'GADGET CORNER'), 'equipment', store.state.workbook!.settings)])

    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'equipment', ownerShare: null })
  })

  it('recategorises a row with the new category’s default over the share it held, and one Undo puts back both', async () => {
    const { store } = await harnessOf(used, grids(true))
    expect(row(store, 'Desk Co')).toMatchObject({ category: 'equipment', ownerShare: 30 })

    const receipt = await file(store, [recategorisation(row(store, 'Desk Co'), 'ai-services', store.state.workbook!.settings)])
    expect(row(store, 'Desk Co')).toMatchObject({ category: 'ai-services', flaggedBy: 'ivan', ownerShare: 50 })

    await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
    expect(row(store, 'Desk Co')).toMatchObject({ category: 'equipment', flaggedBy: 'human', ownerShare: 30 })

    await file(store, [recategorisation(row(store, 'Desk Co'), 'revenue', store.state.workbook!.settings)])
    expect(row(store, 'Desk Co')).toMatchObject({ category: 'revenue', ownerShare: null })
  })

  it('files the waiting rows a new rule settles with the rule’s category’s default', async () => {
    const { store } = await harnessOf(used, grids(false))
    await store.write('Rules saved', (unit) =>
      writeRulesChange(unit, { appended: { rule: 'gadgets', order: '100', enabled: true, counterparty_contains: 'GADGET', category: 'ai-services', confidence: 'rule' }, edited: [], removed: null }),
    )
    const workbook = store.state.workbook!

    await file(store, waitingRowsSettledBy('gadgets', workbook.transactions, workbook.rules, categorisationContextOf(workbook)))

    expect(row(store, 'GADGET CORNER')).toMatchObject({ category: 'ai-services', flaggedBy: 'rule', ownerShare: 50 })
  })

  it('refuses a new default on a category outside operating cost, the role on a second category or outside owner pay, and lets Undo put a default back', async () => {
    const { store } = await harnessOf(used, grids(false))
    const categories = () => recordsOf(store.state.records!.categories)
    const revenue = categories().find((category) => category.slug === 'revenue')!
    const benefit = categories().find((category) => category.slug === 'benefits')!

    await expect(store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(revenue, { ...revenue, ownerShare: share(10) }))).rejects.toThrow(
      '"revenue" is in the income bucket, and only an operating category holds an owner share.',
    )
    await expect(store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(revenue, { ...revenue, roles: ['owner-benefit'] }))).rejects.toThrow(
      '"revenue" takes the owner-benefit role only once no other category carries it, and "benefits" does.',
    )
    await expect(store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(benefit, { ...benefit, bucket: 'operating' }))).rejects.toThrow(
      '"benefits" is in the operating bucket, and only an owner-pay category carries the owner-benefit role',
    )
    const ai = categories().find((category) => category.slug === 'ai-services')!
    const cleared = await store.write('Saved', (unit) => unit.of(CATEGORY_WRITES).change(ai, { ...ai, ownerShare: null }))
    expect(store.state.workbook!.categories.find((category) => category.slug === 'ai-services')?.ownerShare).toBeNull()

    await store.undo(store.state.writes.find((write) => write.receipt === cleared)!)
    expect(store.state.workbook!.categories.find((category) => category.slug === 'ai-services')?.ownerShare).toBe(50)
  })
})

describe('the share of a record filed outside the ledger', () => {
  const categories = [
    { slug: 'ai-services', ownerShare: share(50) },
    { slug: 'equipment', ownerShare: null },
  ]

  it('gives a new advance its category’s default, and one put in another category the new default', () => {
    const draft = { date: civil('2026-10-10'), amount: euros(20), description: 'Seats ', category: 'AI-Services' }
    const added = ownerAdvanceOfDraft(draft, categories)
    expect(added).toMatchObject({ category: 'ai-services', description: 'Seats', ownerShare: 50 })

    const overridden: OwnerAdvanceEntry = { ...added, ownerShare: share(10) }
    expect(ownerAdvanceOfDraft({ ...draft, amount: euros(25) }, categories, overridden)).toMatchObject({ amount: euros(25), ownerShare: 10, id: added.id })
    expect(ownerAdvanceOfDraft({ ...draft, category: 'equipment' }, categories, overridden)).toMatchObject({ category: 'equipment', ownerShare: null, id: added.id })
    expect(ownerAdvanceOfDraft({ ...draft, category: 'equipment' }, categories).id).not.toBe(added.id)
    expect(added.id.startsWith(recordIdOf(OWNER_ADVANCE_RECORDS, ''))).toBe(true)
  })

  it('gives each new split part its category’s default, a part put in another category the new one, and keeps the share of a part that keeps its category', () => {
    const key = { date: civil('2026-10-05'), account: 'main', rowAmount: euros(-30), rowBalance: euros(970) }
    const held: SplitTabRow[] = [
      { key, amount: euros(-20), category: 'ai-services', note: '', ownerShare: share(10), id: recordIdOf(SPLIT_PART_RECORDS, 'part-a') },
      { key, amount: euros(-10), category: 'ai-services', note: '', ownerShare: share(50), id: recordIdOf(SPLIT_PART_RECORDS, 'part-b') },
    ]
    const bankRow = { date: key.date, account: 'main', amount: key.rowAmount, balance: key.rowBalance }

    const changes = changesOf((unit) =>
      writeSplit(
        unit,
        bankRow,
        held,
        [
          { amount: euros(-15), category: 'ai-services', note: 'Seats', opened: held[0]! },
          { amount: euros(-10), category: 'equipment', note: '', opened: held[1]! },
          { amount: euros(-5), category: 'ai-services', note: 'A cable', opened: null },
        ],
        categories,
      ),
    ).map(({ change }) => change)

    expect(changes.map((change) => [change.verb, 'after' in change ? (change.after as SplitTabRow).ownerShare : null])).toEqual([
      ['change', 10],
      ['change', null],
      ['add', 50],
    ])
  })

  it('keeps the share a part was opened with when a part above it is removed in the editor', () => {
    const key = { date: civil('2026-10-05'), account: 'main', rowAmount: euros(-30), rowBalance: euros(970) }
    const held: SplitTabRow[] = [
      { key, amount: euros(-20), category: 'ai-services', note: '', ownerShare: share(10), id: recordIdOf(SPLIT_PART_RECORDS, 'part-a') },
      { key, amount: euros(-6), category: 'ai-services', note: 'Seats', ownerShare: null, id: recordIdOf(SPLIT_PART_RECORDS, 'part-b') },
      { key, amount: euros(-4), category: 'equipment', note: '', ownerShare: share(30), id: recordIdOf(SPLIT_PART_RECORDS, 'part-c') },
    ]
    const bankRow = { date: key.date, account: 'main', amount: key.rowAmount, balance: key.rowBalance }

    const changes = changesOf((unit) =>
      writeSplit(
        unit,
        bankRow,
        held,
        [
          { amount: euros(-26), category: 'ai-services', note: 'Seats', opened: held[1]! },
          { amount: euros(-4), category: 'equipment', note: '', opened: held[2]! },
        ],
        categories,
      ),
    ).map(({ change }) => change)

    expect(changes.map((change) => [change.verb, 'after' in change ? (change.after as SplitTabRow).ownerShare : null])).toEqual([
      ['change', null],
      ['change', 30],
      ['remove', null],
    ])
  })
})
