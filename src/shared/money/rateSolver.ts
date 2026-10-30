import { daysBetween } from '../calendar/civilDate'
import type { CivilDate } from '../calendar/civilDate'
import type { Money } from './money'

/** Money that moved on a day, signed by the caller's convention, such as a deposit negative and a withdrawal positive. */
export interface DatedFlow {
  readonly date: CivilDate
  readonly amount: Money
}

/** Years from the first flow's day to a flow's day, as the rate being solved counts them. */
export type YearsBetween = (from: CivilDate, to: CivilDate) => number

/** XIRR's measure: whole days over 365. */
export function daysOver365(from: CivilDate, to: CivilDate): number {
  return daysBetween(from, to) / 365
}

/**
 * Yearly rates where the search looks for a change of sign: every percentage point from −99% to 100%, so two
 * roots a point or more apart fall in different brackets, then wider steps up to 10,000%.
 */
const SEARCH_GRID = [-0.9999, ...Array.from({ length: 200 }, (_, index) => (index - 99) / 100), 2, 5, 10, 100]
const TOLERANCE = 1e-12
const MOST_HALVINGS = 200

/**
 * The yearly rate r at which every flow, discounted by (1 + r) to the power of minus its years since
 * the first flow, adds up to zero. Where flows change sign more than once and several rates balance
 * them, it is the one nearest zero. Null when no rate between −99.99% and 10,000% balances them, as
 * when every flow has the same sign.
 */
export function solvedRate(flows: readonly DatedFlow[], yearsBetween: YearsBetween): number | null {
  if (flows.length === 0) {
    return null
  }
  const first = flows.reduce((earliest, flow) => (flow.date < earliest ? flow.date : earliest), flows[0]!.date)
  const timed = flows.map((flow) => ({ amount: flow.amount, years: yearsBetween(first, flow.date) }))
  const presentValue = (rate: number): number => timed.reduce((total, flow) => total + flow.amount * (1 + rate) ** -flow.years, 0)

  const roots = SEARCH_GRID.slice(1)
    .map((high, index) => ({ low: SEARCH_GRID[index]!, high }))
    .filter((bracket) => Math.sign(presentValue(bracket.low)) !== Math.sign(presentValue(bracket.high)))
    .map((bracket) => bisected(presentValue, bracket.low, bracket.high))
  return roots.reduce<number | null>((nearest, root) => (nearest === null || Math.abs(root) < Math.abs(nearest) ? root : nearest), null)
}

function bisected(presentValue: (rate: number) => number, low: number, high: number): number {
  const lowSign = Math.sign(presentValue(low))
  if (lowSign === 0) {
    return low
  }
  let below = low
  let above = high
  for (let halving = 0; halving < MOST_HALVINGS && above - below > TOLERANCE; halving++) {
    const middle = (below + above) / 2
    const middleValue = presentValue(middle)
    if (middleValue === 0) {
      return middle
    }
    if (Math.sign(middleValue) === lowSign) {
      below = middle
    } else {
      above = middle
    }
  }
  return (below + above) / 2
}
