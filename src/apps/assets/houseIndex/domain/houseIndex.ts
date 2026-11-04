import type { HouseRegion } from '../../workbook/domain/asset'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthNumber, monthOf } from '../../../../shared/calendar/monthKey'
import { dividedRounded, moneyFromCents } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** A calendar quarter as the DZS writes it, such as 2026Q2. Its text sorts in time order. */
export type Quarter = `${number}Q${1 | 2 | 3 | 4}`

export function quarterOf(day: CivilDate): Quarter {
  return `${yearOf(day)}Q${Math.ceil(monthNumber(monthOf(day)) / 3) as 1 | 2 | 3 | 4}`
}

/** The DZS house price index (2025 = 100) of one region by quarter, in whole hundredths, so 113.53 is 11353. */
export type RegionIndex = ReadonlyMap<Quarter, number>

export type HouseIndex = Readonly<Record<HouseRegion, RegionIndex>>

/**
 * A value carried to a quarter by the index, the quarter of a value the index has not reached yet, or the index's first
 * quarter when the value is older than that.
 */
export type CarriedValue =
  { readonly kind: 'carried'; readonly cents: Money; readonly quarter: Quarter } | { readonly kind: 'not-out'; readonly quarter: Quarter } | { readonly kind: 'not-reached'; readonly first: Quarter }

/**
 * A value of the day `from`, carried by the region's index from that day's quarter to the newest quarter the index
 * has that is not after the day's. A value of a quarter newer than every quarter in the index is not out yet, and one
 * of a quarter the index has no figure for is not reached. Null for a region the index holds nothing of.
 */
export function carriedForward(value: Money, from: CivilDate, index: RegionIndex, day: CivilDate): CarriedValue | null {
  const quarters = [...index.keys()].sort()
  const [first] = quarters
  const newest = quarters.at(-1)
  if (first === undefined || newest === undefined) return null
  const fromQuarter = quarterOf(from)
  if (fromQuarter > newest) return { kind: 'not-out', quarter: fromQuarter }
  const base = index.get(fromQuarter)
  const to = quarters.filter((quarter) => quarter <= quarterOf(day)).at(-1)
  const reached = to === undefined ? undefined : index.get(to)
  if (base === undefined || to === undefined || reached === undefined) return { kind: 'not-reached', first }
  return { kind: 'carried', cents: moneyFromCents(dividedRounded(value * reached, base)), quarter: to }
}
