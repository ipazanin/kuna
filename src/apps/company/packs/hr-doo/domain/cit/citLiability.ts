import { civilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { monthCountBetween, monthOf } from '../../../../../../shared/calendar/monthKey'
import { ZERO, dividedRounded, moneyFromCents, subtractMoney } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { atRate, deducted, percentText, rulesOf, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import type { TaxBase } from './taxBase'

/** The days a PD return covers. The first period starts on the day the company was registered. */
export interface TaxPeriod {
  readonly from: CivilDate
  readonly to: CivilDate
  readonly first: boolean
}

export interface TracedRate {
  readonly label: string
  readonly basisPoints: Rate
  readonly rules: readonly RuleCitation[]
}

/** PD lines 43 to 59: the rate, the tax, what the advances settled and the advance for the next period. */
export interface CitLiability {
  readonly period: TaxPeriod
  /** Calendar months the period touches, which divide the liability into the next period's advance. */
  readonly periodMonths: number
  /** PD line 1 less line 28, the revenue the rate threshold is tested against. */
  readonly rateTestRevenue: TracedFigure
  /** PD line 43. */
  readonly rate: TracedRate
  /** PD lines 44 and 53. No relief or credit reduces it. */
  readonly liability: TracedFigure
  /** PD line 56. Null when the advances paid are not known. */
  readonly advancesPaid: TracedFigure | null
  /** PD line 57. Null with the advances. */
  readonly balanceDue: TracedFigure | null
  /** PD line 58. Null with the advances. */
  readonly refund: TracedFigure | null
  /** PD line 59, the monthly advance for the next period. */
  readonly monthlyAdvance: TracedFigure
}

/**
 * The corporate tax of a period on its tax base, at the rate the period's revenue selects. A first
 * period has no advances by law, so its advances are nothing whatever is passed. Otherwise the
 * advances paid come from the payment matching, or stay unknown.
 */
export function citLiability(base: TaxBase, period: TaxPeriod, advancesPaid: TracedFigure | null, rules: RuleSource = ruleValue): CitLiability {
  if (yearOf(period.from) !== base.year || yearOf(period.to) !== base.year) {
    throw new RangeError(`The tax period ${period.from} to ${period.to} is not in ${base.year}.`)
  }
  const taxPeriod = civilDate(base.year, 1, 1)
  const rateRule = rules('hr.cit.rate', taxPeriod)
  const testRule = rules('hr.cit.rate-test-revenue', taxPeriod)
  const rateTestRevenue = tracedFigure('PD line 1 less line 28, with no grant for special circumstances on line 28', base.revenue.amount, 'ledger', [
    testRule.citation,
  ], [base.revenue])
  const high = rateTestRevenue.amount >= rateRule.value.threshold.cents
  const basisPoints = high ? rateRule.value.highRate.basisPoints : rateRule.value.lowRate.basisPoints
  const rate: TracedRate = {
    label: high ? 'PD line 43, the rate for revenue at or above the threshold' : 'PD line 43, the rate for revenue below the threshold',
    basisPoints,
    rules: [rateRule.citation, testRule.citation],
  }
  const taxable = base.base.amount > 0 ? base.base.amount : ZERO
  const liability = tracedFigure(`PD lines 44 and 53, tax at ${percentText(basisPoints)}`, atRate(taxable, basisPoints), 'ledger', [
    ...rate.rules,
    ...base.base.rules,
  ], [base.base])

  const advanceRule = rules('hr.cit.monthly-advance', taxPeriod)
  const periodMonths = monthCountBetween(monthOf(period.from), monthOf(period.to))
  const monthlyAdvance = monthlyAdvanceOf(liability, periodMonths, base.year, rules)

  const paid =
    period.first && !advanceRule.value.advancesInFirstPeriod.holds
      ? tracedFigure('PD line 56, no advances in a first tax period', ZERO, 'ledger', [advanceRule.citation])
      : advancesPaid
  const settlement = paid === null ? null : balanceOf(liability, paid, rules('hr.cit.balance-due', taxPeriod).citation)
  return {
    period,
    periodMonths,
    rateTestRevenue,
    rate,
    liability,
    advancesPaid: paid,
    balanceDue: settlement?.balanceDue ?? null,
    refund: settlement?.refund ?? null,
    monthlyAdvance,
  }
}

/** The period of a year's return. A first period starts on the day the company was registered, and a year before that has none. */
export function taxPeriodOf(year: number, registered: CivilDate | null): TaxPeriod {
  if (registered !== null && yearOf(registered) > year) {
    throw new RangeError(`The company was registered on ${registered}, after ${year}.`)
  }
  const first = registered !== null && yearOf(registered) === year
  return { from: first ? registered : civilDate(year, 1, 1), to: civilDate(year, 12, 31), first }
}

/** PD line 59: a year's liability over the months of its period, the monthly advance of the next one. */
export function monthlyAdvanceOf(liability: TracedFigure, months: number, year: number, rules: RuleSource = ruleValue): TracedFigure {
  const advanceRule = rules('hr.cit.monthly-advance', civilDate(year, 1, 1))
  if (advanceRule.value.liabilityDividedBy.text !== 'months-of-prior-period') {
    throw new RangeError(`The advance rule in force in ${year} does not divide the liability by the months of the period.`)
  }
  if (!Number.isInteger(months) || months < 1 || months > 12) {
    throw new RangeError(`${months} is not a number of months a tax period can have.`)
  }
  return tracedFigure(
    `PD line 59, the liability over the ${months} months of the period`,
    moneyFromCents(dividedRounded(liability.amount, months)),
    liability.basis,
    [advanceRule.citation, ...liability.rules],
    [liability],
  )
}

function balanceOf(
  liability: TracedFigure,
  paid: TracedFigure,
  citation: RuleCitation,
): { readonly balanceDue: TracedFigure; readonly refund: TracedFigure } {
  const difference = subtractMoney(liability.amount, paid.amount)
  const steps = [liability, deducted(paid)]
  const cited = [citation, ...rulesOf(steps)]
  return {
    balanceDue: tracedFigure('PD line 57, balance due', difference > 0 ? difference : ZERO, 'ledger', cited, steps),
    refund: tracedFigure('PD line 58, overpaid', difference < 0 ? moneyFromCents(0 - difference) : ZERO, 'ledger', cited, steps),
  }
}
