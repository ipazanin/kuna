import type { GrowthPoint } from './portfolioPerformance'
import { daysBetween } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shareFromRatio } from '../../../../shared/money/percent'
import type { Share } from '../../../../shared/money/percent'

/** How far the growth line stood below its highest point so far, at one of its points, as a fraction at or below zero. */
export interface BelowPeak {
  readonly date: CivilDate
  readonly below: Share
}

/** A stretch below a peak, from the peak's day to the day the line got back to it, or to its last day. */
export interface TimeBelowPeak {
  readonly from: CivilDate
  readonly to: CivilDate
  readonly days: number
  readonly regained: boolean
}

export interface Underwater {
  readonly points: readonly BelowPeak[]
  /** The same as the period's largest fall. */
  readonly deepest: Share
  readonly now: Share
  /** The first of the longest, null when the line never fell below a peak. */
  readonly longest: TimeBelowPeak | null
}

/** Each point of the growth line against the running peak up to it. Null for a line of fewer than two points. */
export function underwater(growth: readonly GrowthPoint[]): Underwater | null {
  const first = growth[0]
  const last = growth.at(-1)
  if (first === undefined || last === undefined || growth.length < 2) {
    return null
  }
  let peak = first
  let fell = false
  const stretches: TimeBelowPeak[] = []
  const points = growth.map((point): BelowPeak => {
    if (point.portfolio >= peak.portfolio) {
      if (fell) {
        stretches.push({ from: peak.date, to: point.date, days: daysBetween(peak.date, point.date), regained: true })
      }
      peak = point
      fell = false
    } else {
      fell = true
    }
    return { date: point.date, below: shareFromRatio(point.portfolio / peak.portfolio - 1) }
  })
  if (fell) {
    stretches.push({ from: peak.date, to: last.date, days: daysBetween(peak.date, last.date), regained: false })
  }
  return {
    points,
    deepest: shareFromRatio(Math.min(...points.map((point) => point.below))),
    now: points.at(-1)!.below,
    longest: stretches.reduce<TimeBelowPeak | null>((found, stretch) => (found === null || stretch.days > found.days ? stretch : found), null),
  }
}
