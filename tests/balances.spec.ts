import { describe, expect, it } from 'vitest'

import { balanceSeries, latestBalances } from '../src/features/cash/domain/balances'
import { euros, ledger, windowOf } from './fixtures/ledger'

const rows = ledger([
  { date: '2026-06-10', account: 'legacy', amount: 5000, category: 'share-capital' },
  { date: '2026-07-04', account: 'legacy', amount: 1000, category: 'revenue' },
  { date: '2026-08-01', account: 'main', amount: 200, category: 'revenue' },
  // Two bookings on one day: the later one carries the day's closing balance.
  { date: '2026-08-20', account: 'legacy', amount: -6000, category: 'internal-transfer' },
  { date: '2026-08-20', account: 'main', amount: 6000, category: 'internal-transfer' },
  { date: '2026-08-20', account: 'main', amount: -100, category: 'equipment' },
  { date: '2026-09-15', account: 'savings', amount: 50, category: 'revenue' },
  { date: '2026-10-02', account: 'main', amount: -10, category: 'ai-services' },
])
const window = windowOf('2026-06-10', '2026-10-02')

describe('latestBalances', () => {
  const balances = latestBalances(rows)

  it('takes each account’s closing balance from its last booking on its newest day', () => {
    expect(balances.accounts.map((account) => [account.account, account.balance.amount, account.asOf, account.firstSeen, account.transactionCount])).toEqual([
      ['legacy', euros(0), '2026-08-20', '2026-06-10', 3],
      ['main', euros(6090), '2026-10-02', '2026-08-01', 4],
      ['savings', euros(50), '2026-09-15', '2026-09-15', 1],
    ])
  })

  it('adds every account into cash on hand, however many there are', () => {
    expect(balances.cashOnHand.amount).toBe(euros(6140))
    expect(balances.cashOnHand.drill.filters).toEqual({ period: { preset: 'all' }, accounts: ['legacy', 'main', 'savings'] })
  })

  it('calls an emptied account closed once the ledger has moved past the month it went silent in', () => {
    expect(balances.accounts.map((account) => [account.account, account.closed])).toEqual([
      ['legacy', true],
      ['main', false],
      ['savings', false],
    ])
  })

  it('reads the closing row by sequence, not by the order rows arrive in', () => {
    expect(latestBalances([...rows].reverse()).accounts[1].balance.amount).toBe(euros(6090))
  })
})

describe('balanceSeries', () => {
  const series = balanceSeries(rows, window)

  it('gives a month-end balance per account, blank before its first row and carried forward after its last', () => {
    expect(series.accounts).toEqual(['legacy', 'main', 'savings'])
    expect(series.months.map((month) => [month.month, ...series.accounts.map((account) => month.byAccount[account]?.amount ?? null)])).toEqual([
      ['2026-06', euros(5000), null, null],
      ['2026-07', euros(6000), null, null],
      ['2026-08', euros(0), euros(6100), null],
      ['2026-09', euros(0), euros(6100), euros(50)],
      ['2026-10', euros(0), euros(6090), euros(50)],
    ])
  })

  it('totals what the accounts hold and marks the month still filling up', () => {
    expect(series.months.map((month) => month.total.amount)).toEqual([5000, 6000, 6100, 6150, 6140].map(euros))
    expect(series.months.map((month) => month.complete)).toEqual([false, true, true, true, false])
  })
})
