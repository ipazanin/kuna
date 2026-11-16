import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { roundHalfAwayFromZero } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Figure } from '../../filters/domain/drillTarget'
import { plural } from '../../../../shared/text/translation'
import type { MonthOfProfitAndLoss } from '../../trends/domain/monthlyProfitAndLoss'
import { words } from './words'

/** What the newest complete month brought, as the parts of one plain statement. */
export interface Headline {
  readonly month: MonthKey
  readonly cameIn: Figure
  readonly wentOut: Figure
  /** What came in less what went out. */
  readonly net: Money
}

/** The headline of the newest complete month, or null while the ledger has none. */
export function headline(months: readonly MonthOfProfitAndLoss[]): Headline | null {
  const newest = [...months].reverse().find((month) => month.complete)
  if (newest === undefined) {
    return null
  }
  return {
    month: newest.month,
    cameIn: newest.lines.income,
    wentOut: newest.lines.cost,
    net: newest.lines.net.amount,
  }
}

/** A runway the way a person says it: months up to a year and a half, years after that. */
export function runwayInWords(months: number | null): string | null {
  if (months === null) {
    return null
  }
  if (months < 1) {
    return words.runway.underAMonth
  }
  if (months < 18) {
    const whole = roundHalfAwayFromZero(months)
    return whole === 1 ? words.runway.aboutAMonth : plural(words.runway.aboutMonths(whole), whole)
  }
  const years = roundHalfAwayFromZero(months / 12)
  return plural(words.runway.aboutYears(years), years)
}
