import type { HrDooWorkbook } from './hrDooPart'
import { civilDate, daysBetween } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import { ZERO, moneyFromCents, sumMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import type { Rate, RuleCitation } from '../ruleset/schema'
import type { TracedFigure } from '../ruleset/tracedFigure'
import type { CarriedLoss } from './cit/taxBase'
import { ownerLoans } from './ownerLoans'
import type { OwnerLoan } from './ownerLoans'
import { dividedRounded, percentText, tracedFigure } from './payroll/payrollArithmetic'
import type { RuleSource } from './payroll/payrollArithmetic'

const BASIS_POINTS_PER_WHOLE = 10_000

/** What the owner's loans carry below a rate the law sets, and nothing when they carry at least that. */
export function shortfallRate(prescribed: Rate, carried: Rate): Rate {
  return (prescribed > carried ? prescribed - carried : 0) as Rate
}

/** The yearly interest rate the workbook says the owner's loans carry. */
export function carriedRate(workbook: HrDooWorkbook): Rate {
  return workbook.companyFacts.ownerLoanInterest as Rate
}

/** Days from `from` to `to` that fall after `after` and on or before `through`. */
function daysWithin(from: CivilDate, to: CivilDate, after: CivilDate, through: CivilDate): number {
  const start = from > after ? from : after
  const end = to < through ? to : through
  return end > start ? daysBetween(start, end) : 0
}

/** A loan's balance times the days it was owed after `after` up to `through`, and how many days it was owed at all. */
function balanceDays(loan: OwnerLoan, after: CivilDate, through: CivilDate): { readonly centDays: number; readonly days: number } {
  let balance: number = loan.amount
  let from = loan.lentOn
  let centDays = 0
  let days = 0
  const stretch = (to: CivilDate): void => {
    const owed = balance > 0 ? daysWithin(from, to, after, through) : 0
    centDays += balance * owed
    days += owed
  }
  for (const repayment of loan.repayments) {
    stretch(repayment.repaidOn)
    balance -= repayment.applied
    from = repayment.repaidOn
  }
  stretch(through)
  return { centDays, days }
}

/**
 * Interest at `rate` a year on each loan's balance, day by day, from the day after it was lent to the
 * day it was repaid, within `year` up to `through`. A yearly rate, so a day is a 365th, or a 366th in
 * a leap year. Each loan is rounded to the cent and the figure adds them up.
 */
export function interestOnLoans(label: string, loans: readonly OwnerLoan[], year: number, through: CivilDate, rate: Rate, rules: readonly RuleCitation[]): TracedFigure {
  const after = civilDate(year - 1, 12, 31)
  const yearEnd = civilDate(year, 12, 31)
  const end = through < yearEnd ? through : yearEnd
  const yearDays = daysBetween(after, yearEnd)
  const steps = loans.flatMap((loan): TracedFigure[] => {
    const owed = balanceDays(loan, after, end)
    if (owed.days === 0) return []
    return [
      {
        label: `${owed.days} ${owed.days === 1 ? 'day' : 'days'} owed in ${year} on the loan of`,
        on: loan.lentOn,
        amount: moneyFromCents(dividedRounded(owed.centDays * rate, BASIS_POINTS_PER_WHOLE * yearDays)),
        drill: loan.drill,
        basis: 'ledger',
        rules: [],
        steps: [],
      },
    ]
  })
  return tracedFigure(label, sumMoney(steps.map((step) => step.amount)), 'ledger', rules, steps)
}

/** The benefit in kind of the owner's loans in one year, as the income tax law describes it. */
export interface LoanBenefit {
  readonly year: number
  /** The rate below which a loan from the employer gives a benefit in kind. */
  readonly prescribed: Rate
  readonly carried: Rate
  /** The difference between the two rates on every day's balance. Zero when the loans carry at least the prescribed rate. */
  readonly figure: TracedFigure
  /** How many loans had a balance in the year up to `through`. */
  readonly loans: number
}

/**
 * The benefit in kind of the loans the company gave the owner in `year` up to `through`: interest at
 * the income tax law's rate less the rate the loans carry, on each day's balance. The law reaches a
 * loan from the employer to the employee, so it reads the loan book, what the owner owes the company,
 * and never the costs the owner paid for the company. Null when no loan had a balance in the year.
 */
export function loanBenefit(workbook: HrDooWorkbook, year: number, through: CivilDate, rules: RuleSource): LoanBenefit | null {
  const yearEnd = civilDate(year, 12, 31)
  const end = through < yearEnd ? through : yearEnd
  const rule = rules('hr.pit.loan-benefit', end)
  const prescribed = rule.value.minimumInterestRate.basisPoints
  const carried = carriedRate(workbook)
  const loans = ownerLoans(workbook.transactions, workbook.categories).loans
  const owed = interestOnLoans(
    `Benefit in kind on the owner's loans in ${year}`,
    loans,
    year,
    end,
    shortfallRate(prescribed, carried),
    [rule.citation],
  )
  if (owed.steps.length === 0) return null
  return { year, prescribed, carried, figure: owed, loans: owed.steps.length }
}

/**
 * Interest the owner loans would carry at the related-party rate, less the rate they carry. The rule
 * reaches a resident owner only while the company has a tax loss, so without one it is not worked out.
 */
export function relatedPartyInterest(workbook: HrDooWorkbook, year: number, profitBeforeTax: Money, losses: readonly CarriedLoss[], rules: RuleSource): TracedFigure {
  if (profitBeforeTax >= 0 && losses.length === 0) {
    return tracedFigure('Not worked out: the company has no tax loss', ZERO, 'ledger', [])
  }
  const rate = rules('hr.cit.related-party-rate', civilDate(year, 1, 1))
  const carried = carriedRate(workbook)
  return interestOnLoans(
    carried === 0 ? 'Interest on the owner loans at the related-party rate, none charged' : `Interest on the owner loans at the related-party rate, less the ${percentText(carried)} they carry`,
    ownerLoans(workbook.transactions, workbook.categories).loans,
    year,
    civilDate(year, 12, 31),
    shortfallRate(rate.value.rate.basisPoints, carried),
    [rate.citation],
  )
}
