import { describe, expect, it } from 'vitest'

import { latestBalances } from '../src/features/cash/domain/balances'
import { presentedWorkbook } from '../src/features/transactions/application/presentedWorkbook'
import { listedRows, withSplitHeadings } from '../src/features/transactions/domain/listedRows'
import { bucketTotals } from '../src/features/workbook/domain/bucketTotals'
import { listedRowKey, splitLedger } from '../src/features/workbook/domain/splits'
import type { Category, PrivateShareToMove } from '../src/features/workbook/domain/workbook'
import { readSplits } from '../src/features/workbook/infrastructure/splitsTabReader'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue, WorkbookSnapshot } from '../src/features/workbook/infrastructure/workbookSnapshot'
import { countedSplits, privateShareCandidates } from '../src/packs/hr-doo/domain/countedSplits'
import { owedByOwnerOn } from '../src/packs/hr-doo/domain/dividend/owedByOwner'
import { accrualYear } from '../src/packs/hr-doo/domain/accrual/accrualYear'
import { compareYearEnd } from '../src/packs/hr-doo/domain/yearEnd/yearEndComparison'
import { STUDIO_CATEGORIES, STUDIO_ROWS, exampleStudio, yearEndLine } from './fixtures/exampleStudio'
import { PACK_CATEGORIES, withPackBuckets } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import { splitOf } from './fixtures/splits'

const ROWS = withPackBuckets(
  ledger([
    { date: '2026-03-01', amount: 1000, category: 'revenue' },
    { date: '2026-03-09', amount: -60, category: 'office-supplies', counterparty: 'Paper shop', description: 'Order 77' },
    { date: '2026-03-10', amount: -25, category: 'travel' },
  ]),
)

const ORDER = ROWS.find((row) => row.amount === euros(-60))!

describe('splitLedger', () => {
  it('puts the parts where the row stood, each with the row’s day, account, balance, order and text, and its own amount and category', () => {
    const split = splitOf(ORDER, [[-45, 'office-supplies', 'Paper'], [-15, 'owner-loan-out', 'The owner’s pens']], PACK_CATEGORIES)
    const presented = splitLedger(ROWS, [split])

    expect(presented.map((row) => [row.date, row.amount, row.category, row.bucket])).toEqual([
      [civil('2026-03-10'), euros(-25), 'travel', 'operating'],
      [civil('2026-03-09'), euros(-45), 'office-supplies', 'operating'],
      [civil('2026-03-09'), euros(-15), 'owner-loan-out', 'owner-pay'],
      [civil('2026-03-01'), euros(1000), 'revenue', 'income'],
    ])
    const [paper, pens] = presented.filter((row) => row.split !== undefined)
    expect([paper!.balance, paper!.sequence, paper!.sheetRow, paper!.reference, paper!.counterparty, paper!.description]).toEqual([
      ORDER.balance,
      ORDER.sequence,
      ORDER.sheetRow,
      ORDER.reference,
      'Paper shop',
      'Order 77',
    ])
    expect(pens!.split).toEqual({ whole: ORDER, index: 1, count: 2, note: 'The owner’s pens', sheetRow: 3 })
    expect(presented.map(listedRowKey)).toEqual(['2', '3.0', '3.1', '4'])
  })

  it('leaves balances and the totals of the row alone, and moves only what the parts move between buckets', () => {
    const presented = splitLedger(ROWS, [splitOf(ORDER, [[-45, 'office-supplies'], [-15, 'owner-loan-out']], PACK_CATEGORIES)])

    expect(latestBalances(presented).cashOnHand.amount).toBe(latestBalances(ROWS).cashOnHand.amount)
    expect(bucketTotals(ROWS)).toMatchObject({ operating: euros(85), ownerPay: euros(0) })
    expect(bucketTotals(presented)).toMatchObject({ operating: euros(70), ownerPay: euros(15), cost: euros(85) })
  })

  it('returns the ledger itself when nothing is split', () => {
    expect(splitLedger(ROWS, [])).toBe(ROWS)
  })
})

const CATEGORIES: readonly Category[] = PACK_CATEGORIES
const SPLIT_HEADER = ['date', 'account', 'row_amount', 'row_balance', 'amount', 'category', 'note']
/** 2026-03-09, the order of 60.00 that left 940.00 on the account. */
const KEY: CellValue[] = [46090, 'main', -60, 940]

function read(...rows: CellValue[][]) {
  return readSplits(sheetRowsFromValues([SPLIT_HEADER, ...rows]), ROWS, CATEGORIES)
}

function reasons(reading: ReturnType<typeof read>): string[] {
  return reading.problems.map((problem) => `${problem.sheetRow}: ${problem.reason}`)
}

describe('readSplits', () => {
  it('reads the parts of one row as its split, by date, account, row amount and row balance', () => {
    const reading = read([...KEY, -45, 'Office-Supplies', 'Paper'], [...KEY, -15, 'owner-loan-out', ''])

    expect(reading.problems).toEqual([])
    expect(reading.splits).toEqual([
      {
        row: ORDER,
        parts: [
          { amount: euros(-45), category: 'office-supplies', family: 'operating', bucket: 'operating', note: 'Paper', sheetRow: 2 },
          { amount: euros(-15), category: 'owner-loan-out', family: 'owner-pay', bucket: 'owner-pay', note: '', sheetRow: 3 },
        ],
      },
    ])
  })

  it('refuses a key that finds no ledger row, and every row of that split', () => {
    const reading = read([46090, 'main', -60, 900, -45, 'office-supplies'], [46090, 'main', -60, 900, -15, 'travel'])

    expect(reading.splits).toEqual([])
    expect(reasons(reading)).toEqual([
      '2: the ledger holds no main row of 2026-03-09 with the amount -60.00 and the balance 900.00, so the ledger row counts whole',
      '3: the ledger holds no main row of 2026-03-09 with the amount -60.00 and the balance 900.00, so the ledger row counts whole',
    ])
  })

  it('refuses a key that finds two ledger rows', () => {
    const twins = withPackBuckets(
      ledger([
        { date: '2026-03-09', amount: -60, balance: 940, category: 'office-supplies' },
        { date: '2026-03-09', amount: -60, balance: 940, category: 'office-supplies' },
      ]),
    )
    const reading = readSplits(sheetRowsFromValues([SPLIT_HEADER, [...KEY, -45, 'office-supplies'], [...KEY, -15, 'travel']]), twins, CATEGORIES)

    expect(reading.splits).toEqual([])
    expect(reading.problems[0]?.reason).toBe(
      '2 ledger rows are the main row of 2026-03-09 with the amount -60.00 and the balance 940.00 (rows 2, 3), so the ledger row counts whole',
    )
  })

  it('refuses a split with one part, a part of zero and a part with the other sign', () => {
    expect(reasons(read([...KEY, -60, 'office-supplies']))).toEqual(['2: a split has at least two parts, and this one has one, so the ledger row counts whole'])
    expect(reasons(read([...KEY, -60, 'office-supplies'], [...KEY, 0, 'travel']))[0]).toBe('2: the part on row 3 is zero, so the ledger row counts whole')
    expect(reasons(read([...KEY, -70, 'office-supplies'], [...KEY, 10, 'travel']))[1]).toBe(
      '3: the part on row 3 has the other sign to the row, so the ledger row counts whole',
    )
  })

  it('refuses parts that do not add up to the row', () => {
    expect(reasons(read([...KEY, -45, 'office-supplies'], [...KEY, -10, 'travel']))).toEqual([
      '2: the parts add up to -55.00 and the row is -60.00, so the ledger row counts whole',
      '3: the parts add up to -55.00 and the row is -60.00, so the ledger row counts whole',
    ])
  })

  it('refuses a part whose category is blank or not on the categories tab', () => {
    expect(reasons(read([...KEY, -45, 'office-supplies'], [...KEY, -15, 'snacks']))[0]).toBe(
      '2: "snacks" on row 3 is not on the categories tab, so the ledger row counts whole',
    )
    expect(reasons(read([...KEY, -45, 'office-supplies'], [...KEY, -15, '']))[0]).toBe('2: the part on row 3 has no category, so the ledger row counts whole')
  })

  it('reports a row it cannot read, and refuses the rest of its split for it', () => {
    expect(reasons(read([...KEY, -45, 'office-supplies'], [...KEY, 'fifteen', 'travel']))).toEqual([
      '2: row 3 of this split cannot be read, so the ledger row counts whole',
      '3: amount "fifteen" is not a number',
    ])
    expect(reasons(read(['yesterday', 'main', -60, 940, -45, 'travel']))).toEqual(['2: date "yesterday" is not a date cell'])
  })

  it('counts a refused split’s row whole in the workbook, and keeps the splits that pass', () => {
    const workbook = readWorkbook(snapshotOf([[...KEY, -45, 'office-supplies'], [...KEY, -10, 'travel'], [46091, 'main', -25, 915, -20, 'travel'], [46091, 'main', -25, 915, -5, 'office-supplies']]))
    const presented = presentedWorkbook(workbook)

    expect(workbook.splits.map((split) => split.row.amount)).toEqual([euros(-25)])
    expect(workbook.problems.map((problem) => [problem.tab, problem.sheetRow])).toEqual([
      ['splits', 2],
      ['splits', 3],
    ])
    expect(presented.transactions.map((row) => row.amount)).toEqual([euros(-20), euros(-5), euros(-60), euros(1000)])
  })
})

function snapshotOf(splits: CellValue[][], advances: CellValue[][] = [['date', 'amount', 'description', 'category']], assets: CellValue[][] = []): WorkbookSnapshot {
  return {
    meta: { id: 'books', source: 'excel', title: 'Books', syncedAt: '2026-10-16T08:00:00.000Z', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
    ledger: sheetRowsFromValues([
      ['date', 'account', 'description', 'amount', 'balance', 'category'],
      [46091, 'main', 'Train', -25, 915, 'travel'],
      [46090, 'main', 'Order 77', -60, 940, 'office-supplies'],
      [46082, 'main', 'Invoice', 1000, 1000, 'revenue'],
    ]),
    categories: sheetRowsFromValues([
      ['category', 'family', 'bucket', 'roles'],
      ...CATEGORIES.map((category): CellValue[] => [category.slug, category.family, category.bucket, category.roles.join(', ')]),
      ['equipment', 'operating', 'operating', 'capital-purchase'],
    ]),
    'owner-advances': sheetRowsFromValues(advances),
    assets: sheetRowsFromValues(assets),
    splits: sheetRowsFromValues([SPLIT_HEADER, ...splits]),
  }
}

describe('countedSplits', () => {
  it('refuses a split of a row an asset claims, so the row counts whole and the asset keeps its payment', () => {
    const workbook = readWorkbook(
      snapshotOf(
        [[...KEY, -45, 'office-supplies'], [...KEY, -15, 'travel']],
        undefined,
        [
          ['asset', 'bought', 'cost_net', 'group', 'ledger_reference'],
          ['Shredder', 46090, 48, 'equipment', 'Order 77'],
        ],
      ),
    )
    const counted = countedSplits(workbook)

    expect(workbook.splits).toHaveLength(1)
    expect(counted.splits).toEqual([])
    expect(counted.problems).toEqual([
      { tab: 'splits', sheetRow: 2, reason: '"Shredder" on the assets tab claims ledger row 3 as payment, so the row counts whole' },
      { tab: 'splits', sheetRow: 3, reason: '"Shredder" on the assets tab claims ledger row 3 as payment, so the row counts whole' },
    ])
    expect(presentedWorkbook(workbook).transactions.map((row) => row.amount)).toEqual([euros(-25), euros(-60), euros(1000)])
  })

  it('reads a private share still on the owner-advances tab as the split its move writes, on the bank row of its category a day later', () => {
    const workbook = readWorkbook(snapshotOf([], [['date', 'amount', 'description', 'category'], [46089, -15, 'The owner’s pens', 'office-supplies']]))
    const counted = countedSplits(workbook)

    expect(workbook.ownerAdvances).toEqual([])
    expect(counted.problems).toEqual([])
    expect(counted.splits.map((split) => [split.row.sheetRow, split.parts.map((part) => [part.amount, part.category, part.note, part.sheetRow])])).toEqual([
      [
        3,
        [
          [euros(-45), 'office-supplies', '', null],
          [euros(-15), 'owner-loan-out', 'The owner’s pens', null],
        ],
      ],
    ])
  })

  it('counts a private share nowhere when no single bank row matches it, or another share matches its row too', () => {
    const tooLate = readWorkbook(snapshotOf([], [['date', 'amount', 'description', 'category'], [46080, -15, 'Pens', 'office-supplies']]))
    const twice = readWorkbook(
      snapshotOf([], [['date', 'amount', 'description', 'category'], [46089, -15, 'Pens', 'office-supplies'], [46090, -5, 'Ink', 'office-supplies']]),
    )

    expect(countedSplits(tooLate).splits).toEqual([])
    expect(countedSplits(tooLate).problems[0]?.reason).toBe(
      'no ledger row in office-supplies within 3 days of 2026-02-27 paid more than the share, so it counts nowhere until it is split by hand on Transactions',
    )
    expect(countedSplits(twice).splits).toEqual([])
    expect(countedSplits(twice).problems.map((problem) => problem.sheetRow)).toEqual([2, 3])
  })

  it('offers no bank row a split already holds or an asset claims', () => {
    const share: PrivateShareToMove = { date: civil('2026-03-08'), amount: euros(15), description: 'Pens', category: 'office-supplies', sheetRow: 2 }
    const split = readWorkbook(snapshotOf([[...KEY, -45, 'office-supplies'], [...KEY, -15, 'travel']]))

    expect(privateShareCandidates(readWorkbook(snapshotOf([])), share).map((row) => row.sheetRow)).toEqual([3])
    expect(privateShareCandidates(split, share)).toEqual([])
  })
})

describe('the move of a private share and the split of a salary, on a company of the same shape', () => {
  // A 60.00 order on 9 August with a private 12.50 in it, which the owner repaid on 5 September,
  // and a July salary of 2,000.00 for June with an 800.00 bonus in it.
  const categories: readonly Category[] = [
    ...STUDIO_CATEGORIES,
    { slug: 'office-supplies', family: 'operating', bucket: 'operating', colour: '', roles: [], vat: 'deductible-25' },
    { slug: 'private-cost-for-owner', family: 'owner-pay', bucket: 'owner-pay', colour: '', roles: ['owner-loan-out'], vat: 'none' },
    { slug: 'reimbursement-from-owner', family: 'financing', bucket: 'financing', colour: '', roles: ['reimbursement'], vat: 'none' },
    { slug: 'salary-bonus', family: 'owner-pay', bucket: 'owner-pay', colour: '', roles: [], vat: 'none' },
  ]
  const rows = withPackBuckets(
    ledger([
      ...STUDIO_ROWS,
      { date: '2025-07-10', amount: -2000, category: 'salary-net', description: 'June salary' },
      { date: '2025-08-09', amount: -60, category: 'office-supplies', description: 'Online order' },
      { date: '2025-09-05', amount: 12.5, category: 'reimbursement-from-owner' },
    ]),
    categories,
  )
  const order = rows.find((row) => row.description === 'Online order')!
  const salary = rows.find((row) => row.description === 'June salary')!
  const share: PrivateShareToMove = { date: civil('2025-08-08'), amount: euros(12.5), description: 'Private item', category: 'office-supplies', sheetRow: 2 }
  const moved = splitOf(order, [[-47.5, 'office-supplies'], [-12.5, 'private-cost-for-owner', 'Private item']], categories)
  const bonus = splitOf(salary, [[-1200, 'salary-net'], [-800, 'salary-bonus']], categories)

  const before = presentedWorkbook(exampleStudio({ categories, transactions: rows, privateSharesToMove: [share] }))
  const after = presentedWorkbook(exampleStudio({ categories, transactions: rows, splits: [moved] }))
  const withBonus = presentedWorkbook(exampleStudio({ categories, transactions: rows, splits: [moved, bonus] }))
  const newest = civil('2026-04-30')
  const profitBeforeTax = (workbook: typeof before) => accrualYear(workbook, 2025, { depreciation: workbook.settings.companyFacts, citAdvancesPaid: null }).bridge.profitBeforeTax.amount

  it('keeps net owed, today and at the year end, the profit before tax and the cash on hand when the share moves', () => {
    expect(owedByOwnerOn(after, newest).amount).toBe(owedByOwnerOn(before, newest).amount)
    expect(owedByOwnerOn(after, civil('2025-12-31')).amount).toBe(owedByOwnerOn(before, civil('2025-12-31')).amount)
    expect(profitBeforeTax(after)).toBe(profitBeforeTax(before))
    expect(latestBalances(after.transactions).cashOnHand.amount).toBe(latestBalances(before.transactions).cashOnHand.amount)
    expect(after.transactions.filter((row) => row.category === 'private-cost-for-owner').map((row) => row.amount)).toEqual([euros(-12.5)])
  })

  it('still closes the year with the salary split, since a bonus paid in July for June stays in the year', () => {
    const pbt = profitBeforeTax(withBonus)
    const comparison = compareYearEnd(exampleStudio({ categories, transactions: withBonus.transactions, yearEndLines: [yearEndLine(2025, 'pl', 'profit-before-tax', pbt / 100)] }), accrualYear(withBonus, 2025, { depreciation: withBonus.settings.companyFacts, citAdvancesPaid: null }))

    expect(pbt).toBe(profitBeforeTax(after))
    expect(comparison.lines.find((line) => line.line === 'profit-before-tax')?.status).not.toBe('open')
    expect(bucketTotals(withBonus.transactions.filter((row) => row.date.startsWith('2025'))).ownerPay).toBe(bucketTotals(after.transactions.filter((row) => row.date.startsWith('2025'))).ownerPay)
  })
})

describe('withSplitHeadings', () => {
  const presented = splitLedger(ROWS, [splitOf(ORDER, [[-45, 'office-supplies'], [-15, 'owner-loan-out']], PACK_CATEGORIES)])
  const advance = { date: civil('2026-03-09'), amount: euros(30), description: 'Train', category: 'travel', family: 'operating', bucket: 'operating' as const, sheetRow: 2 }

  it('lists a split row as the bank row with its parts under it, where its first part stood', () => {
    const listed = listedRows(presented, [advance])
    const byAmount = [...listed].sort((left, right) => left.amount - right.amount)

    expect(withSplitHeadings(byAmount).map((entry) => (entry.kind === 'split' ? `split ${entry.whole.amount}` : `${entry.row.kind} ${entry.row.amount}`))).toEqual([
      `split ${euros(-60)}`,
      `bank ${euros(-45)}`,
      `bank ${euros(-15)}`,
      `owner-advance ${euros(-30)}`,
      `bank ${euros(-25)}`,
      `bank ${euros(1000)}`,
    ])
    expect(new Set(listed.map((row) => row.key)).size).toBe(listed.length)
  })

  it('heads the one part a filter keeps with its bank row', () => {
    const entries = withSplitHeadings(listedRows(presented.filter((row) => row.category === 'owner-loan-out'), []))

    expect(entries.map((entry) => entry.kind)).toEqual(['split', 'row'])
    expect(entries[0]?.kind === 'split' && entries[0].parts.map((part) => part.split?.index)).toEqual([1])
  })
})
