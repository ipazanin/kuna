import { describe, expect, it } from 'vitest'

import { fillRestOfYear } from '../src/features/billingPlan/domain/fillRestOfYear'
import type { RestOfYearFill } from '../src/features/billingPlan/domain/fillRestOfYear'
import { DEFAULT_SETTINGS } from '../src/features/settings/domain/settings'
import type { BillingTerms } from '../src/features/settings/domain/settings'
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
  it('adds the monthly fee and the subscription on the last day of every month from this one to December, and never the bonus', () => {
    expect(rowsOf(fillRestOfYear([], TERMS, civil('2026-10-19')))).toEqual([
      ['2026-10-31', 'Monthly Fee', euros(5000), 'north', 'Oct 2026'],
      ['2026-10-31', 'Subscription', euros(200), 'north', 'Oct 2026'],
      ['2026-11-30', 'Monthly Fee', euros(5000), 'north', 'Nov 2026'],
      ['2026-11-30', 'Subscription', euros(200), 'north', 'Nov 2026'],
      ['2026-12-31', 'Monthly Fee', euros(5000), 'north', 'Dec 2026'],
      ['2026-12-31', 'Subscription', euros(200), 'north', 'Dec 2026'],
    ])
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
})
