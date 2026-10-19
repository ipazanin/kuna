import { describe, expect, it } from 'vitest'

import { createFakeSheets } from '../src/features/workbook/infrastructure/fake/fakeSheets'
import { fakeWorkbookValues } from '../src/features/workbook/infrastructure/fake/fakeWorkbook'
import { readSnapshotFrom } from '../src/features/workbook/infrastructure/googleWorkbookPorts'
import { readWorkbook } from '../src/features/workbook/infrastructure/workbookReader'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/features/workbook/infrastructure/workbookSnapshot'
import type { CellValue } from '../src/features/workbook/infrastructure/workbookSnapshot'

/** Serial numbers of the date cells the rows below use. */
const DAY = {
  '2025-12-10': 46001,
  '2025-12-31': 46022,
  '2026-01-01': 46023,
  '2026-01-31': 46053,
} as const

const CLIENTS: CellValue[][] = [
  ['client', 'name', 'iban'],
  ['north', 'North Ltd', 'XX00FAKE0000000000000101'],
]

function workbookWith(plan: CellValue[][], clients: CellValue[][] = CLIENTS) {
  return readWorkbook({
    meta: { id: 'sheet', source: 'excel', title: 'Books', syncedAt: '2026-10-19T08:00:00.000Z', ledgerSheetId: null, lastExportedAt: null, unexportedSince: null, missingTabs: [] },
    ...EMPTY_TABS,
    clients: sheetRowsFromValues(clients),
    'outgoing-plan': sheetRowsFromValues(plan),
  })
}

describe('the outgoing-plan tab', () => {
  const header: CellValue[] = ['item', 'date', 'amount', 'client', 'description', '', '', 'Constants', '']

  it('reads each row with its amount in cents, the client in lower case and its sheet row', () => {
    const workbook = workbookWith([
      header,
      ['Hotel', DAY['2025-12-10'], 480.2, 'North', 'Hotel for the client visit'],
      ['Bonus', DAY['2026-01-01'], 10000 * 5 / 12, 'north', 'Bonus for five months'],
      ['Monthly Fee', DAY['2026-01-31'], 5000, 'north'],
    ])

    expect(workbook.billingPlan).toEqual([
      { item: 'Hotel', date: '2025-12-10', amount: 48020, client: 'north', description: 'Hotel for the client visit', sheetRow: 2 },
      { item: 'Bonus', date: '2026-01-01', amount: 416667, client: 'north', description: 'Bonus for five months', sheetRow: 3 },
      { item: 'Monthly Fee', date: '2026-01-31', amount: 500000, client: 'north', description: '', sheetRow: 4 },
    ])
    expect(workbook.problems).toEqual([])
  })

  it('ignores the formula block beside the rows, also on rows that hold nothing else', () => {
    const workbook = workbookWith([
      header,
      ['Monthly Fee', DAY['2025-12-31'], 5000, 'north', 'December fee', '', '', 'Monthly Amount', 5000],
      ['', '', '', '', '', '', '', 'Sums'],
      ['', '', '', '', '', '', '', 'Total Amount', 5000],
    ])

    expect(workbook.billingPlan.map((row) => row.sheetRow)).toEqual([2])
    expect(workbook.problems).toEqual([])
  })

  it('leaves out a row it cannot bill and says why', () => {
    const workbook = workbookWith([
      header,
      ['', DAY['2025-12-31'], 5000, 'north'],
      ['Monthly Fee', 'December', 5000, 'north'],
      ['Monthly Fee', DAY['2025-12-31'], 'five thousand', 'north'],
      ['Monthly Fee', DAY['2025-12-31'], 0, 'north'],
      ['Monthly Fee', DAY['2025-12-31'], 5000, ''],
      ['Monthly Fee', DAY['2025-12-31'], 5000, 'south'],
      ['Monthly Fee', '', 5000, 'north'],
    ])

    expect(workbook.billingPlan).toEqual([])
    expect(workbook.problems.map((problem) => [problem.tab, problem.sheetRow, problem.reason])).toEqual([
      ['outgoing-plan', 2, 'no item'],
      ['outgoing-plan', 3, 'date "December" is not a date cell'],
      ['outgoing-plan', 4, 'amount "five thousand" is not a number'],
      ['outgoing-plan', 5, 'amount must be more than zero'],
      ['outgoing-plan', 6, 'no client'],
      ['outgoing-plan', 7, '"south" is not on the clients tab'],
      ['outgoing-plan', 8, 'no date'],
    ])
  })

  it('reads as empty from a Google Sheet without the tab, and is asked for by its quoted name when there is one', async () => {
    const { 'outgoing-plan': billingPlan, ...others } = fakeWorkbookValues('google')
    const without = createFakeSheets(others)
    const withTab = createFakeSheets({ ...others, 'outgoing-plan': billingPlan })

    const missing = await readSnapshotFrom(without, { id: 'sheet', name: 'Books' })
    const present = await readSnapshotFrom(withTab, { id: 'sheet', name: 'Books' })

    expect(missing.meta.missingTabs).toEqual(['outgoing-plan'])
    expect(readWorkbook(missing).billingPlan).toEqual([])
    expect(withTab.requests.find((request) => request.kind === 'batchGet')).toMatchObject({ ranges: expect.arrayContaining(["'outgoing-plan'"]) })
    expect(readWorkbook(present).billingPlan.length).toBeGreaterThan(15)
  })
})
