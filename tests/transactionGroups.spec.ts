import { describe, expect, it } from 'vitest'

import { listedRows } from '../src/apps/company/transactions/domain/listedRows'
import { groupTransactions } from '../src/apps/company/transactions/domain/transactionGroups'
import type { CategoryGroup, CounterpartyGroup, MonthGroup } from '../src/apps/company/transactions/domain/transactionGroups'
import { counterpartyLabels } from '../src/apps/company/workbook/domain/counterpartyIdentity'
import { euros, ledger, windowOf } from './fixtures/ledger'

const transactions = ledger([
  { date: '2026-07-04', amount: 8000, category: 'revenue', counterparty: 'Northwind', iban: 'HR6212345670000000001' },
  { date: '2026-07-05', amount: 2000, category: 'revenue', counterparty: 'Contoso' },
  { date: '2026-07-06', amount: -100, category: 'client-refund', counterparty: 'Contoso' },
  { date: '2026-08-12', amount: -3000, category: 'equipment', counterparty: 'Laptop Store' },
  { date: '2026-08-14', amount: -1000, category: 'accounting', counterparty: 'Brightdesk' },
  { date: '2026-08-20', amount: -400, category: 'reimbursement-to-owner', counterparty: 'Alex' },
  { date: '2026-09-02', amount: -50, category: 'zzz-test', counterparty: 'Brightdesk' },
])
const rows = listedRows(transactions, [])
const context = { window: windowOf('2026-07-04', '2026-09-02'), counterpartyLabels: counterpartyLabels(transactions) }

describe('groupTransactions by category', () => {
  const groups = groupTransactions(rows, 'category', context) as CategoryGroup[]

  it('puts the largest total first, whichever its sign', () => {
    expect(groups.map((group) => [group.category, group.total])).toEqual([
      ['revenue', euros(10000)],
      ['equipment', euros(-3000)],
      ['accounting', euros(-1000)],
      ['reimbursement-to-owner', euros(-400)],
      ['client-refund', euros(-100)],
      ['zzz-test', euros(-50)],
    ])
  })

  it('shares income against income and costs against costs, and leaves financing and unclassified rows without a share', () => {
    // income 10000 - 100 = 9900, costs 3000 + 1000 = 4000
    expect(groups.map((group) => group.share)).toEqual([
      { of: 'income', fraction: 10000 / 9900 },
      { of: 'cost', fraction: 3000 / 4000 },
      { of: 'cost', fraction: 1000 / 4000 },
      null,
      { of: 'income', fraction: -100 / 9900 },
      null,
    ])
  })

  it('keeps the bucket the rows carry', () => {
    expect(groups.map((group) => group.bucket)).toEqual(['income', 'operating', 'operating', 'financing', 'income', 'unclassified'])
  })
})

describe('groupTransactions by month', () => {
  const groups = groupTransactions(rows, 'month', context) as MonthGroup[]

  it('comes newest first with the profit and loss of each month, and marks the months the ledger does not cover in full', () => {
    expect(groups.map((group) => [group.month, group.income, group.cost, group.net, group.coverage])).toEqual([
      ['2026-09', euros(0), euros(0), euros(0), 'month-so-far'],
      ['2026-08', euros(0), euros(4000), euros(-4000), 'complete'],
      ['2026-07', euros(9900), euros(0), euros(9900), 'part-month'],
    ])
  })

  it('keeps every row, financing included, in the order given', () => {
    expect(groups[1]?.rows.map((transaction) => transaction.category)).toEqual(['reimbursement-to-owner', 'accounting', 'equipment'])
    expect(groups[1]?.total).toBe(euros(-4400))
  })
})

describe('groupTransactions by counterparty', () => {
  const groups = groupTransactions(rows, 'counterparty', context) as CounterpartyGroup[]

  it('labels each counterparty, keeps its IBAN, and shares money in against money in and money out against money out', () => {
    // money in 8000 + 1900, money out 3000 + 1050 + 400
    expect(groups.map((group) => [group.label, group.iban, group.share])).toEqual([
      ['NORTHWIND', 'HR6212345670000000001', { of: 'money-in', fraction: 8000 / 9900 }],
      ['LAPTOP STORE', '', { of: 'money-out', fraction: 3000 / 4450 }],
      ['CONTOSO', '', { of: 'money-in', fraction: 1900 / 9900 }],
      ['BRIGHTDESK', '', { of: 'money-out', fraction: 1050 / 4450 }],
      ['ALEX', '', { of: 'money-out', fraction: 400 / 4450 }],
    ])
  })
})
