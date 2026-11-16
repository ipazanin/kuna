import { describe, expect, it } from 'vitest'

import { eventMembership } from '../src/apps/spending/events/domain/eventMembership'
import { eventProblem } from '../src/apps/spending/events/domain/events'
import { eventTotals } from '../src/apps/spending/events/domain/eventTotals'
import { euroRows } from '../src/apps/spending/rates/domain/euroRows'
import { BY_DAYS, OUT_OF_EVENTS } from '../src/apps/spending/workbook/domain/event'
import type { EventChoice, SpendingEvent } from '../src/apps/spending/workbook/domain/event'
import { EVENT_RECORDS } from '../src/apps/spending/workbook/domain/spendingKinds'
import type { Transaction } from '../src/apps/spending/workbook/domain/transaction'
import type { TransactionItem } from '../src/apps/spending/workbook/domain/transactionItem'
import { recordIdOf } from '../src/shared/storage/domain/recordId'
import { civil, euros } from './fixtures/ledger'
import { ACCOUNTS, CATEGORIES, OTP, RATES, REVOLUT_USD, category, row, wholeItems } from './fixtures/spending'

const event = (key: string, name: string, from: string, to: string): SpendingEvent => ({ id: recordIdOf(EVENT_RECORDS, key), name, days: { from: civil(from), to: civil(to) } })

const PRAGUE = event('prague', 'Prague', '2026-10-10', '2026-10-14')
const SUMMER = event('summer', 'Autumn holidays', '2026-10-01', '2026-10-31')

const chosen = (entry: Transaction, choice: EventChoice): TransactionItem => ({ ...wholeItems([entry])[0]!, event: choice })

describe("an event's days", () => {
  it('need a name and a last day on or after the first', () => {
    expect(eventProblem('  ', PRAGUE.days)).toBe('blank')
    expect(eventProblem('Prague', { from: civil('2026-10-14'), to: civil('2026-10-10') })).toBe('ends-before')
    expect(eventProblem('Prague', { from: civil('2026-10-14'), to: civil('2026-10-14') })).toBeNull()
  })
})

describe('which event a part is in', () => {
  const eventOf = eventMembership([SUMMER, PRAGUE])
  const byDays: Pick<TransactionItem, 'event'> = { event: BY_DAYS }

  it('is the event over its day on its last day, and none the day after', () => {
    const only = eventMembership([PRAGUE])
    expect(only(byDays, civil('2026-10-14'), 'spending')).toBe(PRAGUE.id)
    expect(only(byDays, civil('2026-10-15'), 'spending')).toBeNull()
  })

  it('is the shorter of two events over its day, and the one that starts later when they are as long', () => {
    expect(eventOf(byDays, civil('2026-10-12'), 'spending')).toBe(PRAGUE.id)
    expect(eventOf(byDays, civil('2026-10-20'), 'spending')).toBe(SUMMER.id)
    const later = event('vienna', 'Vienna', '2026-10-12', '2026-10-16')
    expect(eventMembership([PRAGUE, later])(byDays, civil('2026-10-13'), 'spending')).toBe(later.id)
  })

  it('is none for a transfer or income on its days, unless put in by hand', () => {
    expect(eventOf(byDays, civil('2026-10-12'), 'nowhere')).toBeNull()
    expect(eventOf(byDays, civil('2026-10-12'), 'income')).toBeNull()
    expect(eventOf({ event: PRAGUE.id }, civil('2026-09-12'), 'nowhere')).toBe(PRAGUE.id)
  })

  it('is none for a part taken out, also of an event made later over its day', () => {
    expect(eventOf({ event: OUT_OF_EVENTS }, civil('2026-10-12'), 'spending')).toBeNull()
    expect(eventMembership([SUMMER, PRAGUE, event('later', 'Later', '2026-10-12', '2026-10-12')])({ event: OUT_OF_EVENTS }, civil('2026-10-12'), 'spending')).toBeNull()
  })

  it('goes by its day when it names an event the file lacks', () => {
    expect(eventOf({ event: recordIdOf(EVENT_RECORDS, 'gone') }, civil('2026-10-12'), 'spending')).toBe(PRAGUE.id)
  })
})

describe("an event's totals", () => {
  // The hotel's 324 USD is 300 EUR at the 1.08 of 10 October.
  const hotel = row(REVOLUT_USD, '2026-10-10', -324, 'Travel/Accommodation')
  const dinners = row(OTP, '2026-10-12', -120, 'Food/Eating out')
  const paidBack = row(OTP, '2026-10-14', 60, 'Food/Eating out')
  const salary = row(OTP, '2026-10-12', 2_400, 'Income/Salary')
  const flight = row(OTP, '2026-09-02', -150, 'Travel/Travel tickets and car hire')
  const streaming = row(OTP, '2026-10-11', -13.99, 'Leisure/Streaming and apps')
  const fuel = row(OTP, '2026-10-20', -50, 'Transport/Fuel')
  const transactions = [flight, hotel, streaming, dinners, salary, paidBack, fuel]
  const items = [chosen(flight, PRAGUE.id), ...wholeItems([hotel, dinners, salary, paidBack, fuel]), chosen(streaming, OUT_OF_EVENTS)]
  const totals = (events: readonly SpendingEvent[]) => eventTotals(euroRows({ accounts: ACCOUNTS, transactions, items }, RATES), CATEGORIES, events)

  it('count as the month counts, in euros at the rate of each row, with a refund lowering its group and a part put in or taken out by hand', () => {
    const [prague] = totals([PRAGUE])

    // 150 flight + 300 hotel + 120 dinners - 60 paid back. The salary on its days and the subscription taken out count nowhere.
    expect(prague!.spent).toBe(euros(510))
    expect(prague!.groups).toEqual([
      { group: category('Travel').id, spent: euros(450) },
      { group: category('Food').id, spent: euros(60) },
    ])
    expect([prague!.income, prague!.rows, prague!.latest, prague!.unrated]).toEqual([euros(0), 4, civil('2026-10-14'), 0])
  })

  it('move with new days and with no write to the rows, newest first by first day', () => {
    const moved = { ...PRAGUE, days: { from: civil('2026-10-12'), to: civil('2026-10-20') } }

    expect(totals([SUMMER, moved]).map((one) => [one.event.name, one.spent])).toEqual([
      ['Prague', euros(260)],
      ['Autumn holidays', euros(300)],
    ])
  })
})
