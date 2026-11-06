import { describe, expect, it } from 'vitest'

import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { matchingDeposit } from '../src/apps/investments/transactions/domain/matchingDeposit'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import { BROKER, STOCK_B, WORLD_ETF, book, decimal, priceBookOf, rateBookOf, trade } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const DAY = '2026-06-01'
const closes = priceBookOf(new Map([[WORLD_ETF, [[DAY, '125.00']]]]))

function valueOf(records: Parameters<typeof book>[0]): number {
  return portfolioFigures({ book: book(records), prices: closes, rates: rateBookOf(new Map()), today: civil(DAY) }).value
}

describe('the deposit that pays for a holding', () => {
  const buy = trade('buy', BROKER, WORLD_ETF, DAY, '10', '100.00', '2.00', null)
  const deposit = matchingDeposit(buy, WORLD_ETF, 'deposit-1' as RecordId, '')

  it('takes the buy down to zero cash, so the value is what the holding is worth', () => {
    expect(valueOf({ accounts: [BROKER], instruments: [WORLD_ETF], trades: [buy] })).toBe(euros(1250) - euros(1002))
    expect(valueOf({ accounts: [BROKER], instruments: [WORLD_ETF], trades: [buy], cashMovements: [deposit] })).toBe(euros(1250))
  })

  it('is a deposit into the account of the buy, on its day, of what the buy cost with its fees', () => {
    expect(deposit).toMatchObject({ account: BROKER.id, kind: 'deposit', date: DAY, amount: decimal('1002.00'), rate: null, importKey: null })
  })

  it('takes the currency and the rate of a foreign buy', () => {
    const foreign = trade('buy', BROKER, STOCK_B, DAY, '1', '50.00', '0.00', '1.10')
    expect(matchingDeposit(foreign, STOCK_B, 'deposit-2' as RecordId, 'paid')).toMatchObject({ currency: STOCK_B.currency, rate: foreign.rate, note: 'paid' })
  })
})
