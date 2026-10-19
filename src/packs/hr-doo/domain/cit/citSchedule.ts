import type { CompanyFacts } from '../../../../features/settings/domain/settings'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthKey, monthOf } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { sumMoney } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import type { PriorReturn } from './priorReturn'

export type CitObligationKind = 'balance-due' | 'advance'

/** A corporate tax payment the law expects, with the day it falls due. */
export interface CitObligation {
  readonly kind: CitObligationKind
  /** The tax period whose return counts the payment. */
  readonly taxYear: number
  /** The month an advance is for. Null for a balance due. */
  readonly month: MonthKey | null
  readonly dueOn: CivilDate
  readonly expected: TracedFigure
}

export interface CitSchedule {
  readonly year: number
  /** The balance due of the year before and the year's own advances, by due date. */
  readonly obligations: readonly CitObligation[]
  /** The advances expected for the year, which PD line 56 counts once they are paid. */
  readonly advances: TracedFigure
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

/**
 * The corporate tax a year expects to pay: the balance due on the previous year's return, and an
 * advance for each month of the year. From the month the rule names, an advance is the previous
 * year's monthly advance. Before it, the return of the year before that still sets it. A year with
 * no return yet, because the company was registered after it, sets no advance, so a first period
 * pays none and the next year starts at April. `priorReturns` holds the years the schedule reads:
 * the accountant's return for a closed year, or our own liability for a year the engine computes.
 */
export function citSchedule(year: number, priorReturns: readonly PriorReturn[], facts: CompanyFacts, rules: RuleSource = ruleValue): CitSchedule {
  const returnOf = priorReturnLookup(year, priorReturns, facts)
  const advances = advancesOf(year, returnOf, rules)
  const balance = balanceDueOf(year - 1, returnOf, rules)
  const obligations = [...(balance === null ? [] : [balance]), ...advances].sort((earlier, later) => earlier.dueOn.localeCompare(later.dueOn))
  return {
    year,
    obligations,
    advances: summed(`Advances expected for ${year}`, advances.map((advance) => advance.expected), 'ledger'),
  }
}

type ReturnLookup = (taxYear: number) => PriorReturn | null

/** The return of a year before the schedule's, or null for a year before the company was registered. */
function priorReturnLookup(year: number, priorReturns: readonly PriorReturn[], facts: CompanyFacts): ReturnLookup {
  const registered = facts.companyRegistered
  if (registered !== null && yearOf(registered) > year) {
    throw new RangeError(`The company was registered on ${registered}, after ${year}.`)
  }
  return (taxYear) => {
    if (registered !== null && taxYear < yearOf(registered)) {
      return null
    }
    const found = priorReturns.filter((candidate) => yearOf(candidate.period.to) === taxYear)
    if (found.length !== 1) {
      throw new RangeError(
        found.length === 0
          ? `The corporate tax schedule of ${year} needs the return for ${taxYear}.`
          : `The corporate tax schedule of ${year} was given ${found.length} returns for ${taxYear}.`,
      )
    }
    return found[0] ?? null
  }
}

/** The first month of a tax year whose advance the previous year's return sets. */
export function firstAdvanceAtNewAmount(taxYear: number, rules: RuleSource = ruleValue): MonthKey {
  const advanceRule = rules('hr.cit.monthly-advance', civilDate(taxYear, 1, 1))
  const month = MONTH_NAMES.indexOf(advanceRule.value.firstAdvanceMonthAtNewAmount.text) + 1
  if (month === 0) {
    throw new RangeError(`The advance rule in force in ${taxYear} names no month the new amount starts in.`)
  }
  return monthKey(taxYear, month)
}

function advancesOf(taxYear: number, returnOf: ReturnLookup, rules: RuleSource): CitObligation[] {
  const advanceRule = rules('hr.cit.monthly-advance', civilDate(taxYear, 1, 1))
  const firstAtNewAmount = firstAdvanceAtNewAmount(taxYear, rules)
  const monthsLate = advanceRule.value.paidMonthsAfterMonthCovered.count
  return MONTH_NAMES.flatMap((_, index): CitObligation[] => {
    const month = monthKey(taxYear, index + 1)
    const setBy = month >= firstAtNewAmount ? returnOf(taxYear - 1) : returnOf(taxYear - 2)
    if (setBy === null || setBy.monthlyAdvance.amount <= 0) {
      return []
    }
    const expected = tracedFigure(
      `Advance for ${monthLabel(month)}`,
      setBy.monthlyAdvance.amount,
      setBy.monthlyAdvance.basis,
      [advanceRule.citation, ...setBy.monthlyAdvance.rules],
      [setBy.monthlyAdvance],
    )
    return [{ kind: 'advance', taxYear, month, dueOn: lastDayOf(addMonths(month, monthsLate)), expected }]
  })
}

/**
 * The balance a year's return leaves to pay, due on its filing deadline. Without the return's own
 * balance, it is the liability less the advances the year expected. An overpayment owes nothing.
 */
function balanceDueOf(taxYear: number, returnOf: ReturnLookup, rules: RuleSource): CitObligation | null {
  const filed = returnOf(taxYear)
  if (filed === null) {
    return null
  }
  const taxPeriod = civilDate(taxYear, 1, 1)
  const balanceRule = rules('hr.cit.balance-due', taxPeriod)
  const filingRule = rules('hr.cit.filing', taxPeriod)
  if (!balanceRule.value.dueOnFilingDeadline.holds) {
    throw new RangeError(`The balance rule in force in ${taxYear} does not fall due on the filing deadline.`)
  }
  const steps =
    filed.balanceDue === null
      ? [filed.liability, deducted(summed(`Advances expected for ${taxYear}`, advancesOf(taxYear, returnOf, rules).map((advance) => advance.expected), 'ledger'))]
      : [filed.balanceDue]
  const amount = sumMoney(steps.map((step) => step.amount))
  if (amount <= 0) {
    return null
  }
  return {
    kind: 'balance-due',
    taxYear,
    month: null,
    dueOn: lastDayOf(addMonths(monthOf(filed.period.to), filingRule.value.monthsAfterPeriodEnd.count)),
    expected: tracedFigure(`Balance due for ${taxYear}`, amount, filed.balanceDue?.basis ?? 'ledger', [balanceRule.citation, filingRule.citation, ...rulesOf(steps)], steps),
  }
}
