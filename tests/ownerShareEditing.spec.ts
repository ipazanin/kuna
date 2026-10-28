import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'

import { moneyFromAmount } from '../src/shared/money/money'
import { fillShares, writeOwnerShare } from '../src/apps/company/owner-share/application/ownerShareWrites'
import { ownerPartOf, ownerShareOf, shareFillsOf, typedOwnerShare } from '../src/apps/company/owner-share/domain/ownerShare'
import type { OwnerShare, ShareTarget } from '../src/apps/company/owner-share/domain/ownerShare'
import { CATEGORY_WRITES } from '../src/apps/company/settings/application/namedRecordWrites'
import { ownerPartsOf } from '../src/apps/company/owner-share/domain/ownerParts'
import { listedRows, withPartHeadings } from '../src/apps/company/transactions/domain/listedRows'
import { ownerShareChangeOf } from '../src/apps/company/transactions/domain/ownerShareChange'
import type { WorkbookStore } from '../src/shared/storage/application/createWorkbookStore'
import type { CompanyBooks } from '../src/apps/company/workbook/domain/readWorkbook'
import type { WriteReceipt } from '../src/shared/storage/application/recordWrites'
import { recordsOf } from '../src/shared/storage/domain/recordsRead'
import { splitLedger } from '../src/apps/company/workbook/domain/splits'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { LEDGER_HEADER, LEDGER_ROWS, browserHarness, forgetCaches, driveHarness } from './fixtures/writeBack'
import type { WriteBackHarness } from './fixtures/writeBack'
import { withIds } from './fixtures/rowIds'

const used = new Set<string>()

afterEach(async () => {
  await forgetCaches(used)
})

const share = (percent: number): OwnerShare => ownerShareOf(percent)!

/**
 * The live layout: no owner_share column on the ledger, the splits or the owner-advances tab. The
 * model API row is split into an AI services part and an equipment part, and the desk sits in
 * equipment, which holds no default yet.
 */
function grids(): Record<string, CellValue[][]> {
  return {
    ledger: [LEDGER_HEADER, ...LEDGER_ROWS.map((row) => (row[3] === 'GADGET CORNER' ? [...row.slice(0, 8), 'equipment', 'human', ...row.slice(10)] : [...row]))],
    categories: [
      ['category', 'family', 'bucket', 'roles', 'owner_share'],
      ['equipment', 'operating', 'operating', '', ''],
      ['ai-services', 'operating', 'operating', '', 50],
      ['revenue', 'income', 'income', '', ''],
      ['benefits', 'owner', 'owner-pay', 'owner-benefit', ''],
    ],
    accounts: [['account', 'iban'], ['main', 'XX00FAKE0000000001']],
    settings: [['key', 'value'], ['review_label', 'ivan']],
    rules: [['rule', 'order', 'enabled', 'counterparty_contains', 'category', 'confidence']],
    splits: withIds('split', [
      ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note'],
      [46299, 'main', -20, 1038.9, -15, 'ai-services', 'Seats'],
      [46299, 'main', -20, 1038.9, -5, 'equipment', 'A cable'],
    ]),
    'owner-advances': withIds('advance', [
      ['date', 'amount', 'description', 'category'],
      [46300, 20, 'Monitor arm', 'equipment'],
    ]),
  }
}

function targets(store: WorkbookStore<CompanyBooks>): { readonly desk: ShareTarget; readonly cable: ShareTarget; readonly arm: ShareTarget } {
  const workbook = store.state.workbook!
  const desk = workbook.transactions.find((row) => row.counterparty === 'Desk Co')!
  const cable = workbook.splits[0]!.parts.find((part) => part.category === 'equipment')!
  const arm = workbook.ownerAdvances.find((advance) => advance.description === 'Monitor arm')!
  return { desk: { holder: 'ledger', id: desk.id }, cable: { holder: 'split-part', id: cable.id }, arm: { holder: 'owner-advance', id: arm.id } }
}

/** The shares of the desk, the cable part and the monitor arm, as the workbook on screen holds them. */
function shares(store: WorkbookStore<CompanyBooks>): (number | null)[] {
  const workbook = store.state.workbook!
  return [
    workbook.transactions.find((row) => row.counterparty === 'Desk Co')!.ownerShare,
    workbook.splits[0]!.parts.find((part) => part.category === 'equipment')!.ownerShare,
    workbook.ownerAdvances.find((advance) => advance.description === 'Monitor arm')!.ownerShare,
  ]
}

function setShare(store: WorkbookStore<CompanyBooks>, target: ShareTarget, percent: OwnerShare | null): Promise<WriteReceipt | null> {
  return store.write('Owner share', (unit) => writeOwnerShare(unit, store.state.records!, target, percent))
}

async function undo(store: WorkbookStore<CompanyBooks>, receipt: WriteReceipt | null): Promise<void> {
  await store.undo(store.state.writes.find((write) => write.receipt === receipt)!)
}

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('setting one owner share in %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('sets, changes and clears the share of a ledger row, a split part and an owner advance, each with Undo', async () => {
    const { store } = await harnessOf(used, grids())
    const { desk, cable, arm } = targets(store)
    expect(shares(store)).toEqual([null, null, null])

    await setShare(store, desk, share(30))
    await setShare(store, cable, share(20))
    await setShare(store, arm, share(25))
    expect(shares(store)).toEqual([30, 20, 25])

    const changed = await setShare(store, desk, share(40))
    expect(shares(store)).toEqual([40, 20, 25])
    const cleared = await setShare(store, cable, null)
    expect(shares(store)).toEqual([40, null, 25])
    const zero = await setShare(store, arm, share(0))
    expect(shares(store)).toEqual([40, null, 0])

    await undo(store, zero)
    await undo(store, cleared)
    await undo(store, changed)
    expect(shares(store)).toEqual([30, 20, 25])
  })

  it('writes nothing when the share is the one the record holds', async () => {
    const { store, drive } = await harnessOf(used, grids())
    const { desk } = targets(store)

    expect(await setShare(store, desk, null)).toBeNull()
    expect(drive?.requests.filter((request) => request === 'upload') ?? []).toEqual([])
  })
})

describe.each([
  ['a file on Drive', driveHarness],
  ['a workbook kept in this browser', browserHarness],
] as const)('the fill offer in %s', (_name, harnessOf: (used: Set<string>, grids?: Record<string, CellValue[][]>) => Promise<WriteBackHarness>) => {
  it('gives the new default to the blank rows of the category with the categories in one write, keeps a 0, and one Undo puts back all of it', async () => {
    const { store } = await harnessOf(used, grids())
    const gadget = store.state.workbook!.transactions.find((row) => row.counterparty === 'GADGET CORNER')!
    await setShare(store, { holder: 'ledger', id: gadget.id }, share(0))
    const equipment = recordsOf(store.state.records!.categories).find((category) => category.slug === 'equipment')!
    const saved = { ...equipment, ownerShare: share(20) }

    const fills = shareFillsOf(store.state.workbook!, [saved])
    expect(fills).toEqual([{ category: 'equipment', ownerShare: 20, targets: Object.values(targets(store)) }])

    const receipt = await store.write('Categories saved', (unit) => {
      unit.of(CATEGORY_WRITES).change(equipment, saved)
      fillShares(unit, store.state.records!, fills)
    })
    expect(store.state.workbook!.categories.find((category) => category.slug === 'equipment')?.ownerShare).toBe(20)
    expect(shares(store)).toEqual([20, 20, 20])
    expect(store.state.workbook!.transactions.find((row) => row.counterparty === 'GADGET CORNER')!.ownerShare).toBe(0)

    await undo(store, receipt)
    expect(store.state.workbook!.categories.find((category) => category.slug === 'equipment')?.ownerShare).toBeNull()
    expect(shares(store)).toEqual([null, null, null])
    expect(store.state.workbook!.transactions.find((row) => row.counterparty === 'GADGET CORNER')!.ownerShare).toBe(0)
  })

  it('leaves alone a record that took a share while the offer was open', async () => {
    const { store } = await harnessOf(used, grids())
    const { desk } = targets(store)
    const equipment = recordsOf(store.state.records!.categories).find((category) => category.slug === 'equipment')!
    const saved = { ...equipment, ownerShare: share(20) }
    const fills = shareFillsOf(store.state.workbook!, [saved])
    await setShare(store, desk, share(5))

    await store.write('Categories saved', (unit) => {
      unit.of(CATEGORY_WRITES).change(equipment, saved)
      fillShares(unit, store.state.records!, fills)
    })

    expect(shares(store)).toEqual([5, 20, 20])
  })
})

describe('what a save of the categories may fill', () => {
  const rows = [
    { counterparty: 'Desk', category: 'equipment', ownerShare: null },
    { counterparty: 'Chair', category: 'equipment', ownerShare: share(0) },
    { counterparty: 'Split', category: 'equipment', ownerShare: null },
    { counterparty: 'Seats', category: 'ai-services', ownerShare: null },
  ].map((row, index) => ({ ...row, id: `ledger-row:${index}` }))
  const workbook = {
    categories: [
      { slug: 'equipment', ownerShare: null },
      { slug: 'ai-services', ownerShare: share(50) },
    ],
    transactions: rows,
    splits: [{ row: rows[2]!, parts: [{ category: 'equipment', ownerShare: null, id: 'split-part:a' }] }],
    rowsKeptWhole: new Map(),
    ownerAdvances: [
      { category: 'equipment', ownerShare: null, id: 'owner-advance:a' },
      { category: 'equipment', ownerShare: share(10), id: 'owner-advance:b' },
    ],
  } as unknown as Parameters<typeof shareFillsOf>[0]

  it('fills only blank shares, and leaves the ledger cell of a split row to its parts', () => {
    expect(shareFillsOf(workbook, [{ slug: 'equipment', ownerShare: share(20) }])).toEqual([
      {
        category: 'equipment',
        ownerShare: 20,
        targets: [
          { holder: 'ledger', id: 'ledger-row:0' },
          { holder: 'split-part', id: 'split-part:a' },
          { holder: 'owner-advance', id: 'owner-advance:a' },
        ],
      },
    ])
  })

  it('fills the ledger cell of a split row the pack keeps whole, and not its parts, which do not count', () => {
    const keptWhole = { ...workbook, rowsKeptWhole: new Map([[rows[2]!.id, 'an asset claims it']]) } as unknown as Parameters<typeof shareFillsOf>[0]

    expect(shareFillsOf(keptWhole, [{ slug: 'equipment', ownerShare: share(20) }])[0]?.targets).toEqual([
      { holder: 'ledger', id: 'ledger-row:0' },
      { holder: 'ledger', id: 'ledger-row:2' },
      { holder: 'owner-advance', id: 'owner-advance:a' },
    ])
  })

  it('offers nothing for a default the save keeps or clears, or a category with no blank row', () => {
    expect(shareFillsOf(workbook, [{ slug: 'ai-services', ownerShare: share(50) }])).toEqual([])
    expect(shareFillsOf(workbook, [{ slug: 'ai-services', ownerShare: null }])).toEqual([])
    expect(shareFillsOf(workbook, [{ slug: 'travel', ownerShare: share(5) }])).toEqual([])
  })
})

describe('the owner share as a person types it and splits a payment by it', () => {
  it('reads a whole number from 0 to 100, blank as none, and anything else as not a share', () => {
    expect(['30', ' 0 ', '100', '', '  '].map(typedOwnerShare)).toEqual([30, 0, 100, null, null])
    expect(['101', '-1', '12.5', '1e1', '0x10', 'half'].map(typedOwnerShare)).toEqual(Array(6).fill(undefined))
  })

  it('rounds the owner part to the cent and leaves the company the rest, so the two add up', () => {
    expect(ownerPartOf(moneyFromAmount(-2000), share(30))).toBe(moneyFromAmount(-600))
    expect(ownerPartOf(moneyFromAmount(-0.05), share(50))).toBe(moneyFromAmount(-0.03))
    expect(ownerPartOf(moneyFromAmount(12.35), share(33))).toBe(moneyFromAmount(4.08))
    expect(ownerPartOf(moneyFromAmount(-99.99), share(0))).toBe(0)
  })
})

describe('where Transactions offers the owner share', () => {
  const base = { account: 'main', date: '2026-10-01', sequence: 1, statement: '', counterparty: 'Shop', counterpartyIban: '', description: '', amount: moneyFromAmount(-10), balance: moneyFromAmount(90), family: 'operating', reference: 'R-1', signals: {}, reviewReasons: [], ownerShare: null, id: 'ledger-row:shop' }

  it('offers it on a settled operating row, a split part and an operating advance, and not on a waiting row or outside operating cost', () => {
    const settled = { ...base, category: 'equipment', bucket: 'operating', flaggedBy: 'human' }
    const waiting = { ...base, category: 'equipment', bucket: 'operating', flaggedBy: 'ai', id: 'ledger-row:waiting' }
    const owner = { ...base, category: 'salary', bucket: 'owner-pay', flaggedBy: 'human', id: 'ledger-row:salary' }
    const split = splitLedger([settled] as never, [{ row: settled, parts: [{ amount: moneyFromAmount(-6), category: 'equipment', family: 'operating', bucket: 'operating', note: '', ownerShare: null, id: 'split-part:p' }, { amount: moneyFromAmount(-4), category: 'salary', family: 'owner', bucket: 'owner-pay', note: '', ownerShare: null, id: 'split-part:q' }]}] as never)
    const advances = [
      { date: '2026-10-01', amount: moneyFromAmount(5), description: 'Pens', category: 'equipment', family: 'operating', bucket: 'operating', ownerShare: null, id: 'owner-advance:pens' },
      { date: '2026-10-01', amount: moneyFromAmount(5), description: 'Tax', category: 'fees', family: 'taxes', bucket: 'taxes', ownerShare: null, id: 'owner-advance:tax' },
    ]

    const offered = listedRows([settled, waiting, owner, ...split] as never, advances as never).map(ownerShareChangeOf)

    expect(offered).toEqual([
      { holder: 'ledger', id: 'ledger-row:shop' },
      null,
      null,
      { holder: 'split-part', id: 'split-part:p' },
      null,
      { holder: 'owner-advance', id: 'owner-advance:pens' },
      null,
    ])
  })

  it('offers it on the heading and on either part of a shared row, for the row as booked', () => {
    const benefit = { slug: 'benefits', family: 'owner', bucket: 'owner-pay', roles: ['owner-benefit'], ownerShare: null }
    const laptop = { ...base, category: 'equipment', bucket: 'operating', flaggedBy: 'human', ownerShare: share(30) }
    const advance = { date: '2026-10-01', amount: moneyFromAmount(5), description: 'Pens', category: 'equipment', family: 'operating', bucket: 'operating', ownerShare: share(30), id: 'owner-advance:pens' }

    const entries = withPartHeadings(listedRows(ownerPartsOf(laptop as never, benefit as never), ownerPartsOf(advance as never, benefit as never)))
    const offered = entries.map((entry) => (entry.kind === 'row' ? ownerShareChangeOf(entry.row) : entry.kind === 'shared' ? ownerShareChangeOf(entry.whole) : entry.kind))

    expect(entries.map((entry) => entry.kind)).toEqual(['shared', 'row', 'row', 'shared', 'row', 'row'])
    expect(offered).toEqual([...Array(3).fill({ holder: 'ledger', id: 'ledger-row:shop' }), ...Array(3).fill({ holder: 'owner-advance', id: 'owner-advance:pens' })])
  })
})
