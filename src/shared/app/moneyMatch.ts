import { daysBetween } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import { ZERO_ACCOUNT_MONEY, subtractAccountMoney } from '../money/accountMoney'
import type { AccountMoney } from '../money/accountMoney'

/** How long before and after the expected day a bank may book the same money. */
const BOOKED_DAYS_BEFORE = 3
const BOOKED_DAYS_AFTER = 7

/** How far past that window an equal amount is still offered, either way. */
const NEAR_DAYS = 14

/** The share of the larger amount a different amount may differ by and still be offered. */
const NEAR_AMOUNT_SHARE = 0.1

/** What the money tests read of each side: the day the money is expected or booked, and its amount. */
export interface DatedMoney {
  readonly date: CivilDate
  readonly amount: AccountMoney
}

/** Whether the booked day falls from 3 days before to 7 days after the expected day, such as the day you typed or an instalment's due date. */
export function inWindow(expected: DatedMoney, booked: DatedMoney): boolean {
  const days = daysBetween(expected.date, booked.date)
  return days >= -BOOKED_DAYS_BEFORE && days <= BOOKED_DAYS_AFTER
}

/** Whether a booked row is close enough to be offered: an equal amount within 14 days, or within a tenth of the larger amount inside the window. */
export function isNear(expected: DatedMoney, booked: DatedMoney): boolean {
  if (expected.amount === booked.amount) return Math.abs(daysBetween(expected.date, booked.date)) <= NEAR_DAYS
  const sameWay = expected.amount < 0 === booked.amount < 0
  return sameWay && inWindow(expected, booked) && Math.abs(expected.amount - booked.amount) <= NEAR_AMOUNT_SHARE * Math.max(Math.abs(expected.amount), Math.abs(booked.amount))
}

/** The row booked nearest the day, the first of them on a tie, which is the earlier for rows in date order. */
export function nearestTo<Row extends { readonly date: CivilDate }>(date: CivilDate, rows: readonly Row[]): Row | undefined {
  const away = (row: Row): number => Math.abs(daysBetween(date, row.date))
  return rows.reduce<Row | undefined>((nearest, row) => (nearest === undefined || away(row) < away(nearest) ? row : nearest), undefined)
}

/** Money expected on a day and the row taken for it. */
export interface MoneyMatch<Expected, Row> {
  readonly expected: Expected
  readonly row: Row
  /** True when the row is exactly the money inside the window, false when it is only near it. */
  readonly exact: boolean
  /** The row's amount less the expected one, zero for an exact match. */
  readonly difference: AccountMoney
}

/** Which rows the caller lets stand for which money. */
export interface MatchTests<Expected, Row> {
  /** Whether a row may be the money at all, such as a row on the same account. Every row may when it is left out. */
  readonly mayBe?: (expected: Expected, row: Row) => boolean
  /** Whether a row is near enough to offer for money no exact row is left for. */
  readonly near: (expected: Expected, row: Row) => boolean
}

/**
 * Takes rows for money expected on a day, each row once. Each expected money in the order given takes the nearest row of
 * exactly its amount inside the window, and those left, in the same order, take the nearest row `near` accepts. Gives the
 * matches in the order of the expected money, without the money that took no row.
 */
export function matchMoney<Expected extends DatedMoney, Row extends DatedMoney>(expected: readonly Expected[], rows: readonly Row[], tests: MatchTests<Expected, Row>): MoneyMatch<Expected, Row>[] {
  const mayBe = tests.mayBe ?? (() => true)
  const taken = new Set<Row>()
  const take = (wanted: Expected, fits: (row: Row) => boolean): Row | undefined => {
    const row = nearestTo(
      wanted.date,
      rows.filter((candidate) => !taken.has(candidate) && mayBe(wanted, candidate) && fits(candidate)),
    )
    if (row !== undefined) taken.add(row)
    return row
  }
  const exact = expected.map((wanted) => take(wanted, (row) => row.amount === wanted.amount && inWindow(wanted, row)))
  return expected.flatMap((wanted, index): MoneyMatch<Expected, Row>[] => {
    const paying = exact[index]
    if (paying !== undefined) return [{ expected: wanted, row: paying, exact: true, difference: ZERO_ACCOUNT_MONEY }]
    const near = take(wanted, (row) => tests.near(wanted, row))
    return near === undefined ? [] : [{ expected: wanted, row: near, exact: false, difference: subtractAccountMoney(near.amount, wanted.amount) }]
  })
}
