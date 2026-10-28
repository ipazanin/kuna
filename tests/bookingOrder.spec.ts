import { describe, expect, it } from 'vitest'

import { parseCivilDate } from '../src/shared/calendar/civilDate'
import { moneyFromAmount } from '../src/shared/money/money'
import { bookingOrder } from '../src/apps/company/workbook/domain/bookingOrder'
import type { BookedEntry } from '../src/apps/company/workbook/domain/bookingOrder'

type Entry = BookedEntry & { readonly name: string }

/** An entry named for the test, with euros for its amount and balance. */
function entry(name: string, date: string, amount: number, balance: number, fields: Partial<Pick<Entry, 'account' | 'reference'>> = {}): Entry {
  return {
    name,
    account: fields.account ?? 'main',
    date: parseCivilDate(date)!,
    amount: moneyFromAmount(amount),
    balance: moneyFromAmount(balance),
    reference: fields.reference ?? '',
    counterparty: '',
    description: '',
  }
}

function namesOf(entries: readonly Entry[]): string[] {
  return bookingOrder(entries).entries.map((booked) => booked.name)
}

describe('bookingOrder', () => {
  it('puts a day in the order its balances chain, whatever order the entries come in', () => {
    const entries = [
      entry('third', '2026-03-02', -25, 50),
      entry('opening', '2026-03-01', 100, 100),
      entry('first', '2026-03-02', -10, 90),
      entry('second', '2026-03-02', -15, 75),
    ]

    expect(namesOf(entries)).toEqual(['opening', 'first', 'second', 'third'])
    expect(namesOf([...entries].reverse())).toEqual(['opening', 'first', 'second', 'third'])
    expect(bookingOrder(entries).unchained).toEqual([])
  })

  it('opens a day at the previous day’s closing balance, which settles what the chain alone leaves open', () => {
    // Out and back in on one day: from 100 the day chains only as out first, from 120 only as in first.
    const outFirst = [entry('earlier', '2026-03-01', 100, 100), entry('in', '2026-03-02', 20, 100, { reference: 'A' }), entry('out', '2026-03-02', -20, 80, { reference: 'B' })]
    const inFirst = [entry('earlier', '2026-03-01', 120, 120), entry('in', '2026-03-02', 20, 140, { reference: 'B' }), entry('out', '2026-03-02', -20, 120, { reference: 'A' })]

    expect(namesOf(outFirst)).toEqual(['earlier', 'out', 'in'])
    expect(namesOf(inFirst)).toEqual(['earlier', 'in', 'out'])
  })

  it('lets the reference decide a day with no previous day that the chain allows two ways', () => {
    const entries = [entry('in', '2026-03-02', 20, 100, { reference: 'B' }), entry('out', '2026-03-02', -20, 80, { reference: 'A' })]

    expect(namesOf(entries)).toEqual(['out', 'in'])
    expect(bookingOrder(entries).unchained).toEqual([])
  })

  it('passes over an entry by reference when taking it first would leave the rest unable to chain', () => {
    const entries = [
      entry('earlier', '2026-03-01', 100, 100),
      entry('fee', '2026-03-02', 3, 103, { reference: 'A' }),
      entry('out', '2026-03-02', 5, 105, { reference: 'B' }),
      entry('back', '2026-03-02', -5, 100, { reference: 'C' }),
    ]

    expect(namesOf(entries)).toEqual(['earlier', 'out', 'back', 'fee'])
  })

  it('orders a day whose balances do not chain by reference, and reports it with the entry that closes it', () => {
    const entries = [entry('earlier', '2026-03-01', 100, 100), entry('second', '2026-03-02', -10, 75, { reference: 'B' }), entry('first', '2026-03-02', -20, 80, { reference: 'A' })]

    const order = bookingOrder(entries)

    expect(order.entries.map((booked) => booked.name)).toEqual(['earlier', 'first', 'second'])
    expect(order.unchained).toEqual([{ account: 'main', date: '2026-03-02', closing: entries[1] }])
  })

  it('opens the next day at the guessed closing balance of a day that does not chain', () => {
    const entries = [
      entry('first', '2026-03-02', -20, 80, { reference: 'A' }),
      entry('second', '2026-03-02', -10, 75, { reference: 'B' }),
      entry('next out', '2026-03-03', -5, 75, { reference: 'A' }),
      entry('next in', '2026-03-03', 5, 80, { reference: 'B' }),
    ]

    expect(bookingOrder(entries).unchained.map((day) => day.date)).toEqual(['2026-03-02'])
    expect(namesOf(entries)).toEqual(['first', 'second', 'next in', 'next out'])
  })

  it('chains a day that does not join the day before, as after a missing statement, without reporting it', () => {
    const entries = [entry('earlier', '2026-03-01', 100, 100), entry('second', '2026-03-05', -10, 30), entry('first', '2026-03-05', -50, 40)]

    expect(namesOf(entries)).toEqual(['earlier', 'first', 'second'])
    expect(bookingOrder(entries).unchained).toEqual([])
  })

  it('puts two accounts of one day after each other by account name, each in its own chain', () => {
    const entries = [
      entry('main second', '2026-03-02', -5, 45, { account: 'main' }),
      entry('card first', '2026-03-02', -1, 9, { account: 'card' }),
      entry('main first', '2026-03-02', -5, 50, { account: 'main' }),
      entry('card second', '2026-03-02', -1, 8, { account: 'card' }),
      entry('main earlier', '2026-03-01', 55, 55, { account: 'main' }),
    ]

    expect(namesOf(entries)).toEqual(['main earlier', 'card first', 'card second', 'main first', 'main second'])
  })
})
