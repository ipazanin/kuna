import { describe, expect, it } from 'vitest'

import type { HoldingFigures } from '../src/apps/investments/holdings/domain/holding'
import { investmentLots } from '../src/apps/investments/holdings/domain/lots'
import { portfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import type { PortfolioFigures } from '../src/apps/investments/holdings/domain/portfolioFigures'
import { accruedInterest } from '../src/apps/investments/holdings/domain/quoting'
import type { Income } from '../src/apps/investments/workbook/domain/income'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import type { PercentQuoting } from '../src/apps/investments/workbook/domain/instrument'
import type { Trade } from '../src/apps/investments/workbook/domain/trade'
import { decimalText, inEuros } from '../src/shared/money/decimal'
import { BROKER, book, cashMovement, decimal, dividend, instrument, priceBookOf, rateBookOf, trade } from './fixtures/investments'
import type { CloseRow } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

/** The plan's bond, every figure made up: €1,000 nominal, 3% a year paid on 15 March, maturing 15 March 2029. */
const TERMS: PercentQuoting = { kind: 'percent', coupon: decimal('3'), maturity: civil('2029-03-15') }
const BOND = instrument('bond', { name: 'State bond 2029', class: 'bonds', quoted: TERMS, prices: 'manual', sourceSymbol: '' })
const GOLD = instrument('gold-bar', { name: 'Gold bar', class: 'gold', quoted: { kind: 'gram' }, prices: 'manual', sourceSymbol: '' })

const BOND_BUY: Trade = { ...trade('buy', BROKER, BOND, '2026-09-15', '1000', '98.5', null), accrued: decimal('15.12') }
const COUPON: Income = { ...dividend(BROKER, BOND, '2027-03-15', '30', '0'), kind: 'coupon' }

function bondBook(income: readonly Income[]): InvestmentBook {
  return book({ accounts: [BROKER], instruments: [BOND], cashMovements: [cashMovement('deposit', BROKER, '2026-09-15', '1000.12')], trades: [BOND_BUY], income })
}

function figuresOn(records: InvestmentBook, today: string, closes: ReadonlyMap<ReturnType<typeof instrument>, readonly CloseRow[]>): PortfolioFigures {
  return portfolioFigures({ book: records, prices: priceBookOf(closes), rates: rateBookOf(new Map()), today: civil(today) })
}

function holdingOf(figures: PortfolioFigures): HoldingFigures {
  return figures.holdings[0]!
}

describe('accrued interest', () => {
  it('runs from the last coupon day over the days of the coupon year', () => {
    // 15 Mar 2026 to 15 Sep 2026 is 184 days of the 365 to 15 Mar 2027: 1,000.00 × 3% × 184 ÷ 365 = 15.1233.
    const accrued = accruedInterest(decimal('1000'), TERMS, civil('2026-09-15'))
    expect(decimalText(accrued)).toBe('15.123287671233')
    expect(inEuros(accrued, null)).toBe(euros(15.12))
  })

  it('is nothing on a coupon day, which pays it, and from the maturity on', () => {
    expect(decimalText(accruedInterest(decimal('1000'), TERMS, civil('2027-03-15')))).toBe('0')
    expect(decimalText(accruedInterest(decimal('1000'), TERMS, civil('2029-03-15')))).toBe('0')
    expect(decimalText(accruedInterest(decimal('1000'), TERMS, civil('2030-01-01')))).toBe('0')
  })

  it('counts the coupon year it falls in, a leap year with 366 days', () => {
    // 15 Mar 2027 to 15 Mar 2028 holds 29 Feb 2028. To 16 Mar 2027 is one day: 30.00 × 1 ÷ 366 = 0.0820.
    expect(decimalText(accruedInterest(decimal('1000'), TERMS, civil('2027-03-16')))).toBe('0.081967213115')
  })

  it('accrues nothing on a treasury bill, which has no coupon', () => {
    expect(decimalText(accruedInterest(decimal('1000'), { ...TERMS, coupon: decimal('0') }, civil('2026-09-15')))).toBe('0')
  })
})

describe('a bond bought between coupons', () => {
  it('costs its nominal at the price in percent plus the accrued interest paid', () => {
    // 1,000.00 × 98.50 ÷ 100 = 985.00, plus 15.12 accrued = 1,000.12, which leaves the account's cash.
    const [lot] = investmentLots(bondBook([])).get(BOND.id)!.open
    expect(lot!.cost).toBe(euros(1000.12))
    expect(decimalText(lot!.costInCurrency)).toBe('1000.12')
    const figures = figuresOn(bondBook([]), '2026-10-29', new Map([[BOND, [['2026-10-29', '99']]]]))
    expect(figures.cash.map((balance) => decimalText(balance.balance))).toEqual(['0'])
    expect(holdingOf(figures).averageCost).toBe(decimal('100.012'))
  })

  it('is worth its nominal at the clean price plus the interest accrued to the close', () => {
    // 1,000.00 × 99.00 ÷ 100 = 990.00, plus 228 days of 365 from 15 Mar: 18.74, so 1,008.74 against a cost of 1,000.12.
    const holding = holdingOf(figuresOn(bondBook([]), '2026-10-29', new Map([[BOND, [['2026-10-29', '99']]]])))
    expect(holding.valuation!.value).toBe(euros(1008.74))
    expect(holding.unrealised).toBe(euros(8.62))
  })

  it('has the next coupon pay back the accrued interest off the cost, and only the rest is income', () => {
    // The 30.00 coupon: 15.12 comes off the cost, which falls to 985.00, and 30.00 − 15.12 = 14.88 is income.
    const records = bondBook([COUPON])
    const lots = investmentLots(records).get(BOND.id)!
    expect(lots.open[0]!.cost).toBe(euros(985))
    expect(lots.paidBack.get(COUPON.id)).toBe(euros(15.12))

    // On 16 Mar 2027 at 99.00: 990.00 + one day of 366 = 990.08, so 5.08 unrealised. Cash 30.00, value 1,020.08.
    const figures = figuresOn(records, '2027-03-16', new Map([[BOND, [['2027-03-16', '99']]]]))
    const holding = holdingOf(figures)
    expect(holding.income).toBe(euros(14.88))
    expect(holding.cost).toBe(euros(985))
    expect(holding.averageCost).toBe(decimal('98.5'))
    expect(holding.unrealised).toBe(euros(5.08))
    expect(figures.income).toEqual({ gross: euros(14.88), withheld: euros(0), received: euros(14.88) })
    expect(figures.value).toBe(euros(1020.08))
    expect(figures.totalGain).toBe(euros(19.96))
    expect(figures.totalGain).toBe(figures.unrealised + figures.income.received)
  })

  it('accrues the interest to the day valued, so a close from before the coupon does not count the interest it paid', () => {
    // A hand close of 99.00 on 1 Mar 2027 still values the bond on 16 Mar: 990.00 + one day of 366 = 990.08, beside the 30.00 coupon.
    const figures = figuresOn(bondBook([COUPON]), '2027-03-16', new Map([[BOND, [['2027-03-01', '99']]]]))
    expect(holdingOf(figures).valuation!.value).toBe(euros(990.08))
    expect(figures.value).toBe(euros(1020.08))
    expect(figures.totalGain).toBe(euros(19.96))
  })

  it('pays back only what was bought before the coupon day', () => {
    // A second 1,000.00 bought on the coupon day settles two days later, so its note charges 30.00 × 2 ÷ 366 = 0.16 of
    // accrued interest. That stays in its cost of 990.16 for the next coupon to pay back.
    const sameDay: Trade = { ...trade('buy', BROKER, BOND, '2027-03-15', '1000', '99', null), accrued: decimal('0.16') }
    const lots = investmentLots({ ...bondBook([COUPON]), trades: [BOND_BUY, sameDay] }).get(BOND.id)!
    expect(lots.open.map((lot) => lot.cost)).toEqual([euros(985), euros(990.16)])
    expect(lots.paidBack.get(COUPON.id)).toBe(euros(15.12))
  })

  it('pays back the share of a lot still held after part of it was sold', () => {
    // Half sold on 1 Dec 2026 at 99.00, 261 days after 15 Mar: 500.00 × 3% × 261 ÷ 365 = 10.73 accrued received.
    expect(inEuros(accruedInterest(decimal('500'), TERMS, civil('2026-12-01')), null)).toBe(euros(10.73))
    const sale: Trade = { ...trade('sell', BROKER, BOND, '2026-12-01', '500', '99', null), accrued: decimal('10.73') }
    const lots = investmentLots({ ...bondBook([COUPON]), trades: [BOND_BUY, sale] }).get(BOND.id)!
    // The sale: 495.00 + 10.73 = 505.73 against half the cost, 500.06, so 5.67 of gain. The half kept carries 7.56 of the accrued paid.
    expect(lots.sales[0]!.lines.map((line) => [line.cost, line.proceeds, line.gain])).toEqual([[euros(500.06), euros(505.73), euros(5.67)]])
    expect(lots.paidBack.get(COUPON.id)).toBe(euros(7.56))
    expect(lots.open[0]!.cost).toBe(euros(492.5))
  })
})

describe('physical gold', () => {
  it('holds grams bought per gram and values them at the troy ounce close ÷ 31.1034768', () => {
    // 1 gram at 80.00 with a 1.00 fee costs 81.00. 2,700.00 an ounce ÷ 31.1034768 = 86.807016 a gram, so 86.81, 5.81 up.
    const records = book({ accounts: [BROKER], instruments: [GOLD], trades: [trade('buy', BROKER, GOLD, '2026-10-01', '1', '80', '1')] })
    const holding = holdingOf(figuresOn(records, '2026-10-29', new Map([[GOLD, [['2026-10-29', '2700']]]])))
    expect(decimalText(holding.valuation!.price)).toBe('86.807015735296')
    expect(holding.valuation!.value).toBe(euros(86.81))
    expect(holding.cost).toBe(euros(81))
    expect(holding.averageCost).toBe(decimal('81'))
    expect(holding.unrealised).toBe(euros(5.81))
  })
})
