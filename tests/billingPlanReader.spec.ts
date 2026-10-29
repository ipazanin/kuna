import { describe, expect, it } from 'vitest'

import { BILLING_RECORDS } from '../src/apps/company/workbook/domain/coreKinds'
import { readSnapshot } from '../src/apps/company/workbook/infrastructure/spreadsheetTab'
import { EMPTY_TABS, sheetRowsFromValues } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import type { CellValue } from '../src/apps/company/workbook/infrastructure/workbookSnapshot'
import { withIds } from './fixtures/rowIds'
import { recordIdOf } from '../src/shared/storage/domain/recordId'

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
  return readSnapshot({
    meta: { id: 'sheet', source: 'browser', title: 'Books', syncedAt: '2026-10-19T08:00:00.000Z', lastExportedAt: null, unexportedSince: null },
    ...EMPTY_TABS,
    clients: sheetRowsFromValues(clients),
    'outgoing-plan': sheetRowsFromValues(withIds('item', plan)),
  }).workbook
}

describe('the outgoing-plan tab', () => {
  const header: CellValue[] = ['item', 'date', 'amount', 'client', 'description']

  it('reads each row with its amount in cents, the client in lower case and its sheet row', () => {
    const workbook = workbookWith([
      header,
      ['Hotel', DAY['2025-12-10'], 480.2, 'North', 'Hotel for the client visit'],
      ['Bonus', DAY['2026-01-01'], (10000 * 5) / 12, 'north', 'Bonus for five months'],
      ['Monthly Fee', DAY['2026-01-31'], 5000, 'north'],
    ])

    expect(workbook.billingPlan).toEqual([
      { item: 'Hotel', date: '2025-12-10', amount: 48020, client: 'north', description: 'Hotel for the client visit', id: recordIdOf(BILLING_RECORDS, 'item-2') },
      { item: 'Bonus', date: '2026-01-01', amount: 416667, client: 'north', description: 'Bonus for five months', id: recordIdOf(BILLING_RECORDS, 'item-3') },
      { item: 'Monthly Fee', date: '2026-01-31', amount: 500000, client: 'north', description: '', id: recordIdOf(BILLING_RECORDS, 'item-4') },
    ])
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
    expect(workbook.problems.map((problem) => [problem.tab, problem.label, problem.reason])).toEqual([
      ['outgoing-plan', 'north, 2025-12-31, 5000', 'no item'],
      ['outgoing-plan', 'Monthly Fee, north, December, 5000', 'date "December" is not a date cell'],
      ['outgoing-plan', 'Monthly Fee, north, 2025-12-31, five thousand', 'amount "five thousand" is not a number'],
      ['outgoing-plan', 'Monthly Fee, north, 2025-12-31, 0', 'amount must be more than zero'],
      ['outgoing-plan', 'Monthly Fee, 2025-12-31, 5000', 'no client'],
      ['outgoing-plan', 'Monthly Fee, north, 5000', 'no date'],
      ['outgoing-plan', 'Monthly Fee, south, 2025-12-31, 5000', '"south" is not on the clients tab'],
    ])
  })
})
