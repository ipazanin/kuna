import { describe, expect, it } from 'vitest'

import { bookedTwins } from '../src/shared/money/lookAlikeBookings'
import type { Booking } from '../src/shared/money/lookAlikeBookings'
import { moneyFromAmount } from '../src/shared/money/money'
import type { Money } from '../src/shared/money/money'
import { civil } from './fixtures/ledger'

function booking(date: string, amount: number, counterparty: string, description = ''): Booking<Money> {
  return { date: civil(date), amount: moneyFromAmount(amount), counterparty, description }
}

const BOOKED = booking('2026-10-12', -45.3, 'KONZUM PLUS D.O.O.', 'Card payment 1234')

describe('a copied row against the bookings of its account', () => {
  it('is the same booking on the same day, amount and counterparty, however it is spelled', () => {
    const copied = booking('2026-10-12', -45.3, 'Konzum plus d.o.o.')
    expect(bookedTwins([copied], [BOOKED]).get(copied)).toEqual({ kind: 'same', booked: BOOKED })
  })

  it.each([
    ['a day the bank shifted it by', booking('2026-10-14', -45.3, 'KONZUM PLUS D.O.O.')],
    ['a counterparty spelled shorter', booking('2026-10-12', -45.3, 'Konzum')],
    ['a word of the description', booking('2026-10-13', -45.3, 'Card 1234')],
    ['no text at all', booking('2026-10-15', -45.3, '')],
  ])('looks like it with %s', (_, copied) => {
    expect(bookedTwins([copied], [BOOKED]).get(copied)).toEqual({ kind: 'like', booked: BOOKED })
  })

  it.each([
    ['four days apart', booking('2026-10-16', -45.3, 'Konzum')],
    ['a cent off', booking('2026-10-12', -45.31, 'Konzum')],
    ['money in against money out', booking('2026-10-12', 45.3, 'Konzum')],
    ['another payee on the same day', booking('2026-10-12', -45.3, 'Lidl')],
  ])('stays new %s', (_, copied) => {
    expect(bookedTwins([copied], [BOOKED]).has(copied)).toBe(false)
  })

  it('pairs one to one, so a second equal row stays new, and the same booking wins over a look-alike', () => {
    const first = booking('2026-10-11', -45.3, 'Konzum')
    const second = booking('2026-10-12', -45.3, 'KONZUM PLUS D.O.O.')
    const twins = bookedTwins([first, second], [BOOKED])
    expect(twins.get(second)).toEqual({ kind: 'same', booked: BOOKED })
    expect(twins.has(first)).toBe(false)
  })

  it('takes the nearest look-alike when two would do', () => {
    const far = booking('2026-10-09', -45.3, 'Konzum')
    const near = booking('2026-10-11', -45.3, 'Konzum')
    const copied = booking('2026-10-12', -45.3, 'Konzum d.o.o.')
    expect(bookedTwins([copied], [far, near]).get(copied)).toEqual({ kind: 'like', booked: near })
  })
})
