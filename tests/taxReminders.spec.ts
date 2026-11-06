import { describe, expect, it } from 'vitest'

import { taxReminder } from '../src/apps/investments/tax/domain/taxReminders'
import { civil } from './fixtures/ledger'
import { BROKER, dividend } from './fixtures/investments'
import { DIVIDEND_CO, EXAMPLE_RATES, exampleYear } from './fixtures/taxExample'

function reminderOn(day: string): ReturnType<typeof taxReminder> {
  return taxReminder(exampleYear(), EXAMPLE_RATES, civil(day))
}

describe('the tax date on the home card', () => {
  it('leads with the INO-DOH by 29 Jan on 10 Jan 2027', () => {
    expect(reminderOn('2027-01-10')).toEqual({ kind: 'ino-doh', due: '2027-01-29' })
  })

  it('gives the JOPPD by 1 Mar on 15 Feb 2027', () => {
    expect(reminderOn('2027-02-15')).toEqual({ kind: 'joppd', due: '2027-03-01' })
  })

  it('gives no JOPPD on 15 Feb 2027 for a year whose sales end in a loss', () => {
    const records = exampleYear()
    const losing = { ...records, income: [], trades: records.trades.filter((record) => record.side === 'buy' || record.instrument === DIVIDEND_CO.id) }

    expect(taxReminder(losing, EXAMPLE_RATES, civil('2027-02-15'))).toBeNull()
  })

  it('gives nothing on 2 Mar 2027', () => {
    expect(reminderOn('2027-03-02')).toBeNull()
  })

  it('gives the Irish payment of 16 Oct by 15 Nov on 3 Nov 2026', () => {
    expect(reminderOn('2026-11-03')).toEqual({ kind: 'payments', count: 1, due: '2026-11-15' })
  })

  it('reminds of the INO-DOH in January when the only tax withheld abroad is on a dividend booked net', () => {
    const records = exampleYear()
    const net = { ...dividend(BROKER, DIVIDEND_CO, '2026-07-15', '70', '0', '1.08'), note: 'Booked net of the tax withheld at source' }

    expect(taxReminder({ ...records, trades: [], income: [net] }, EXAMPLE_RATES, civil('2027-01-10'))).toEqual({ kind: 'ino-doh', due: '2027-01-29' })
  })

  it('counts the lending payment and the referral credit while their 30 days run', () => {
    expect(reminderOn('2026-09-03')).toEqual({ kind: 'payments', count: 2, due: '2026-09-04' })
  })

  it('leaves out the JOPPD with the history not said to be complete, and keeps the dates that read only the income', () => {
    const records = exampleYear()
    expect(taxReminder(records, EXAMPLE_RATES, civil('2027-02-15'), false)?.kind).not.toBe('joppd')
    expect(taxReminder(records, EXAMPLE_RATES, civil('2027-02-15'))?.kind).toBe('joppd')
    const net = records.income.map((payment) => payment)
    expect(taxReminder({ ...records, trades: [], income: net }, EXAMPLE_RATES, civil('2027-01-10'), false)).toEqual(
      taxReminder({ ...records, trades: [], income: net }, EXAMPLE_RATES, civil('2027-01-10')),
    )
  })
})
