import type { CivilDate } from '../../../shared/calendar/civilDate'
import { subtractMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { Transaction } from './workbook'

/** What the booking order reads of a ledger entry. */
export type BookedEntry = Pick<Transaction, 'account' | 'date' | 'amount' | 'balance' | 'reference' | 'counterparty' | 'description'>

/** One account's day whose balances do not follow from one another, so its order is a guess. */
export interface UnchainedDay<Entry extends BookedEntry> {
  readonly account: string
  readonly date: CivilDate
  /** The entry the guessed order closes the day on. */
  readonly closing: Entry
}

export interface BookingOrder<Entry extends BookedEntry> {
  /** Oldest first. */
  readonly entries: readonly Entry[]
  readonly unchained: readonly UnchainedDay<Entry>[]
}

/**
 * The order the bank booked the entries in, from their fields alone. Within one account and day
 * each entry's balance is the one before plus its amount, and the first opens at the account's
 * closing balance of its previous day where it can, so the balances give the order. Where they
 * allow more than one, the reference decides, then the counterparty, the description and the
 * amount. A day whose balances do not chain is put in that order of its fields and reported. Across
 * accounts on one day no field decides, so the accounts follow each other by name.
 */
export function bookingOrder<Entry extends BookedEntry>(entries: readonly Entry[]): BookingOrder<Entry> {
  const days: { readonly account: string; readonly date: CivilDate; readonly entries: readonly Entry[] }[] = []
  const unchained: UnchainedDay<Entry>[] = []
  for (const [account, ofAccount] of groupedBy(entries, (entry) => entry.account)) {
    let closing: Money | null = null
    for (const [date, ofDay] of [...groupedBy(ofAccount, (entry) => entry.date)].sort(([earlier], [later]) => textOrder(earlier, later))) {
      const chain: Entry[] | null = chained(ofDay, closing) ?? (closing === null ? null : chained(ofDay, null))
      const day: Entry[] = chain ?? [...ofDay].sort(byFields)
      if (chain === null) {
        unchained.push({ account, date, closing: day[day.length - 1]! })
      }
      days.push({ account, date, entries: day })
      closing = day[day.length - 1]!.balance
    }
  }
  days.sort((earlier, later) => textOrder(earlier.date, later.date) || textOrder(earlier.account, later.account))
  return { entries: days.flatMap((day) => day.entries), unchained }
}

/**
 * The day's entries in one chain from `opening`, or from any first entry when it is null, or null
 * when no chain holds them all. At each step the first entry by its fields that leaves the rest a
 * chain of their own goes next, so the result is the chain the fields put first.
 */
function chained<Entry extends BookedEntry>(entries: readonly Entry[], opening: Money | null): Entry[] | null {
  const left = [...entries].sort(byFields)
  const chain: Entry[] = []
  let balance = opening
  while (left.length > 0) {
    const next = left.findIndex(
      (entry, index) => (balance === null || openingOf(entry) === balance) && chainsFrom(entry.balance, [...left.slice(0, index), ...left.slice(index + 1)]),
    )
    if (next === -1) {
      return null
    }
    const [entry] = left.splice(next, 1)
    chain.push(entry!)
    balance = entry!.balance
  }
  return chain
}

/**
 * Whether the entries can follow one another from `from`. Each entry leads from the balance it
 * opens at to the one it closes at, so a chain through all of them is a path that uses each lead
 * once. One exists when the leads are joined up through `from`, and every balance is left as often
 * as it is reached, except that `from` may be left once more and one other balance reached once more.
 */
function chainsFrom(from: Money, entries: readonly BookedEntry[]): boolean {
  if (entries.length === 0) {
    return true
  }
  const surplus = new Map<Money, number>()
  const neighbours = new Map<Money, Money[]>()
  for (const entry of entries) {
    const opens = openingOf(entry)
    surplus.set(opens, (surplus.get(opens) ?? 0) + 1)
    surplus.set(entry.balance, (surplus.get(entry.balance) ?? 0) - 1)
    neighbours.set(opens, [...(neighbours.get(opens) ?? []), entry.balance])
    neighbours.set(entry.balance, [...(neighbours.get(entry.balance) ?? []), opens])
  }
  if (!entries.some((entry) => openingOf(entry) === from)) {
    return false
  }
  const ends = [...surplus].filter(([balance, count]) => balance !== from && count !== 0)
  const balanced = surplus.get(from) === 1 ? ends.length === 1 && ends[0]![1] === -1 : surplus.get(from) === 0 && ends.length === 0
  return balanced && reachedFrom(from, neighbours) === neighbours.size
}

function reachedFrom(from: Money, neighbours: ReadonlyMap<Money, readonly Money[]>): number {
  const reached = new Set<Money>([from])
  const waiting = [from]
  while (waiting.length > 0) {
    for (const next of neighbours.get(waiting.pop()!) ?? []) {
      if (!reached.has(next)) {
        reached.add(next)
        waiting.push(next)
      }
    }
  }
  return reached.size
}

function openingOf(entry: BookedEntry): Money {
  return subtractMoney(entry.balance, entry.amount)
}

function byFields(earlier: BookedEntry, later: BookedEntry): number {
  return (
    textOrder(earlier.reference, later.reference) ||
    textOrder(earlier.counterparty, later.counterparty) ||
    textOrder(earlier.description, later.description) ||
    earlier.amount - later.amount ||
    earlier.balance - later.balance
  )
}

function textOrder(earlier: string, later: string): number {
  return earlier < later ? -1 : earlier > later ? 1 : 0
}

function groupedBy<Entry, Key>(entries: readonly Entry[], keyOf: (entry: Entry) => Key): Map<Key, Entry[]> {
  const groups = new Map<Key, Entry[]>()
  for (const entry of entries) {
    const key = keyOf(entry)
    const group = groups.get(key)
    if (group === undefined) {
      groups.set(key, [entry])
    } else {
      group.push(entry)
    }
  }
  return groups
}
