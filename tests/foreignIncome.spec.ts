import { describe, expect, it } from 'vitest'

import { foreignIncomeYear } from '../src/apps/investments/tax/domain/foreignIncome'
import type { ForeignPayment, IncomeTax } from '../src/apps/investments/tax/domain/foreignIncome'
import type { Income } from '../src/apps/investments/workbook/domain/income'
import type { InvestmentBook } from '../src/apps/investments/workbook/domain/investmentBook'
import { EURO, currencyCodeOf } from '../src/shared/money/currencyCode'
import { BROKER, USD, decimal, dividend, instrument } from './fixtures/investments'
import { DIVIDEND_CO, EXAMPLE_RATES, WORLD, exampleYear, payment } from './fixtures/taxExample'

function amounts(tax: IncomeTax | null): number[] | null {
  return tax === null ? null : [tax.gross, tax.withheld, tax.croatian, tax.credit, tax.leftToPay, tax.lost].map((cents) => cents / 100)
}

function withIncome(records: InvestmentBook, income: readonly Income[]): InvestmentBook {
  return { ...records, income: [...records.income, ...income] }
}

function row(entry: ForeignPayment): [string, string, number[] | null, string | null] {
  return [entry.payment.date, entry.route, amounts(entry.tax), entry.due]
}

describe("a year's foreign income", () => {
  it('works out each payment of the worked example with its route', () => {
    const year = foreignIncomeYear(exampleYear(), EXAMPLE_RATES, 2026)

    // $100.00 ÷ 1.1000 is 90.91 gross and $70.00 is 63.64 paid, so 27.27 withheld. 12% is 10.91, credited in full, and 16.36 is lost.
    // Lending of $10.00 ÷ 1.1000 is 9.09, and 12% is 1.09 to pay. The Irish 50.00 owes 6.00. The referral credit has a date and no figure.
    expect(year.payments.map(row)).toEqual([
      ['2026-07-15', 'ino-doh', [90.91, 27.27, 10.91, 10.91, 0, 16.36], null],
      ['2026-08-05', 'joppd', [9.09, 0, 1.09, 0, 1.09, 0], '2026-09-04'],
      ['2026-09-02', 'referral', null, '2026-10-02'],
      ['2026-10-16', 'joppd', [50, 0, 6, 0, 6, 0], '2026-11-15'],
    ])
    expect(year.payments.map((entry) => entry.codes)).toEqual([null, { recipient: '1103', receipt: '1005' }, null, { recipient: '1003', receipt: '1001' }])
    expect(amounts(year.inoDoh)).toEqual([90.91, 27.27, 10.91, 10.91, 0, 16.36])
    expect(amounts(year.joppd)).toEqual([59.09, 0, 7.09, 0, 7.09, 0])
    expect([year.inoDohDue, year.inoIzjavaDue]).toEqual([{ due: '2027-02-01', fileBy: '2027-01-29' }, '2026-07-23'])
    expect(year.countries.map((country) => [country.country, country.payments.length])).toEqual([
      ['US', 1],
      ['IE', 1],
      [null, 2],
    ])
  })

  it('credits a US payment with 15% withheld only up to the Croatian 12%', () => {
    const records = withIncome(exampleYear(), [dividend(BROKER, DIVIDEND_CO, '2026-08-05', '100', '15', '1.08')])

    // $100.00 ÷ 1.1000 is 90.91 and $85.00 is 77.27, so 13.64 withheld against 10.91 of Croatian tax.
    expect(row(foreignIncomeYear(records, EXAMPLE_RATES, 2026).payments.find((entry) => entry.payment.date === '2026-08-05' && entry.route === 'ino-doh')!)).toEqual([
      '2026-08-05',
      'ino-doh',
      [90.91, 13.64, 10.91, 10.91, 0, 2.73],
      null,
    ])
  })

  it('flags a dividend Revolut booked net and counts it on neither route until its tax withheld is typed', () => {
    const net = { ...dividend(BROKER, DIVIDEND_CO, '2026-08-05', '70', '0', '1.08'), note: 'Booked net of the tax withheld at source' }
    const year = foreignIncomeYear(withIncome(exampleYear(), [net]), EXAMPLE_RATES, 2026)

    expect(row(year.payments.find((entry) => entry.payment.id === net.id)!)).toEqual(['2026-08-05', 'booked-net', null, null])
    expect(amounts(year.inoDoh)![0]).toBe(90.91)
    const typed = foreignIncomeYear(withIncome(exampleYear(), [{ ...net, gross: decimal('100'), withheld: decimal('30') }]), EXAMPLE_RATES, 2026)
    expect(typed.payments.find((entry) => entry.payment.id === net.id)!.route).toBe('ino-doh')
  })

  it('counts a dividend booked net as tax withheld abroad for the INO-DOH and the INO-IZJAVA', () => {
    const net = { ...dividend(BROKER, DIVIDEND_CO, '2026-03-10', '70', '0', '1.08'), note: 'Booked net of the tax withheld at source' }
    const year = foreignIncomeYear(withIncome({ ...exampleYear(), income: [] }, [net]), EXAMPLE_RATES, 2026)

    expect([year.filesInoDoh, year.inoIzjavaDue, amounts(year.inoDoh)]).toEqual([true, '2026-03-18', [0, 0, 0, 0, 0, 0]])
    expect(foreignIncomeYear({ ...exampleYear(), income: [] }, EXAMPLE_RATES, 2026).filesInoDoh).toBe(false)
  })

  it('counts other income an earlier import noted as stock lending or a referral credit as that kind, in either language', () => {
    const lending = payment('other', '2026-08-06', USD, '10', 'Stock yield income')
    const referral = payment('other', '2026-08-07', EURO, '20', 'Nagrada za preporuku')
    const reversal = payment('other', '2026-08-10', USD, '-1', 'Reverses an earlier payment. Stock yield income')
    const refund = payment('other', '2026-08-11', EURO, '3', 'Paid for stock yield income')
    const year = foreignIncomeYear(withIncome(exampleYear(), [lending, referral, reversal, refund]), EXAMPLE_RATES, 2026)
    const entryOf = (record: Income): ForeignPayment => year.payments.find((entry) => entry.payment.id === record.id)!

    expect([lending, referral, reversal, refund].map((record) => [entryOf(record).kind, entryOf(record).route])).toEqual([
      ['lending', 'joppd'],
      ['referral', 'referral'],
      ['lending', 'joppd'],
      ['other', 'none'],
    ])
    expect(entryOf(lending).codes).toEqual({ recipient: '1103', receipt: '1005' })
  })

  it('gives a reversal of a payment with nothing withheld no 30 days of its own', () => {
    const reversal = { ...dividend(BROKER, WORLD, '2026-10-20', '-50', '0'), currency: EURO, note: 'Reverses a distribution' }
    const year = foreignIncomeYear(withIncome(exampleYear(), [reversal]), EXAMPLE_RATES, 2026)

    expect(row(year.payments.find((entry) => entry.payment.id === reversal.id)!)).toEqual(['2026-10-20', 'joppd', [-50, 0, -6, 0, -6, 0], null])
    expect(amounts(year.joppd)).toEqual([9.09, 0, 1.09, 0, 1.09, 0])
  })

  it('leaves out a payment of a Croatian ISIN, and counts a payment with no HNB rate for its day as left out', () => {
    const croatian = instrument('croatian', { name: 'Example Croatian Co', isin: 'HR0000000HR5' })
    const gbp = currencyCodeOf('GBP')!
    const pounds = instrument('pounds', { name: 'Example Pound Co', currency: gbp, isin: 'GB0000000GB6' })
    const records = { ...exampleYear(), instruments: [...exampleYear().instruments, croatian, pounds] }
    const year = foreignIncomeYear(
      withIncome(records, [
        { ...dividend(BROKER, croatian, '2026-05-04', '20', '2.4'), currency: EURO },
        { ...dividend(BROKER, pounds, '2026-05-05', '10', '0'), currency: gbp },
      ]),
      EXAMPLE_RATES,
      2026,
    )

    expect([year.croatianLeftOut, year.leftOut, year.payments.some((entry) => entry.country === 'HR')]).toEqual([1, 1, false])
    expect(year.countries.find((country) => country.country === 'GB')!.payments.map((entry) => entry.tax)).toEqual([null])
  })

  it('leaves out a coupon, and lists a refund of tax withheld with no tax of its own', () => {
    const coupon: Income = { ...payment('interest', '2026-06-01', EURO, '12'), kind: 'coupon', instrument: DIVIDEND_CO.id }
    const refund = payment('other', '2026-06-02', EURO, '3', 'Refund of tax withheld at source')
    const year = foreignIncomeYear(withIncome(exampleYear(), [coupon, refund]), EXAMPLE_RATES, 2026)

    expect(year.couponsLeftOut).toBe(1)
    expect(year.payments.map((entry) => entry.payment.id)).not.toContain(coupon.id)
    expect(row(year.payments.find((entry) => entry.payment.id === refund.id)!)).toEqual(['2026-06-02', 'none', null, null])
  })

  it("lowers its payer's figures and its route by a reversal", () => {
    // Booked on the dividend's own day, so it converts at the same rate and takes the whole payment back.
    const reversal = { ...dividend(BROKER, DIVIDEND_CO, '2026-07-15', '-100', '-30', '1.08'), id: dividend(BROKER, DIVIDEND_CO, '2026-07-16', '1', '0').id, note: 'Reverses a dividend' }
    const year = foreignIncomeYear(withIncome(exampleYear(), [reversal]), EXAMPLE_RATES, 2026)

    expect(amounts(year.inoDoh)).toEqual([0, 0, 0, 0, 0, 0])
    expect(amounts(year.countries.find((country) => country.country === 'US')!.total)).toEqual([0, 0, 0, 0, 0, 0])
    expect(year.inoIzjavaDue).toBe('2026-07-23')
  })
})
