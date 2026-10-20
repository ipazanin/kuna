import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, addMoney, moneyFromCents, subtractMoney, sumMoney } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'
import { localRates, personalAllowance, taxInBrackets } from './incomeTax'
import type { EmployeeFacts } from './incomeTax'
import { atRate, deducted, percentText, tracedFigure } from './payrollArithmetic'
import type { RuleSource } from './payrollArithmetic'
import type { PayrollMonth } from './payrollMonth'

export interface AnnualSettlementInput {
  readonly taxYear: number
  /** Salary months of any year. Only those paid in the tax year count, because salary is taxed when it is paid. */
  readonly months: readonly PayrollMonth[]
  /** Months whose allowance another employer's payroll uses, so this settlement leaves them out. */
  readonly allowanceMonthsElsewhere?: number
  readonly basis: FigureBasis
}

/** The tax office's recomputation of a year of salary, where the youth relief is applied. */
export interface AnnualSettlement {
  readonly taxYear: number
  readonly income: TracedFigure
  readonly allowance: TracedFigure
  readonly taxableIncome: TracedFigure
  readonly lowerRateTax: TracedFigure
  readonly higherRateTax: TracedFigure
  readonly youthRelief: TracedFigure
  readonly annualTax: TracedFigure
  readonly withheld: TracedFigure
  /** Withheld less the annual tax: positive is a refund, negative is extra tax to pay. */
  readonly refund: TracedFigure
}

export function annualSettlement(input: AnnualSettlementInput, facts: EmployeeFacts, rules: RuleSource = ruleValue): AnnualSettlement {
  const { taxYear, basis } = input
  if (!Number.isInteger(taxYear)) {
    throw new RangeError(`${taxYear} is not a tax year.`)
  }
  const yearEnd = civilDate(taxYear, 12, 31)
  const settlementRule = rules('hr.pit.annual-settlement', yearEnd)
  if (settlementRule.value.thresholdPeriod.text !== 'year') {
    throw new RangeError(`The annual settlement of ${taxYear} does not use an annual threshold, which the payroll engine assumes.`)
  }
  const settlementCitation = settlementRule.citation
  const paidInYear = input.months.filter((month) => yearOf(month.paidOn) === taxYear)

  const incomeSteps = paidInYear.map((month) => ({ ...month.income, label: `Income for ${month.workedMonth}, paid on`, on: month.paidOn }))
  const income = tracedFigure('Income of the year after pension contributions', sumMoney(incomeSteps.map((step) => step.amount)), basis, [
    settlementCitation,
  ], incomeSteps)

  const monthlyAllowance = personalAllowance(facts.dependants, yearEnd, basis, rules)
  const elsewhere = input.allowanceMonthsElsewhere ?? 0
  const yearMonths = settlementRule.value.allowanceMonths.count
  if (!Number.isInteger(elsewhere) || elsewhere < 0 || elsewhere > yearMonths) {
    throw new RangeError(`${elsewhere} is not a number of months another employer can use the allowance in.`)
  }
  const allowanceMonths = settlementRule.value.unusedAllowanceUsed.holds ? yearMonths - elsewhere : paidInYear.length
  const allowance = tracedFigure(
    elsewhere === 0 ? `Personal allowance for ${allowanceMonths} months` : `Personal allowance for ${allowanceMonths} months, the other ${elsewhere} used by another employer`,
    moneyFromCents(monthlyAllowance.amount * allowanceMonths),
    basis,
    [...monthlyAllowance.rules, settlementCitation],
    [monthlyAllowance],
  )
  const taxableIncome = tracedFigure(
    'Taxable income of the year, not below zero',
    income.amount > allowance.amount ? subtractMoney(income.amount, allowance.amount) : ZERO,
    basis,
    [settlementCitation],
    [income, deducted(allowance)],
  )

  // Look the city rates up on 31 December, because a mid-year change of rates applies to the whole annual tax.
  const cityRates = localRates(facts.residenceCity, yearEnd, rules)
  const bracketRule = rules('hr.pit.brackets', yearEnd)
  const brackets = taxInBrackets(taxableIncome.amount, bracketRule.value.annualThreshold.cents, cityRates, basis, [
    settlementCitation,
    bracketRule.citation,
    cityRates.citation,
  ])

  const youthRelief = youthReliefOn(brackets.lowerRateTax, facts.birthYear, yearEnd, basis, rules)
  const annualTax = tracedFigure(
    'Income tax of the year',
    subtractMoney(addMoney(brackets.lowerRateTax.amount, brackets.higherRateTax.amount), youthRelief.amount),
    basis,
    [settlementCitation],
    [brackets.lowerRateTax, brackets.higherRateTax, deducted(youthRelief)],
  )

  const withheldSteps = paidInYear.map((month) => ({ ...month.incomeTax, label: `Withheld for ${month.workedMonth}, paid on`, on: month.paidOn }))
  const withheld = tracedFigure('Income tax withheld in the months', sumMoney(withheldSteps.map((step) => step.amount)), basis, [
    settlementCitation,
  ], withheldSteps)
  const refund = tracedFigure(
    'Refund, or extra tax to pay when negative',
    subtractMoney(withheld.amount, annualTax.amount),
    basis,
    [settlementCitation],
    [withheld, deducted(annualTax)],
  )

  return {
    taxYear,
    income,
    allowance,
    taxableIncome,
    lowerRateTax: brackets.lowerRateTax,
    higherRateTax: brackets.higherRateTax,
    youthRelief,
    annualTax,
    withheld,
    refund,
  }
}

/** The relief cuts only the tax at the lower rate. The engine models salary alone, so all of that tax is on salary. */
function youthReliefOn(
  lowerRateTax: TracedFigure,
  birthYear: number | null,
  yearEnd: CivilDate,
  basis: FigureBasis,
  rules: RuleSource,
): TracedFigure {
  const reliefRule = rules('hr.pit.youth-relief', yearEnd)
  if (reliefRule.value.appliedIn.text !== 'annual-settlement') {
    throw new RangeError(`The youth relief in force on ${yearEnd} is not applied in the annual settlement, which the payroll engine assumes.`)
  }
  const citations: readonly RuleCitation[] = [reliefRule.citation]
  if (birthYear === null) {
    return tracedFigure('No youth relief, because the birth year is not set', ZERO, basis, citations)
  }
  const band = reliefRule.value.bands.rows.find(
    (row) => birthYear >= row.bornFrom.count && (row.bornTo === undefined || birthYear <= row.bornTo.count),
  )
  if (band === undefined) {
    return tracedFigure('No youth relief for this birth year', ZERO, basis, citations)
  }
  const share: Rate = band.reliefShare.basisPoints
  return tracedFigure(`Youth relief of ${percentText(share)} of the lower-rate tax`, atRate(lowerRateTax.amount, share), basis, citations, [lowerRateTax])
}
