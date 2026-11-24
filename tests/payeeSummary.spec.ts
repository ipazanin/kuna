import { describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { payeeKey } from '../src/apps/spending/payees/domain/payeeKey'
import { inPeriod } from '../src/apps/spending/payees/domain/payeePeriod'
import { payeeEntryLines, payeeSummary } from '../src/apps/spending/payees/domain/payeeSummary'
import { payeeTotals } from '../src/apps/spending/payees/domain/payeeTotals'
import { entriesAndSharedCosts } from '../src/apps/spending/sharedCosts/domain/sharedCostEntries'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import type { Payee } from '../src/apps/spending/workbook/domain/payee'
import type { SharedCost } from '../src/apps/spending/workbook/domain/sharedCost'
import { PAYEE_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import { sumMoney } from '../src/shared/money/money'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { CATEGORIES, OTP, RATES, category, row, spendingBook, wholeItems } from './fixtures/spending'

const DAY = civil('2026-11-23')
const MARKET_IBAN = 'HR6212345670000000001'
const MARKET: Payee = { id: recordIdOf(PAYEE_RECORDS, 'market'), names: ['Corner market'], ibans: [MARKET_IBAN], party: 'business', taxId: '', website: '', note: '' }

// All made up: Corner market over two years, one row of it found only by its IBAN, a refund and a row of another payee.
const ROWS = [
  row(OTP, '2024-12-02', -100, 'Food/Groceries', { payee: 'Corner market' }),
  row(OTP, '2025-12-05', -40, 'Food/Groceries', { payee: 'Corner market' }),
  row(OTP, '2026-03-10', -25, 'Food/Groceries', { payee: 'CM ZAGREB', counterpartyIban: MARKET_IBAN }),
  row(OTP, '2026-06-01', 5, 'Food/Groceries', { payee: 'Corner market' }),
  row(OTP, '2026-11-20', -30, 'Food/Groceries', { payee: 'Corner market' }),
  row(OTP, '2026-11-21', -9, 'Food/Groceries', { payee: 'Bakery' }),
]
const KEY = payeeKey('Corner market')

describe("a payee's page", () => {
  const book = spendingBook(ROWS, { payees: [MARKET] })
  const rows = countedRows(book, RATES)
  const onPayees = (period: 'year' | 'all') => {
    const counted = inPeriod(period, DAY)
    return payeeTotals(
      rows.filter((shown) => counted(shown.day)),
      CATEGORIES,
      book,
    ).find((payee) => payee.key === KEY)
  }

  it.each(['year', 'all'] as const)('shows the Payees line of the period %s, the row its IBAN gathers included', (period) => {
    expect(payeeSummary(book, rows, KEY, period, DAY).totals).toEqual(onPayees(period))
  })

  it('counts 40 + 25 + 30 less the 5 back over the last 12 months', () => {
    const summary = payeeSummary(book, rows, KEY, 'year', DAY)

    expect([summary.totals?.spent, summary.totals?.rows]).toEqual([euros(90), 4])
  })

  it('charts the twelve months up to this one whatever the period, and they add up to the last 12 months', () => {
    const summary = payeeSummary(book, rows, KEY, 'all', DAY)

    expect(summary.months.out.map((month) => month.month)).toEqual(['2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
    expect(sumMoney(summary.months.out.map((month) => month.counted))).toEqual(onPayees('year')!.spent)
  })

  it('averages the twelve whole months before this one, leaving November out', () => {
    const summary = payeeSummary(book, rows, KEY, 'month', DAY)

    // December 2025 to October 2026: 40 + 25 less the 5 back is 60 over 12 whole months.
    expect([summary.average.out, summary.averagedMonths.length]).toEqual([euros(5), 12])
    expect([summary.averagedMonths[0], summary.averagedMonths.at(-1)]).toEqual(['2025-11', '2026-10'])
    expect(summary.totals?.spent).toEqual(euros(30))
  })

  it('reads the usual category through the record', () => {
    expect(payeeSummary(book, rows, KEY, 'year', DAY).usual.out).toBe(category('Food/Groceries').id)
  })

  it('lists the entries and the shared costs Entries lists for the payee, the row the IBAN gathers among them', () => {
    const lunch: SharedCost = {
      id: recordIdOf(SHARED_COST_RECORDS, 'lunch'),
      day: civil('2026-11-22'),
      payee: 'Corner market',
      category: category('Food/Groceries').id,
      labels: [],
      event: BY_DAYS,
      note: '',
      settled: false,
    }
    const member = row(OTP, '2026-11-22', -12, 'In a shared cost', { payee: 'Till 3' })
    const shared = spendingBook([...ROWS, member], { payees: [MARKET], items: [...wholeItems(ROWS), ...wholeItems([member]).map((item) => ({ ...item, sharedCost: lunch.id }))], sharedCosts: [lunch] })
    const lines = payeeEntryLines(entriesAndSharedCosts(shared, RATES), KEY, shared, 'year', DAY)

    expect(lines.map((line) => (line.kind === 'entry' ? line.row.transaction.payee : `shared ${line.entry.sharedCost.payee}`))).toEqual([
      'shared Corner market',
      'Corner market',
      'Corner market',
      'CM ZAGREB',
      'Corner market',
    ])
  })
})
