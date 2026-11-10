import type { AccountMoney } from './accountMoney'
import type { Money } from './money'
import { daysBetween } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { fold } from '../text/fold'

/**
 * How many days apart two bank records of one booking may be dated. A typed purchase may book up to a week later, but two
 * records a bank made of one account differ only by booking and value day, which spans a weekend and a holiday.
 */
export const BOOKING_DAYS_APART = 3

/** What becomes of a copied row that looks like a booking already in the books: it waits for the person, or it goes in as they said. */
export const LOOK_ALIKES = ['ask', 'import'] as const

export type LookAlikes = (typeof LOOK_ALIKES)[number]

/** A booking of one account as the look-alike test reads it: its day, its signed amount, who the other side is and what the bank wrote. */
export interface Booking<Cents extends Money | AccountMoney> {
  readonly date: CivilDate
  readonly amount: Cents
  readonly counterparty: string
  readonly description: string
}

/** A copied row's twin in the books: `same` for the same day, amount and counterparty, `like` for a match that only the person can confirm. */
export type BookedTwin<Booked> = { readonly kind: 'same'; readonly booked: Booked } | { readonly kind: 'like'; readonly booked: Booked }

const WORD = /[\p{L}\p{N}]{3,}/gu

function wordsOf(booking: Booking<Money | AccountMoney>): ReadonlySet<string> {
  return new Set(fold(`${booking.counterparty} ${booking.description}`).match(WORD) ?? [])
}

/** Whether the texts leave the two as one booking: either side gives none, or they share a word of three letters or more. */
function textsAgree(copied: ReadonlySet<string>, booked: ReadonlySet<string>): boolean {
  return copied.size === 0 || booked.size === 0 || [...copied].some((word) => booked.has(word))
}

function isSame(copied: Booking<Money | AccountMoney>, booked: Booking<Money | AccountMoney>): boolean {
  const counterparty = fold(copied.counterparty)
  return copied.date === booked.date && copied.amount === booked.amount && counterparty !== '' && counterparty === fold(booked.counterparty)
}

/**
 * Pairs rows copied off a statement with bookings of the same account already in the books, one to one. A row is the same booking
 * when it has the same day, amount and counterparty. It looks like one when the amount is equal, the days are at most 3 apart and
 * the texts agree. Same bookings pair first, then each row left takes the nearest look-alike left. An amount is signed, so money in
 * never pairs with money out. The caller gives only bookings of the copied rows' account.
 */
export function bookedTwins<Cents extends Money | AccountMoney, Copied extends Booking<Cents>, Booked extends Booking<Cents>>(
  copiedRows: readonly Copied[],
  bookings: readonly Booked[],
): ReadonlyMap<Copied, BookedTwin<Booked>> {
  const twins = new Map<Copied, BookedTwin<Booked>>()
  const taken = new Set<Booked>()
  for (const copied of copiedRows) {
    const booked = bookings.find((candidate) => !taken.has(candidate) && isSame(copied, candidate))
    if (booked === undefined) continue
    taken.add(booked)
    twins.set(copied, { kind: 'same', booked })
  }
  const wordsOfBooked = new Map(bookings.map((booked) => [booked, wordsOf(booked)]))
  for (const copied of copiedRows) {
    if (twins.has(copied)) continue
    const words = wordsOf(copied)
    const away = (booked: Booked): number => Math.abs(daysBetween(copied.date, booked.date))
    const booked = bookings
      .filter((candidate) => !taken.has(candidate) && candidate.amount === copied.amount && away(candidate) <= BOOKING_DAYS_APART && textsAgree(words, wordsOfBooked.get(candidate)!))
      .reduce<Booked | undefined>((nearest, candidate) => (nearest === undefined || away(candidate) < away(nearest) ? candidate : nearest), undefined)
    if (booked === undefined) continue
    taken.add(booked)
    twins.set(copied, { kind: 'like', booked })
  }
  return twins
}
