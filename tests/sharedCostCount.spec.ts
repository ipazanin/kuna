import { describe, expect, it } from 'vitest'

import { countedRows } from '../src/apps/spending/analytics/domain/countedRow'
import { monthTotals } from '../src/apps/spending/analytics/domain/monthTotals'
import { spanBreakdown } from '../src/apps/spending/analytics/domain/spanBreakdown'
import { eventTotals } from '../src/apps/spending/events/domain/eventTotals'
import { labelTotals } from '../src/apps/spending/labels/domain/labelTotals'
import { payeeTotals } from '../src/apps/spending/payees/domain/payeeTotals'
import type { Label } from '../src/shared/categorising/domain/labels'
import type { SpendingEvent } from '../src/apps/spending/workbook/domain/event'
import { BY_DAYS } from '../src/apps/spending/workbook/domain/event'
import type { SharedCost } from '../src/apps/spending/workbook/domain/sharedCost'
import { EVENT_RECORDS, LABEL_RECORDS, SHARED_COST_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { StoredRow } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { monthKey } from '../src/shared/calendar/monthKey'
import { monthRange } from '../src/shared/calendar/dateRange'
import { NO_RATES } from '../src/shared/money/rateBook'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_EUR, REVOLUT_USD, category, row, wholeItems } from './fixtures/spending'

const GIFTS = category('Family and gifts/Gifts')
const FILED_IN = category('In a shared cost')
const PARTY: Label = { id: recordIdOf(LABEL_RECORDS, 'label-party'), name: 'Party' }
const BIRTHDAY: SpendingEvent = { id: recordIdOf(EVENT_RECORDS, 'event-birthday'), name: 'Birthday week', days: { from: civil('2026-11-18'), to: civil('2026-11-24') } }

/** The gift for Ana, all made up: 171.24 in three shops on 20 November under Gifts. */
const GIFT: SharedCost = {
  id: recordIdOf(SHARED_COST_RECORDS, 'shared-cost-gift'),
  day: civil('2026-11-20'),
  payee: 'Ana',
  category: GIFTS.id,
  labels: [],
  event: BY_DAYS,
  note: '',
  settled: false,
}

const bookshop = row(OTP, '2026-11-20', -40.14, 'In a shared cost', { payee: 'Bookshop' })
const toyShop = row(REVOLUT_EUR, '2026-11-20', -81.1, 'In a shared cost', { payee: 'Toy shop' })
const flowers = row(OTP, '2026-11-20', -50, 'In a shared cost', { payee: 'Flower shop' })
const marko = row(OTP, '2026-11-25', 57.08, 'In a shared cost', { payee: 'Marko' })
const petra = row(OTP, '2026-12-05', 57.08, 'In a shared cost', { payee: 'Petra' })

/** Each row's one item in the gift. The toy shop's part counts under Marko, carries a label and joins the birthday week, which it keeps for when it leaves. */
function members(rows: readonly StoredRow[]): readonly TransactionItem[] {
  return wholeItems(rows).map((item) => ({ ...item, sharedCost: GIFT.id, ...(item.transaction === toyShop.id ? { payee: 'Marko', labels: [PARTY.id], event: BIRTHDAY.id } : {}) }))
}

function rowsOf(rows: readonly StoredRow[], rates = RATES) {
  return countedRows({ accounts: ACCOUNTS, transactions: rows, items: members(rows), sharedCosts: [GIFT] }, rates)
}

const november = monthKey(2026, 11)
const december = monthKey(2026, 12)
const PAID = [bookshop, toyShop, flowers]
const EVERY_ROW = [...PAID, marko, petra]

describe("a shared cost's count", () => {
  it('counts 171.24 under Gifts on its own day before anyone pays back', () => {
    const totals = monthTotals(rowsOf(PAID), CATEGORIES, november)

    expect([totals.spent, totals.byCategory.get(GIFTS.id)]).toEqual([euros(171.24), euros(171.24)])
    expect(totals.byCategory.has(FILED_IN.id)).toBe(false)
  })

  it('lowers November to 114.16 once Marko pays back 57.08 on 25 November', () => {
    expect(monthTotals(rowsOf([...PAID, marko]), CATEGORIES, november).spent).toEqual(euros(114.16))
  })

  it('lowers November to 57.08 once Petra pays back in December, and counts nothing of it in December', () => {
    const rows = rowsOf(EVERY_ROW)

    expect(monthTotals(rows, CATEGORIES, november).spent).toEqual(euros(57.08))
    expect(monthTotals(rows, CATEGORIES, december).spent).toEqual(euros(0))
  })

  it('counts 57.08 under Ana on one entry, and no shop, friend or part payee on any payee line', () => {
    const totals = payeeTotals(rowsOf(EVERY_ROW), CATEGORIES, { payees: [] })

    expect(totals.map(({ name, spent, rows, latest, ibans }) => ({ name, spent, rows, latest, ibans }))).toEqual([
      { name: 'Ana', spent: euros(57.08), rows: 1, latest: civil('2026-11-20'), ibans: [] },
    ])
  })

  it("keeps a member's label and event out of their totals, with no entry and no newest day", () => {
    const rows = rowsOf(EVERY_ROW)
    const [party] = labelTotals(rows, CATEGORIES, [PARTY])
    const [week] = eventTotals(rows, CATEGORIES, [BIRTHDAY])

    expect([party!.rows, party!.latest, party!.spent]).toEqual([0, null, euros(0)])
    expect([week!.rows, week!.latest]).toEqual([1, civil('2026-11-20')])
    expect(week!.spent).toEqual(euros(57.08))
  })

  it("counts the shared cost's own label and event", () => {
    const labelled = { ...GIFT, labels: [PARTY.id] }
    const rows = countedRows({ accounts: ACCOUNTS, transactions: EVERY_ROW, items: members(EVERY_ROW), sharedCosts: [labelled] }, RATES)

    expect(labelTotals(rows, CATEGORIES, [PARTY])[0]).toMatchObject({ rows: 1, spent: euros(57.08) })
  })

  it('counts on a line of its own on Analysis by account, so each account leaves its members out and the lines add up', () => {
    const breakdown = spanBreakdown(rowsOf(EVERY_ROW), { categories: CATEGORIES, labels: [], accounts: ACCOUNTS, payees: [] }, monthRange(november), 'account')

    expect(breakdown.total.spent).toEqual(euros(57.08))
    expect(breakdown.lines.map(({ key, spent }) => [key, spent])).toEqual([
      [null, euros(57.08)],
      [OTP.id, euros(0)],
      [REVOLUT_EUR.id, euros(0)],
    ])
  })

  it("counts as one row the rates do not reach while a member's day is beyond them", () => {
    const dollars = row(REVOLUT_USD, '2026-11-21', -20, 'In a shared cost', { payee: 'Card shop' })
    const totals = monthTotals(rowsOf([...PAID, dollars], NO_RATES), CATEGORIES, november)

    expect([totals.spent, totals.unrated]).toEqual([euros(0), 1])
  })
})
