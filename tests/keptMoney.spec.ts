import { describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { keptMoney } from '../src/apps/spending/analytics/domain/keptMoney'
import { monthFlow } from '../src/apps/spending/analytics/domain/monthFlow'
import { monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import { subtractMoney, sumMoney } from '../src/shared/money/money'
import type { MonthKey } from '../src/shared/calendar/monthKey'
import { NO_RATES } from '../src/shared/money/rateBook'
import { euros, month } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, REVOLUT_USD, row, wholeItems } from './fixtures/spending'

const transactions = [
  row(OTP, '2026-10-10', 2_400, 'Income/Salary'),
  row(OTP, '2026-10-01', -600, 'Home/Rent'),
  row(OTP, '2026-10-12', -250, 'Food/Groceries'),
  row(OTP, '2026-10-25', -300, 'Saved to investments'),
  row(OTP, '2026-10-15', -180, 'Loan principal'),
  row(OTP, '2026-10-22', -500, 'Bought assets'),
  row(OTP, '2026-10-03', -200, 'Between my accounts'),
  row(REVOLUT_USD, '2026-10-08', -30, 'Bought assets'),
]
const rows = countedRows({ accounts: ACCOUNTS, transactions, items: wholeItems(transactions) }, NO_RATES)
const totalsOf = (asked: MonthKey) => monthTotals(rows, CATEGORIES, asked)

describe('what a month kept', () => {
  it("keeps Overview's income less spending and splits it into investments, loan principal, assets and the rest", () => {
    const [october] = keptMoney(rows, CATEGORIES, totalsOf, [month('2026-10')])

    // 2,400 in less 850 spent keeps 1,550: 300 to investments, 180 of principal, 500 bought and 570 left. The transfer counts nowhere.
    expect(october).toEqual({ month: month('2026-10'), kept: euros(1_550), investments: euros(300), loanPrincipal: euros(180), assets: euros(500), rest: euros(570), unrated: 1 })
  })

  it('keeps what the savings rate keeps', () => {
    const [october] = keptMoney(rows, CATEGORIES, totalsOf, [month('2026-10')])
    const [flow] = monthFlow([monthTotals(rows, CATEGORIES, month('2026-10'))])

    expect(october!.kept).toBe(subtractMoney(flow!.income, flow!.spent))
    expect(sumMoney([october!.investments, october!.loanPrincipal, october!.assets, october!.rest])).toBe(october!.kept)
  })
})
