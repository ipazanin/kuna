import { describe, expect, it } from 'vitest'

import { incomeByMonth, incomeByYear } from '../src/apps/investments/income/domain/incomeHistory'
import type { Income } from '../src/apps/investments/workbook/domain/income'
import type { PercentQuoting } from '../src/apps/investments/workbook/domain/instrument'
import type { Trade } from '../src/apps/investments/workbook/domain/trade'
import { EURO } from '../src/shared/money/currencyCode'
import { BROKER, STOCK_B, book, cashMovement, decimal, dividend, instrument, trade, workedPortfolio } from './fixtures/investments'
import { civil, euros } from './fixtures/ledger'

const TODAY = civil('2026-10-29')

describe("the worked portfolio's income", () => {
  it('gives 2025 €8.55 gross, €2.57 withheld and €5.98 received, all of it dividends', () => {
    // $10.00 gross at 1.17 is €8.55, the $7.00 received is €5.98, so €2.57 was withheld.
    const amounts = { gross: euros(8.55), withheld: euros(2.57), received: euros(5.98) }
    expect(incomeByYear(workedPortfolio(), TODAY)).toEqual([{ year: 2025, groups: [{ group: 'dividends', ...amounts }], total: amounts }])
  })

  it('received €5.98 in September 2025 and nothing in the months from then to October 2026', () => {
    const months = incomeByMonth(workedPortfolio(), TODAY)
    expect(months[0]).toEqual({ month: '2025-09', received: euros(5.98) })
    expect(months.at(-1)).toEqual({ month: '2026-10', received: euros(0) })
    expect(months).toHaveLength(14)
    expect(months.slice(1).every((month) => month.received === 0)).toBe(true)
  })
})

describe('income by year', () => {
  const interest = (date: string, gross: string): Income => ({ ...dividend(BROKER, instrument('cash'), date, gross, '0'), instrument: null, kind: 'interest', currency: EURO })

  it('groups a coupon with interest and lists the years newest first, a payment after the day left out', () => {
    const records = workedPortfolio()
    const later: Income[] = [interest('2026-03-02', '3.15'), { ...interest('2026-05-04', '1.20'), kind: 'other' }, interest('2026-11-02', '9.00')]
    const years = incomeByYear({ ...records, income: [...records.income, ...later] }, TODAY)
    expect(years.map((year) => year.year)).toEqual([2026, 2025])
    expect(years[0]?.groups.map((group) => [group.group, group.received])).toEqual([
      ['interest', euros(3.15)],
      ['other', euros(1.2)],
    ])
    expect(years[0]?.total).toEqual({ gross: euros(4.35), withheld: euros(0), received: euros(4.35) })
  })

  it('counts stock lending and a referral credit as other income', () => {
    const records = workedPortfolio()
    const later: Income[] = [
      { ...interest('2026-05-04', '1.20'), kind: 'lending' },
      { ...interest('2026-06-01', '10.00'), kind: 'referral' },
    ]
    const [year] = incomeByYear({ ...records, income: [...records.income, ...later] }, TODAY)
    expect(year?.groups.map((group) => [group.group, group.received])).toEqual([['other', euros(11.2)]])
  })

  it("leaves out the part of a coupon that paid back the accrued interest bought with the bond, as the Overview's income does", () => {
    const terms: PercentQuoting = { kind: 'percent', coupon: decimal('3'), maturity: civil('2029-03-15') }
    const bond = instrument('bond', { name: 'State bond 2029', class: 'bonds', quoted: terms, prices: 'manual', sourceSymbol: '' })
    const buy: Trade = { ...trade('buy', BROKER, bond, '2026-09-15', '1000', '98.5', null), accrued: decimal('15.12') }
    const coupon: Income = { ...dividend(BROKER, bond, '2027-03-15', '30', '0'), kind: 'coupon' }
    const records = book({ accounts: [BROKER], instruments: [bond], cashMovements: [cashMovement('deposit', BROKER, '2026-09-15', '1000.12')], trades: [buy], income: [coupon] })
    // €30.00 less the €15.12 of accrued interest the buy paid.
    expect(incomeByYear(records, civil('2027-04-01'))[0]?.groups).toEqual([{ group: 'interest', gross: euros(14.88), withheld: euros(0), received: euros(14.88) }])
    expect(incomeByMonth(records, civil('2027-04-01'))).toEqual([
      { month: '2027-03', received: euros(14.88) },
      { month: '2027-04', received: euros(0) },
    ])
  })

  it('has nothing for a file without income', () => {
    const records = { ...workedPortfolio(), income: [] }
    expect(incomeByYear(records, TODAY)).toEqual([])
    expect(incomeByMonth(records, TODAY)).toEqual([])
  })

  it('takes a reversal off the month and the year it is booked in', () => {
    const records = workedPortfolio()
    const reversal = { ...dividend(BROKER, STOCK_B, '2025-10-01', '-10', '-3', '1.17'), id: dividend(BROKER, STOCK_B, '2025-10-02', '0', '0').id }
    const withReversal = { ...records, income: [...records.income, reversal] }
    expect(incomeByYear(withReversal, TODAY)[0]?.total).toEqual({ gross: euros(0), withheld: euros(0), received: euros(0) })
    expect(incomeByMonth(withReversal, TODAY)[1]).toEqual({ month: '2025-10', received: euros(-5.98) })
  })
})
