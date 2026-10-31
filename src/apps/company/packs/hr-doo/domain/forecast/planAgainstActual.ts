import { displayName } from '../../../../workbook/domain/displayName'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../../../shared/calendar/monthLabel'
import { isOwnerPayCost } from '../packRoles'
import { deducted, summed } from '../payroll/payrollArithmetic'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { CategoryForecast, ForecastMonth } from './forecastLines'
import type { YearForecast } from './forecastYear'
import { words } from './words'

export interface PlanActualMonth {
  readonly month: MonthKey
  readonly plan: TracedFigure
  readonly actual: TracedFigure
  /** The actual less the plan. */
  readonly difference: TracedFigure
}

/** One line of the plan against the ledger, over the months the ledger settles. Income and costs both read positive. */
export interface PlanActualLine {
  readonly key: string
  readonly label: string
  /** True for a cost, so a positive difference means it cost more than planned. */
  readonly cost: boolean
  readonly months: readonly PlanActualMonth[]
  readonly plan: TracedFigure
  readonly actual: TracedFigure
  readonly difference: TracedFigure
}

/**
 * Each line the plan reaches in a month the ledger has settled, with the plan it replaced: revenue
 * against the billing plan's rows of the month, each category against its plan row, and the owner
 * pay categories together against the plan's owner pay scenarios.
 */
export function planAgainstActual(forecast: YearForecast): PlanActualLine[] {
  const synthetic = new Set(forecast.ownerPay?.lines.map((entry) => entry.category.slug) ?? [])
  const ledgerCategories = forecast.categories.filter((entry) => !synthetic.has(entry.category.slug))
  const revenue = comparedLine(
    'revenue',
    words.planActual.revenue,
    false,
    forecast.revenue.months.map((entry) => pair(entry, entry.figure, entry.plan)),
  )
  const categories = ledgerCategories.map((entry) => {
    const cost = entry.category.bucket !== 'income'
    return comparedLine(
      entry.category.slug,
      displayName(entry.category.slug, entry.category.label),
      cost,
      entry.forecast.months.map((month) => pair(month, month.figure, month.plan, cost)),
    )
  })
  const ownerPay =
    forecast.ownerPay === null
      ? []
      : [
          ownerPayLine(
            forecast.ownerPay.lines,
            ledgerCategories.filter((entry) => isOwnerPayCost(entry.category)),
          ),
        ]
  return [revenue, ...categories, ...ownerPay].filter((line): line is PlanActualLine => line !== null)
}

interface MonthPair {
  readonly month: MonthKey
  readonly actual: TracedFigure
  readonly plan: TracedFigure
}

function pair(entry: ForecastMonth, actual: TracedFigure, plan: TracedFigure | null, cost = false): MonthPair | null {
  if (!entry.bases.includes('actual') || plan === null) {
    return null
  }
  return { month: entry.month, actual: cost ? deducted(actual) : actual, plan: cost ? deducted(plan) : plan }
}

/** The plan's owner pay against the owner pay categories the ledger booked, month by month. */
function ownerPayLine(planned: readonly CategoryForecast[], booked: readonly CategoryForecast[]): PlanActualLine | null {
  const months = (planned[0]?.forecast.months ?? []).map((entry, index): MonthPair | null => {
    const plans = planned.map((line) => (line.forecast.months[index] as ForecastMonth).plan)
    if (!entry.bases.includes('actual') || plans.every((plan) => plan === null)) {
      return null
    }
    const label = monthLabel(entry.month)
    return {
      month: entry.month,
      plan: deducted(
        summed(
          words.planActual.ownerPayPlanned(label),
          plans.filter((plan): plan is TracedFigure => plan !== null),
          'plan',
        ),
      ),
      actual: deducted(
        summed(
          words.planActual.ownerPayBooked(label),
          booked.map((line) => (line.forecast.months[index] as ForecastMonth).figure),
          'ledger',
        ),
      ),
    }
  })
  return comparedLine('owner-pay', words.planActual.ownerPay, true, months)
}

function comparedLine(key: string, label: string, cost: boolean, pairs: readonly (MonthPair | null)[]): PlanActualLine | null {
  const months = pairs
    .filter((entry): entry is MonthPair => entry !== null)
    .map((entry): PlanActualMonth => ({ ...entry, difference: summed(words.planActual.actualLessPlanIn(label, monthLabel(entry.month)), [entry.actual, deducted(entry.plan)], 'ledger') }))
  if (months.length === 0) {
    return null
  }
  const plan = summed(
    words.planActual.planned(label),
    months.map((entry) => entry.plan),
    'plan',
  )
  const actual = summed(
    words.planActual.fromLedger(label),
    months.map((entry) => entry.actual),
    'ledger',
  )
  return { key, label, cost, months, plan, actual, difference: summed(words.planActual.actualLessPlan(label), [actual, deducted(plan)], 'ledger') }
}
