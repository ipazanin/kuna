import { describe, expect, it } from 'vitest'

import { fillRestOfYear } from '../src/apps/company/billingPlan/domain/fillRestOfYear'
import type { RestOfYearFill } from '../src/apps/company/billingPlan/domain/fillRestOfYear'
import { DEFAULT_SETTINGS } from '../src/apps/company/settings/domain/settings'
import type { BillingTerms } from '../src/apps/company/settings/domain/settings'
import { civil, euros } from './fixtures/ledger'
import { planRow } from './fixtures/billingPlan'

const TERMS: BillingTerms = {
  monthlyAmount: euros(5000),
  monthlyItem: 'Monthly Fee',
  subscriptionAmount: euros(200),
  subscriptionItem: 'Subscription',
  bonusAmount: euros(8000),
  bonusItem: 'Bonus',
  client: 'north',
}

function rowsOf(fill: RestOfYearFill): [string, string, number, string, string][] {
  if (fill.kind === 'refused') throw new Error(fill.reason)
  return fill.rows.map((row) => [row.date, row.item, row.amount, row.client, row.description])
}

describe('fillRestOfYear', () => {
  it('adds the monthly fee and the subscription on the last day of every month from this one to December, and never the bonus, described by the month while the item has no row yet', () => {
    expect(rowsOf(fillRestOfYear([], TERMS, civil('2026-10-19')))).toEqual([
      ['2026-10-31', 'Monthly Fee', euros(5000), 'north', 'Oct 2026'],
      ['2026-10-31', 'Subscription', euros(200), 'north', 'Oct 2026'],
      ['2026-11-30', 'Monthly Fee', euros(5000), 'north', 'Nov 2026'],
      ['2026-11-30', 'Subscription', euros(200), 'north', 'Nov 2026'],
      ['2026-12-31', 'Monthly Fee', euros(5000), 'north', 'Dec 2026'],
      ['2026-12-31', 'Subscription', euros(200), 'north', 'Dec 2026'],
    ])
  })

  it('describes each row as the client’s latest row of its item, with the new month where that row names its own', () => {
    const plan = [
      planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'Fee for September'),
      planRow('Monthly Fee', '2026-08-31', 5000, 'north', 'Fee for August'),
      planRow('Subscription', '2026-09-30', 200, 'north', 'Design tool seat'),
      planRow('Monthly Fee', '2026-09-30', 5000, 'south', 'South fee, September'),
    ]

    expect(rowsOf(fillRestOfYear(plan, TERMS, civil('2026-10-19'))).map(([date, item, , , description]) => [date, item, description])).toEqual([
      ['2026-10-31', 'Monthly Fee', 'Fee for October'],
      ['2026-10-31', 'Subscription', 'Design tool seat'],
      ['2026-11-30', 'Monthly Fee', 'Fee for November'],
      ['2026-11-30', 'Subscription', 'Design tool seat'],
      ['2026-12-31', 'Monthly Fee', 'Fee for December'],
      ['2026-12-31', 'Subscription', 'Design tool seat'],
    ])
  })

  it('swaps a short name and the year after it, keeps capitals, and leaves "may" in a sentence alone', () => {
    const fees = (plan: ReturnType<typeof planRow>[], asOf: string) =>
      rowsOf(fillRestOfYear(plan, { ...TERMS, subscriptionAmount: null }, civil(asOf))).map(([date, , , , description]) => [date, description])

    expect(fees([planRow('Monthly Fee', '2025-12-31', 5000, 'north', 'DECEMBER work, Dec 2025, Dec 25')], '2026-08-10')).toEqual([
      ['2026-08-31', 'AUGUST work, Aug 2026, Aug 26'],
      ['2026-09-30', 'SEPTEMBER work, Sep 2026, Sep 26'],
      ['2026-10-31', 'OCTOBER work, Oct 2026, Oct 26'],
      ['2026-11-30', 'NOVEMBER work, Nov 2026, Nov 26'],
      ['2026-12-31', 'DECEMBER work, Dec 2026, Dec 26'],
    ])
    expect(fees([planRow('Monthly Fee', '2026-05-31', 5000, 'north', 'May fee, may change')], '2026-12-01')).toEqual([['2026-12-31', 'December fee, may change']])
    expect(fees([planRow('Monthly Fee', '2026-09-30', 5000, 'north', 'Sep 2026 sprint')], '2026-12-01')).toEqual([['2026-12-31', 'Dec 2026 sprint']])
  })

  it('skips a month that already has the item for the client, whatever its date and amount', () => {
    const plan = [
      planRow('Monthly Fee', '2026-11-20', 4200, 'north'),
      planRow('Subscription', '2026-12-31', 200, 'south'),
      planRow('Bonus', '2026-12-01', 8000, 'north'),
      planRow('Monthly Fee', '2026-09-30', 5000, 'north'),
    ]

    expect(rowsOf(fillRestOfYear(plan, TERMS, civil('2026-11-02'))).map(([date, item]) => [date, item])).toEqual([
      ['2026-11-30', 'Subscription'],
      ['2026-12-31', 'Monthly Fee'],
      ['2026-12-31', 'Subscription'],
    ])
  })

  it('adds nothing once every month to December is filled, so it can run again', () => {
    const first = fillRestOfYear([], TERMS, civil('2026-12-05'))
    const plan = rowsOf(first).map(([date, item, amount, client]) => planRow(item, date, amount / 100, client))

    expect(fillRestOfYear(plan, TERMS, civil('2026-12-05'))).toEqual({ kind: 'rows', rows: [] })
  })

  it('fills only what is set, and refuses without a client or any monthly amount', () => {
    expect(rowsOf(fillRestOfYear([], { ...TERMS, subscriptionAmount: null }, civil('2026-12-01'))).map(([, item]) => item)).toEqual(['Monthly Fee'])
    expect(rowsOf(fillRestOfYear([], { ...TERMS, monthlyItem: '' }, civil('2026-12-01'))).map(([, item]) => item)).toEqual(['Subscription'])
    expect(fillRestOfYear([], { ...TERMS, client: '' }, civil('2026-12-01'))).toEqual({ kind: 'refused', reason: 'Choose the client the rows are for first.' })
    expect(fillRestOfYear([], DEFAULT_SETTINGS.billing, civil('2026-12-01')).kind).toBe('refused')
    expect(fillRestOfYear([], { ...DEFAULT_SETTINGS.billing, client: 'north', bonusAmount: euros(8000), bonusItem: 'Bonus' }, civil('2026-12-01'))).toEqual({
      kind: 'refused',
      reason: 'Set the monthly fee or the monthly subscription, each with its item, first.',
    })
  })

  it('fills a later year from January, so the forecast of that year reads its fees, and an earlier year not at all', () => {
    const plan = [planRow('Monthly Fee', '2026-12-31', 5000, 'north', 'Fee for December')]
    const next = rowsOf(fillRestOfYear(plan, TERMS, civil('2026-10-19'), 2027))
    expect(next).toHaveLength(24)
    expect(next.slice(0, 2)).toEqual([
      ['2027-01-31', 'Monthly Fee', euros(5000), 'north', 'Fee for January'],
      ['2027-01-31', 'Subscription', euros(200), 'north', 'Jan 2027'],
    ])
    expect(next[23]?.[0]).toBe('2027-12-31')
    expect(fillRestOfYear(plan, TERMS, civil('2026-10-19'), 2025)).toEqual({ kind: 'rows', rows: [] })
  })
})
