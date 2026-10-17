import type { MonthKey } from '../../../shared/calendar/monthKey'
import { negateMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import type { Figure } from '../../filters/domain/drillTarget'
import type { MonthOfProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'

/** What the newest complete month brought, and how long the cash lasts, as the parts of one plain statement. */
export interface Headline {
  readonly month: MonthKey
  readonly cameIn: Figure
  readonly wentOut: Figure
  /** What the month lost, read positive. Null when it did not lose money. */
  readonly loss: Money | null
  /** "about 2 years", or null when nothing is being spent. */
  readonly cashLasts: string | null
}

/** The headline of the newest complete month, or null while the ledger has none. */
export function headline(months: readonly MonthOfProfitAndLoss[], runwayMonths: number | null): Headline | null {
  const newest = [...months].reverse().find((month) => month.complete)
  if (newest === undefined) {
    return null
  }
  const net = newest.lines.net.amount
  return {
    month: newest.month,
    cameIn: newest.lines.income,
    wentOut: newest.lines.cost,
    loss: net < 0 ? negateMoney(net) : null,
    cashLasts: runwayInWords(runwayMonths),
  }
}

/** A runway the way a person says it: months up to a year and a half, years after that. */
export function runwayInWords(months: number | null): string | null {
  if (months === null) {
    return null
  }
  if (months < 1) {
    return 'less than a month'
  }
  if (months < 18) {
    const whole = Math.round(months)
    return whole === 1 ? 'about a month' : `about ${whole} months`
  }
  const years = Math.round(months / 12)
  return `about ${years} years`
}
