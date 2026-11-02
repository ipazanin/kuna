import { externalFlows } from '../../performance/domain/portfolioPerformance'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, divideMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** How many months the bars show, the day's month last. */
const SHOWN_MONTHS = 24

/** How many complete months the average a month is over. */
const AVERAGED_MONTHS = 12

export interface MonthPutIn {
  readonly month: MonthKey
  /** Deposits less withdrawals, each in euros at its own rate. */
  readonly putIn: Money
}

/** How regularly money goes in. A month counts when it put in more than it took out. */
export interface InvestingRhythm {
  /** The 24 months up to the day's, oldest first. */
  readonly months: readonly MonthPutIn[]
  /** The months in a row that end with the day's month, or with the month before while the day's has no deposit. */
  readonly inARow: number
  /** Whether the day's month has no deposit yet, so the run ends the month before. Once it has one, it counts like any month. */
  readonly thisMonthWaits: boolean
  readonly longestRun: number
  /** What the 12 complete months before the day's put in, a month. */
  readonly averageMonth: Money
}

/** Deposits less withdrawals month by month up to the day, and the runs of months that put something in. */
export function investingRhythm(book: InvestmentBook, today: CivilDate): InvestingRhythm {
  const current = monthOf(today)
  const flows = externalFlows(book).filter((flow) => flow.date <= today)
  const totals = new Map<MonthKey, Money>()
  for (const flow of flows) {
    const month = monthOf(flow.date)
    totals.set(month, addMoney(totals.get(month) ?? ZERO, flow.amount))
  }
  const putInOf = (month: MonthKey): Money => totals.get(month) ?? ZERO
  const thisMonthWaits = !flows.some((flow) => flow.amount > 0 && monthOf(flow.date) === current)
  const first = [...totals.keys()].sort()[0]
  let run = 0
  let longestRun = 0
  for (const month of first === undefined ? [] : monthsFrom(first, thisMonthWaits ? addMonths(current, -1) : current)) {
    run = putInOf(month) > 0 ? run + 1 : 0
    longestRun = Math.max(longestRun, run)
  }
  return {
    months: monthsFrom(addMonths(current, 1 - SHOWN_MONTHS), current).map((month) => ({ month, putIn: putInOf(month) })),
    inARow: run,
    thisMonthWaits,
    longestRun,
    averageMonth: divideMoney(sumMoney(monthsFrom(addMonths(current, -AVERAGED_MONTHS), addMonths(current, -1)).map(putInOf)), AVERAGED_MONTHS),
  }
}
