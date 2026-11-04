import { wholeMonthsBetween } from '../../../../shared/calendar/monthKey'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dividedRounded, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** One row of the table: from `from` whole months after first registration up to, not including, `to`, the share of a new car's special tax left, in hundredths of a percent. The Pravilnik sets it by how far such a car's value falls. */
export interface CustomsRow {
  readonly from: number
  readonly to: number
  readonly share: number
}

/** Tablica 1 of the Pravilnik o posebnom porezu na motorna vozila (NN 1/2017, članak 9. stavak 3.). */
export const CUSTOMS_TABLE: readonly CustomsRow[] = [
  { from: 0, to: 1, share: 9600 },
  { from: 1, to: 2, share: 9300 },
  { from: 2, to: 3, share: 9000 },
  { from: 3, to: 4, share: 8800 },
  { from: 4, to: 5, share: 8600 },
  { from: 5, to: 6, share: 8400 },
  { from: 6, to: 7, share: 8200 },
  { from: 7, to: 8, share: 8100 },
  { from: 8, to: 9, share: 8000 },
  { from: 9, to: 10, share: 7900 },
  { from: 10, to: 11, share: 7800 },
  { from: 11, to: 12, share: 7700 },
  { from: 12, to: 13, share: 7604 },
  { from: 13, to: 14, share: 7508 },
  { from: 14, to: 15, share: 7412 },
  { from: 15, to: 16, share: 7316 },
  { from: 16, to: 17, share: 7220 },
  { from: 17, to: 18, share: 7124 },
  { from: 18, to: 19, share: 7028 },
  { from: 19, to: 20, share: 6932 },
  { from: 20, to: 21, share: 6836 },
  { from: 21, to: 22, share: 6740 },
  { from: 22, to: 23, share: 6644 },
  { from: 23, to: 24, share: 6500 },
  { from: 24, to: 26, share: 6358 },
  { from: 26, to: 28, share: 6216 },
  { from: 28, to: 30, share: 6074 },
  { from: 30, to: 32, share: 5932 },
  { from: 32, to: 34, share: 5790 },
  { from: 34, to: 36, share: 5648 },
  { from: 36, to: 38, share: 5506 },
  { from: 38, to: 40, share: 5364 },
  { from: 40, to: 42, share: 5222 },
  { from: 42, to: 44, share: 5080 },
  { from: 44, to: 46, share: 4938 },
  { from: 46, to: 48, share: 4796 },
  { from: 48, to: 51, share: 4636 },
  { from: 51, to: 54, share: 4476 },
  { from: 54, to: 57, share: 4316 },
  { from: 57, to: 60, share: 4156 },
  { from: 60, to: 64, share: 4006 },
  { from: 64, to: 68, share: 3856 },
  { from: 68, to: 72, share: 3706 },
  { from: 72, to: 78, share: 3526 },
  { from: 78, to: 84, share: 3346 },
  { from: 84, to: 90, share: 3166 },
  { from: 90, to: 96, share: 2986 },
  { from: 96, to: 102, share: 2806 },
  { from: 102, to: 108, share: 2626 },
  { from: 108, to: 114, share: 2446 },
  { from: 114, to: 120, share: 2266 },
  { from: 120, to: 132, share: 2172 },
  { from: 132, to: 144, share: 2112 },
  { from: 144, to: 156, share: 2052 },
  { from: 156, to: 168, share: 1992 },
  { from: 168, to: 180, share: 1932 },
]

/** The table's share, in hundredths of a percent, at a number of whole months since first registration. */
export interface TableShare {
  readonly months: number
  readonly share: number
}

/** A car's estimate by the table, with the table's share on the day, and on the day it was bought for a car bought used. */
export interface CustomsEstimate {
  readonly cents: Money
  readonly onDay: TableShare
  /** Null for a car bought on or before its first registration, which starts from its whole price. */
  readonly whenBought: TableShare | null
}

/**
 * What a car is worth on the day by the table: its price times the share on the day over the share on the day it was
 * bought. A car bought on or before its first registration keeps the whole price at the start, so a new car loses
 * value from the first row and a used one only what it lost since it was bought. Months are whole months from first
 * registration, a month having passed on the same day of the next month, or its last day when that day is missing.
 */
export function customsEstimate(price: Money, bought: CivilDate, firstRegistration: CivilDate, day: CivilDate): CustomsEstimate {
  const onDay = shareAt(wholeMonthsBetween(firstRegistration, day))
  const whenBought = bought <= firstRegistration ? null : shareAt(wholeMonthsBetween(firstRegistration, bought))
  return { cents: moneyFromCents(dividedRounded(price * onDay.share, whenBought?.share ?? 10_000)), onDay, whenBought }
}

/** The table's share after this many whole months, the last row holding past its end. */
function shareAt(months: number): TableShare {
  const row = CUSTOMS_TABLE.find((candidate) => months >= candidate.from && months < candidate.to) ?? CUSTOMS_TABLE[CUSTOMS_TABLE.length - 1]!
  return { months, share: row.share }
}
