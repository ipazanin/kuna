import { describe, expect, it } from 'vitest'

import { closedPositions, sortedPositions } from '../src/apps/investments/holdings/domain/closedPositions'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { BROKER, WORKED_PRICES, WORKED_RATES, book, cashMovement, decimal, dividend, instrument, priceBookOf, rateBookOf, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const RETIRED = instrument('retired', { name: 'Example Retired' })
const EARLIER = instrument('earlier', { name: 'Example Earlier' })

/** Two buys of one share, a dividend and a sale of all of it, and a second share bought and sold earlier at a loss. */
function retiredBook(): InvestmentBook {
  return book({
    accounts: [BROKER],
    instruments: [RETIRED, EARLIER],
    cashMovements: [cashMovement('deposit', BROKER, '2024-01-02', '2000')],
    trades: [
      trade('buy', BROKER, RETIRED, '2024-01-02', '10', '100', '2'),
      trade('buy', BROKER, RETIRED, '2024-07-01', '5', '110', '2'),
      trade('sell', BROKER, RETIRED, '2026-03-03', '15', '130', '3'),
      trade('buy', BROKER, EARLIER, '2025-01-06', '4', '50', '0'),
      trade('sell', BROKER, EARLIER, '2025-02-05', '4', '45', '0'),
    ],
    income: [dividend(BROKER, RETIRED, '2025-06-02', '6', '0')],
  })
}

function figuresOf(records: InvestmentBook): PortfolioFigures {
  return portfolioFigures({ book: records, prices: priceBookOf(new Map()), rates: rateBookOf(new Map()), today: civil('2026-10-29') })
}

describe('closed positions', () => {
  it('sums a share bought twice and sold in full, with its income and the days held weighted by units', () => {
    const [retired] = closedPositions(figuresOf(retiredBook()))

    // Cost 1,000.00 + 2.00 + 550.00 + 2.00, proceeds 15 × 130.00 − 3.00, so 1,947.00 − 1,554.00 = 393.00 realised.
    // 791 days for 10 units and 610 for 5 make (7,910 + 3,050) ÷ 15 = 730.7, so 731 days.
    expect(retired).toMatchObject({
      instrument: RETIRED,
      units: decimal('15'),
      cost: euros(1554),
      proceeds: euros(1947),
      realised: euros(393),
      income: euros(6),
      firstBought: civil('2024-01-02'),
      lastSold: civil('2026-03-03'),
      daysHeld: 731,
    })
    expect(retired?.realisedShare).toBeCloseTo(393 / 1554, 6)
  })

  it('lists the latest sold first and leaves out what is still held', () => {
    expect(closedPositions(figuresOf(retiredBook())).map((position) => [position.instrument.name, position.realised, position.daysHeld])).toEqual([
      ['Example Retired', euros(393), 731],
      ['Example Earlier', euros(-20), 30],
    ])
    expect(closedPositions(portfolioFigures({ book: workedPortfolio(), prices: WORKED_PRICES, rates: WORKED_RATES, today: civil('2026-10-29') }))).toEqual([])
  })

  it('sorts by a column either way, and keeps its own order with no sort', () => {
    const positions = closedPositions(figuresOf(retiredBook()))
    const names = (column: Parameters<typeof sortedPositions>[1]): string[] => sortedPositions(positions, column).map((position) => position.instrument.name)

    expect(names({ column: 'realised', descending: false })).toEqual(['Example Earlier', 'Example Retired'])
    expect(names({ column: 'name', descending: false })).toEqual(['Example Earlier', 'Example Retired'])
    expect(names({ column: 'held', descending: true })).toEqual(['Example Retired', 'Example Earlier'])
    expect(names(null)).toEqual(['Example Retired', 'Example Earlier'])
  })
})
