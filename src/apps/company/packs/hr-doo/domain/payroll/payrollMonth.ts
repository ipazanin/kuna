import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { firstDayOf } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { ZERO, addMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleLookup, RuleValues } from '../../ruleset/ruleset'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'
import { localRates, personalAllowance, taxInBrackets } from './incomeTax'
import type { EmployeeFacts } from './incomeTax'
import { atRate, deducted, percentText, prorated, rulesOf, tracedFigure } from './payrollArithmetic'
import type { RuleSource } from './payrollArithmetic'

/** A payment beside the salary that carries no tax or contributions while it stays within its cap. */
export interface NontaxablePayment {
  /** The ruleset's payment key, such as `meal-allowance-flat`. `nontaxableUsage` checks it against its cap. */
  readonly payment: string
  readonly amount: Money
}

/** Pay on top of the salary that is taxed with it, such as overtime, night and Sunday supplements or a taxable bonus. */
export interface TaxableExtra {
  readonly label: string
  readonly amount: Money
}

export interface PayrollMonthInput {
  readonly workedMonth: MonthKey
  readonly paidOn: CivilDate
  /** The full-time monthly gross of the contract. A director is paid at least the director floor. */
  readonly agreedMonthlyGross: Money
  readonly daysWorked: number
  /** Monday to Friday, public holidays included, as the monthly fund of hours counts them. */
  readonly workingDaysInMonth: number
  readonly nontaxablePayments: readonly NontaxablePayment[]
  /** The part of tax-free payments over their caps, which is taxed as salary on top of the gross. */
  readonly overCaps?: TracedFigure
  readonly taxableExtras?: readonly TaxableExtra[]
  /**
   * The pension bases of the earlier months of the worked month's year, from every payroll the
   * employee had, which the annual maximum base counts. Nothing when this is the first month.
   */
  readonly pensionBaseEarlierInYear?: Money
  readonly basis: FigureBasis
}

export type PayrollWarning = { readonly kind: 'below-minimum-wage'; readonly agreed: TracedFigure; readonly minimum: TracedFigure }

/** One month's salary of an employee, gross to net and to the company's total cost. */
export interface PayrollMonth {
  readonly workedMonth: MonthKey
  readonly paidOn: CivilDate
  /** Gross I. */
  readonly gross: TracedFigure
  readonly pensionRelief: TracedFigure
  readonly pensionPillarOne: TracedFigure
  readonly pensionPillarTwo: TracedFigure
  /** Gross less the pension contributions. */
  readonly income: TracedFigure
  readonly personalAllowance: TracedFigure
  readonly taxableIncome: TracedFigure
  readonly incomeTax: TracedFigure
  readonly net: TracedFigure
  /** Paid by the employer on top of the gross. */
  readonly health: TracedFigure
  /** Gross II: gross plus health. */
  readonly employerCost: TracedFigure
  readonly nontaxablePayments: TracedFigure
  readonly paidToEmployee: TracedFigure
  readonly totalCompanyCost: TracedFigure
  /** Pension pillars I and II, income tax and health. */
  readonly stateTake: TracedFigure
  readonly warnings: readonly PayrollWarning[]
}

export function payrollMonth(input: PayrollMonthInput, facts: EmployeeFacts, rules: RuleSource = ruleValue): PayrollMonth {
  if (input.paidOn < firstDayOf(input.workedMonth)) {
    throw new RangeError(`A salary for ${input.workedMonth} cannot be paid on ${input.paidOn}.`)
  }
  const extras = input.taxableExtras ?? []
  const earlierBase = input.pensionBaseEarlierInYear ?? ZERO
  if (input.agreedMonthlyGross < 0 || (input.overCaps?.amount ?? 0) < 0 || extras.some((extra) => extra.amount < 0) || earlierBase < 0) {
    throw new RangeError('The agreed gross, the pay over the tax-free caps, the taxable extras and the earlier pension base cannot be negative.')
  }
  const { basis } = input
  // The accountant takes the contribution bases of the month worked, so a December salary paid in
  // January keeps December's director floor. Income tax follows the payment date.
  const contributionsDay = firstDayOf(input.workedMonth)
  const contributionRates = rules('hr.contrib.rates', contributionsDay)
  const maximumBase = rules('hr.contrib.max-base', contributionsDay)
  const reliefRule = rules('hr.contrib.low-pay-relief', contributionsDay)
  const advanceRule = monthlyAdvanceRule(input.paidOn, rules)
  const bracketRule = rules('hr.pit.brackets', input.paidOn)
  const cityRates = localRates(facts.residenceCity, input.paidOn, rules)
  const capsRule = rules('hr.pit.nontaxable-caps', input.paidOn)

  const salary = grossSalary(input, facts.director, contributionsDay, rules)
  const added = [
    ...(input.overCaps === undefined || input.overCaps.amount === 0 ? [] : [input.overCaps]),
    ...extras.filter((extra) => extra.amount > 0).map((extra) => tracedFigure(extra.label, extra.amount, basis, [])),
  ]
  const gross =
    added.length === 0
      ? salary
      : tracedFigure(
          extras.length === 0 ? 'Gross salary with the payments over their tax-free caps' : 'Gross salary with taxable extras',
          addMoney(salary.amount, sumMoney(added.map((step) => step.amount))),
          basis,
          rulesOf([salary, ...added]),
          [salary, ...added],
        )
  const pensionRelief = lowPayRelief(gross.amount, reliefRule, basis)

  const monthlyMaximum = maximumBase.value.monthlyMaximum.cents
  const capped = gross.amount > monthlyMaximum
  // The maximum is not prorated for a part month, because the definitions that were read do not say so.
  const pensionable = tracedFigure(capped ? 'Gross, capped at the maximum pension base' : 'Gross', capped ? monthlyMaximum : gross.amount, basis, [maximumBase.citation])
  const annualRoom = maximumBase.value.annualMaximum.cents > earlierBase ? subtractMoney(maximumBase.value.annualMaximum.cents, earlierBase) : ZERO
  const pillarOneCapped = pensionable.amount > annualRoom
  // Only pillar I has an annual maximum base, which counts the bases of the whole year.
  const pillarOnePensionable = pillarOneCapped
    ? tracedFigure('Gross, capped at what is left of the annual maximum pension base', annualRoom, basis, [maximumBase.citation], [pensionable])
    : pensionable
  const pillarOneBaseAmount = pillarOnePensionable.amount > pensionRelief.amount ? subtractMoney(pillarOnePensionable.amount, pensionRelief.amount) : ZERO
  const pillarOneBase = tracedFigure('Pillar I base', pillarOneBaseAmount, basis, [maximumBase.citation, reliefRule.citation], [pillarOnePensionable, deducted(pensionRelief)])
  const rates = contributionRates.value
  const pillarOneRate = facts.pensionPillarTwo ? rates.pillarOneRateWithPillarTwo.basisPoints : rates.pillarOneRateWithoutPillarTwo.basisPoints
  const pensionPillarOne = tracedFigure(`Pension pillar I at ${percentText(pillarOneRate)}`, atRate(pillarOneBase.amount, pillarOneRate), basis, [contributionRates.citation], [pillarOneBase])
  const pensionPillarTwo = facts.pensionPillarTwo
    ? tracedFigure(
        `Pension pillar II at ${percentText(rates.pillarTwoRate.basisPoints)}`,
        atRate(pensionable.amount, rates.pillarTwoRate.basisPoints),
        basis,
        [contributionRates.citation],
        [pensionable],
      )
    : tracedFigure('Pension pillar II, not a member', ZERO, basis, [contributionRates.citation])

  const income = tracedFigure(
    'Income after pension contributions',
    subtractMoney(subtractMoney(gross.amount, pensionPillarOne.amount), pensionPillarTwo.amount),
    basis,
    [advanceRule.citation],
    [gross, deducted(pensionPillarOne), deducted(pensionPillarTwo)],
  )
  // The full monthly allowance, even in a part month, as the accountant applies it.
  const allowance = personalAllowance(facts.dependants, input.paidOn, basis, rules)
  const taxableIncome = tracedFigure(
    'Taxable income, not below zero',
    income.amount > allowance.amount ? subtractMoney(income.amount, allowance.amount) : ZERO,
    basis,
    [advanceRule.citation],
    [income, deducted(allowance)],
  )
  const taxCitations = [advanceRule.citation, bracketRule.citation, cityRates.citation]
  const brackets = taxInBrackets(taxableIncome.amount, bracketRule.value.monthlyThreshold.cents, cityRates, basis, taxCitations)
  const incomeTax = tracedFigure('Income tax withheld in the month, without youth relief', addMoney(brackets.lowerRateTax.amount, brackets.higherRateTax.amount), basis, taxCitations, [
    brackets.lowerRateTax,
    brackets.higherRateTax,
  ])
  const net = tracedFigure('Net salary', subtractMoney(income.amount, incomeTax.amount), basis, rulesOf([income, incomeTax]), [income, deducted(incomeTax)])

  const healthRate = rates.healthRate.basisPoints
  const health = tracedFigure(`Health insurance at ${percentText(healthRate)}, on top of the gross`, atRate(gross.amount, healthRate), basis, [contributionRates.citation], [gross])
  const employerCost = tracedFigure('Gross II, the salary cost to the company', addMoney(gross.amount, health.amount), basis, rulesOf([gross, health]), [gross, health])

  const nontaxablePayments = nontaxableTotal(input.nontaxablePayments, capsRule, basis)
  const paidToEmployee = tracedFigure('Paid to the employee', addMoney(net.amount, nontaxablePayments.amount), basis, rulesOf([net, nontaxablePayments]), [net, nontaxablePayments])
  const totalCompanyCost = tracedFigure('Total cost to the company', addMoney(employerCost.amount, nontaxablePayments.amount), basis, rulesOf([employerCost, nontaxablePayments]), [
    employerCost,
    nontaxablePayments,
  ])
  const stateSteps = [pensionPillarOne, pensionPillarTwo, incomeTax, health]
  const stateTake = tracedFigure('Taken by the state', sumMoney(stateSteps.map((step) => step.amount)), basis, rulesOf(stateSteps), stateSteps)

  return {
    workedMonth: input.workedMonth,
    paidOn: input.paidOn,
    gross,
    pensionRelief,
    pensionPillarOne,
    pensionPillarTwo,
    income,
    personalAllowance: allowance,
    taxableIncome,
    incomeTax,
    net,
    health,
    employerCost,
    nontaxablePayments,
    paidToEmployee,
    totalCompanyCost,
    stateTake,
    warnings: minimumWageWarnings(input, facts.director, rules),
  }
}

function grossSalary(input: PayrollMonthInput, director: boolean, contributionsDay: CivilDate, rules: RuleSource): TracedFigure {
  const agreed = tracedFigure('Agreed monthly gross', input.agreedMonthlyGross, input.basis, [])
  const partMonth = input.daysWorked !== input.workingDaysInMonth
  const label = partMonth ? `Gross salary for ${input.daysWorked} of ${input.workingDaysInMonth} working days` : 'Gross salary'
  if (!director) {
    return tracedFigure(label, prorated(input.agreedMonthlyGross, input.daysWorked, input.workingDaysInMonth), input.basis, [], [agreed])
  }
  const floorRule = rules('hr.contrib.director-floor', contributionsDay)
  const floor = floorRule.value.monthlyFloor.cents
  const directorFloor = tracedFigure('Director floor for a full month', floor, input.basis, [floorRule.citation])
  const fullMonth = input.agreedMonthlyGross > floor ? input.agreedMonthlyGross : floor
  return tracedFigure(label, prorated(fullMonth, input.daysWorked, input.workingDaysInMonth), input.basis, [floorRule.citation], [agreed, directorFloor])
}

/** The minimum wage binds an employee's full-time gross. A director has the director floor instead. */
function minimumWageWarnings(input: PayrollMonthInput, director: boolean, rules: RuleSource): PayrollWarning[] {
  if (director) {
    return []
  }
  const minimumWage = rules('hr.minwage', input.paidOn)
  const minimum = minimumWage.value.monthlyGrossAmount.cents
  if (input.agreedMonthlyGross >= minimum) {
    return []
  }
  return [
    {
      kind: 'below-minimum-wage',
      agreed: tracedFigure('Agreed monthly gross', input.agreedMonthlyGross, input.basis, []),
      minimum: tracedFigure('Minimum wage for a full month', minimum, input.basis, [minimumWage.citation]),
    },
  ]
}

function lowPayRelief(gross: Money, reliefRule: RuleLookup<RuleValues['hr.contrib.low-pay-relief']>, basis: FigureBasis): TracedFigure {
  const relief = reliefRule.value
  if (relief.reducedContribution.text !== 'pension-pillar-one') {
    throw new RangeError(`The payroll engine reduces only the pillar I base, and the ruleset names ${relief.reducedContribution.text}.`)
  }
  return tracedFigure('Low-pay reduction of the pension base, on pillar I only as the accountant applies it (practice, not statute)', reductionOf(gross, relief), basis, [reliefRule.citation])
}

function reductionOf(gross: Money, relief: RuleValues['hr.contrib.low-pay-relief']): Money {
  if (gross <= relief.fullReductionGrossLimit.cents) {
    return gross < relief.fullReduction.cents ? gross : relief.fullReduction.cents
  }
  const partialLimit = relief.partialReductionGrossLimit.cents
  if (gross <= partialLimit) {
    return atRate(subtractMoney(partialLimit, gross), relief.partialReductionShare.basisPoints)
  }
  return ZERO
}

function monthlyAdvanceRule(paidOn: CivilDate, rules: RuleSource): RuleLookup<RuleValues['hr.pit.monthly-advance']> {
  const advanceRule = rules('hr.pit.monthly-advance', paidOn)
  const advance = advanceRule.value
  const modelled = advance.baseDeductsPensionContributions.holds && advance.baseDeductsPersonalAllowance.holds && !advance.youthReliefApplies.holds && advance.thresholdPeriod.text === 'month'
  if (!modelled) {
    throw new RangeError(`The monthly income tax advance in force on ${paidOn} is not the one the payroll engine models.`)
  }
  return advanceRule
}

function nontaxableTotal(payments: readonly NontaxablePayment[], capsRule: RuleLookup<RuleValues['hr.pit.nontaxable-caps']>, basis: FigureBasis): TracedFigure {
  const knownPayments = new Set(capsRule.value.caps.rows.map((row) => row.payment.text))
  const steps = payments.map((payment) => {
    if (!knownPayments.has(payment.payment)) {
      throw new RangeError(`${payment.payment} is not a non-taxable payment the ruleset lists.`)
    }
    if (payment.amount < 0) {
      throw new RangeError(`A ${payment.payment} payment cannot be negative.`)
    }
    return tracedFigure(payment.payment, payment.amount, basis, [capsRule.citation])
  })
  return tracedFigure('Non-taxable payments, kept apart from the salary', sumMoney(steps.map((step) => step.amount)), basis, [capsRule.citation], steps)
}
