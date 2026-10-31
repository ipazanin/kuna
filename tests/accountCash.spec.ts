import { describe, expect, it } from 'vitest'

import { accountCash } from '../src/apps/investments/holdings/domain/accountCash'
import type { AccountCash } from '../src/apps/investments/holdings/domain/accountCash'
import { EURO } from '../src/shared/money/currencyCode'
import { decimalText } from '../src/shared/money/decimal'
import type { RecordId } from '../src/shared/storage/domain/recordId'
import {
  BROKER,
  GBP,
  STOCK_B,
  USD,
  WORKED_RATES,
  WORLD_ETF,
  account,
  book,
  cashMovement,
  cashTransfer,
  decimal,
  exchange,
  rateBookOf,
  spinOff,
  split,
  trade,
  unitTransfer,
  workedPortfolio,
} from './fixtures/investments'

function balancesOf(cash: AccountCash): [string, string, string, number][] {
  return cash.balances.map((balance) => [balance.account, balance.currency, decimalText(balance.balance), balance.eurosIn / 100])
}

const NO_RATES = rateBookOf(new Map())
const NONE_REFUSED: ReadonlySet<RecordId> = new Set()

describe("an account's cash", () => {
  it('moves with every record of the worked portfolio, and the dollars keep the euros they came in at', () => {
    // Euros: 3,000.00 deposited − 1,002.00 for World ETF − 1,000.00 exchanged − 552.00 for World ETF = 446.00.
    // Dollars: 1,050.00 bought for €1,000.00, − 1,001.00 for Stock B at 1.05 (€953.33), + 7.00 of dividend after
    // 3.00 withheld at 1.17 (€5.98), + 299.00 from the sale at 1.18 (€253.39) = 355.00, which came in at €306.04.
    expect(balancesOf(accountCash(workedPortfolio(), WORKED_RATES, NONE_REFUSED))).toEqual([
      [BROKER.id, 'EUR', '446', 446],
      [BROKER.id, 'USD', '355', 306.04],
    ])
  })

  it('takes fees and adds refunds, and leaves an exchange fee inside the amounts as booked', () => {
    const records = book({
      accounts: [BROKER],
      cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '600'), cashMovement('fee', BROKER, '2026-02-01', '3'), cashMovement('fee-refund', BROKER, '2026-03-01', '1.5')],
      exchanges: [exchange(BROKER, '2026-04-01', '500', EURO, '540', USD, { amount: decimal('2'), currency: EURO })],
    })

    // 600.00 − 3.00 + 1.50 − 500.00 = 98.50. The €2.00 fee is already off the $540.00, so nothing more moves for it.
    expect(balancesOf(accountCash(records, NO_RATES, NONE_REFUSED))).toEqual([
      [BROKER.id, 'EUR', '98.5', 98.5],
      [BROKER.id, 'USD', '540', 500],
    ])
  })

  it('moves cash between accounts at the ECB rate of the day, so the euros in move with it and add up the same', () => {
    const other = account('other')
    const rates = rateBookOf(new Map([[USD, [['2026-05-04', '1.1']] as const]]))
    const records = book({
      accounts: [BROKER, other],
      cashMovements: [cashMovement('deposit', BROKER, '2026-05-01', '220', USD, '1.1')],
      transfers: [cashTransfer(BROKER, other, '2026-05-05', USD, '100')],
    })

    // $220.00 at 1.10 came in at €200.00. $100.00 moves at 1.10, the rate on or before 5 May, so €90.91 with it.
    expect(balancesOf(accountCash(records, rates, NONE_REFUSED))).toEqual([
      [BROKER.id, 'USD', '120', 109.09],
      [other.id, 'USD', '100', 90.91],
    ])
  })

  it('gives both legs of an exchange between two foreign currencies the euros of the sold leg at the ECB rate', () => {
    const rates = rateBookOf(new Map([[USD, [['2026-06-01', '1.1']] as const]]))
    const records = book({
      accounts: [BROKER],
      cashMovements: [cashMovement('deposit', BROKER, '2026-05-04', '110', USD, '1.1')],
      exchanges: [exchange(BROKER, '2026-06-01', '110', USD, '85', GBP)],
    })

    // $110.00 at 1.10 is €100.00, which leaves the dollars and comes in with the £85.00.
    expect(balancesOf(accountCash(records, rates, NONE_REFUSED))).toEqual([
      [BROKER.id, 'GBP', '85', 100],
      [BROKER.id, 'USD', '0', 0],
    ])
  })

  it('names a transfer the ECB series has no rate for yet and still moves its cash', () => {
    const other = account('other')
    const transfer = cashTransfer(BROKER, other, '2026-05-05', USD, '100')
    const cash = accountCash(book({ accounts: [BROKER, other], transfers: [transfer] }), NO_RATES, NONE_REFUSED)

    expect(balancesOf(cash)).toEqual([
      [BROKER.id, 'USD', '-100', 0],
      [other.id, 'USD', '100', 0],
    ])
    expect(cash.unrated).toEqual([transfer.id])
  })

  it('moves no cash for a sale the lots refused', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [WORLD_ETF],
      cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '1000')],
      trades: [trade('buy', BROKER, WORLD_ETF, '2026-01-05', '10', '100', '0'), trade('sell', BROKER, WORLD_ETF, '2026-02-02', '12', '110', '0')],
    })

    // Without the refusal the 1,320.00 of the sale would come in while the 10 units stayed held.
    expect(balancesOf(accountCash(records, NO_RATES, new Set([records.trades[1]!.id])))).toEqual([[BROKER.id, 'EUR', '0', 0]])
  })

  it('lets a balance fall below zero, which points at a missing deposit', () => {
    const records = book({ accounts: [BROKER], instruments: [WORLD_ETF], trades: [trade('buy', BROKER, WORLD_ETF, '2026-01-05', '2', '100', '1')] })

    expect(balancesOf(accountCash(records, NO_RATES, NONE_REFUSED))).toEqual([[BROKER.id, 'EUR', '-201', -201]])
  })

  it('moves the worth of a fractional quantity to the cent, as the broker books it, so no sliver of a cent stays', () => {
    const records = book({
      accounts: [BROKER],
      instruments: [WORLD_ETF],
      cashMovements: [cashMovement('deposit', BROKER, '2026-01-05', '20.02')],
      trades: [trade('buy', BROKER, WORLD_ETF, '2026-01-05', '6', '1.666666666667', '0'), trade('buy', BROKER, WORLD_ETF, '2026-01-06', '0.123', '81.41', '0.01')],
    })

    // 6 × 1.666666666667 = 10.000000000002 is booked as 10.00, and 0.123 × 81.41 = 10.01343 as 10.01 with 0.01 of fees.
    // Exact to twelve places the balance would be 20.02 − 10.000000000002 − 10.02343 = −0.003430000002.
    expect(balancesOf(accountCash(records, NO_RATES, NONE_REFUSED))).toEqual([[BROKER.id, 'EUR', '0', 0]])
  })

  it('moves no cash for a split, a spin-off or a transfer of units', () => {
    const other = account('other')
    const records = book({
      accounts: [BROKER, other],
      instruments: [WORLD_ETF, STOCK_B],
      splits: [split(WORLD_ETF, '2026-01-05', 2, 1)],
      spinOffs: [spinOff(WORLD_ETF, STOCK_B, '2026-02-02', '1', '0.1')],
      transfers: [unitTransfer(BROKER, other, '2026-03-02', WORLD_ETF, '1')],
    })

    expect(accountCash(records, NO_RATES, NONE_REFUSED).balances).toEqual([])
  })
})
