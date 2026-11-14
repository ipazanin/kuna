import { describe, expect, it } from 'vitest'

import { rowDrill } from '../src/apps/company/filters/domain/drillTarget'
import { countedRowOf, latestBooked } from '../src/apps/company/transactions/domain/latestBooked'
import { bookingOrder } from '../src/apps/company/workbook/domain/bookingOrder'
import { splitLedger } from '../src/apps/company/workbook/domain/splits'
import { PACK_CATEGORIES } from './fixtures/hrDooCategories'
import { civil, euros, ledger } from './fixtures/ledger'
import { splitOf } from './fixtures/splits'

const GIVEN = ledger([
  { date: '2026-03-01', amount: 1000, category: 'revenue', counterparty: 'Client' },
  { date: '2026-03-09', amount: -60, category: 'office-supplies', counterparty: 'Paper shop' },
  { date: '2026-03-10', amount: -25, category: 'travel', account: 'main', counterparty: 'Rail' },
  { date: '2026-03-10', amount: -8, category: 'travel', account: 'savings', counterparty: 'Bus' },
  { date: '2026-03-10', amount: 300, category: 'revenue', account: 'main', counterparty: 'Second client' },
])
const ROWS = bookingOrder(GIVEN).entries.map((row, position) => ({ ...row, sequence: position + 1 }))

const ORDER = ROWS.find((row) => row.amount === euros(-60))!
const COUNTED = splitLedger(ROWS, [
  splitOf(
    ORDER,
    [
      [-15, 'owner-loan-out', 'The owner’s pens'],
      [-45, 'office-supplies', 'Paper'],
    ],
    PACK_CATEGORIES,
  ),
])

describe('the newest rows as booked', () => {
  it('lists by booking order, which runs through a day account by account', () => {
    expect(latestBooked(ROWS, 4).map((row) => row.counterparty)).toEqual(['Bus', 'Second client', 'Rail', 'Paper shop'])
  })

  it('keeps a split row whole, at the amount the bank booked', () => {
    expect(latestBooked(ROWS, 5).find((row) => row.counterparty === 'Paper shop')?.amount).toEqual(euros(-60))
  })

  it('lists every row of a book shorter than the count', () => {
    expect(latestBooked(ROWS, 10)).toHaveLength(5)
  })
})

describe('the row Transactions lists for a row as booked', () => {
  it('is the row itself when it is not split', () => {
    const rail = ROWS.find((row) => row.counterparty === 'Rail')!

    expect(countedRowOf(rail, COUNTED)).toBe(rail)
  })

  it('is the largest part of a split row, which its drill finds by day, category and amount', () => {
    const part = countedRowOf(ORDER, COUNTED)!

    expect([part.amount, part.category]).toEqual([euros(-45), 'office-supplies'])
    expect(rowDrill(part).filters).toEqual({
      period: { preset: 'custom', range: { from: civil('2026-03-09'), to: civil('2026-03-09') } },
      categories: ['office-supplies'],
      amount: { min: euros(-45), max: euros(-45) },
    })
  })

  it('is null for a row the counted rows leave out', () => {
    expect(countedRowOf(ORDER, [])).toBeNull()
  })
})
