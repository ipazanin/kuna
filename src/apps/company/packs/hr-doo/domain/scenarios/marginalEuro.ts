import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { dividedRounded, moneyFromAmount, moneyFromCents, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { Rate } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { TracedRate } from '../cit/citLiability'
import { dividendRoute } from '../dividend/dividendRoute'
import { localRates } from '../payroll/incomeTax'
import type { EmployeeFacts } from '../payroll/incomeTax'
import { atRate, deducted, percentText, rulesOf, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { words } from './words'

/** One way to pay the owner the next euro: what reaches the owner of 100.00 of company money before corporate tax. */
export interface MarginalRoute {
  readonly id: 'tax-free' | 'rent' | 'dividend' | 'salary' | 'salary-youth-relief' | 'salary-higher-rate'
  readonly net: TracedFigure
}

/** The amount the routes and the net per hundred are counted on. */
export const HUNDRED = moneyFromAmount(100)
const WHOLE = 10_000

/**
 * The owner-pay lane's comparison of the next euro, recomputed from the rules of the year: a
 * tax-free item within its cap, rent, a dividend after corporate tax, and salary above the director
 * floor and the low-pay relief, at the lower rate, with the youth relief when the birth year has
 * one, and at the higher rate. Salary and rent are costs the corporate tax allows, a dividend is not.
 */
export function marginalEuro(year: number, facts: EmployeeFacts, corporateRate: TracedRate, rules: RuleSource = ruleValue): readonly MarginalRoute[] {
  const yearEnd = civilDate(year, 12, 31)
  const start = civilDate(year, 1, 1)
  const company = tracedFigure(words.marginal.company, HUNDRED, 'plan', [])

  const caps = rules('hr.pit.nontaxable-caps', yearEnd)
  const taxFree = tracedFigure(words.marginal.taxFree, HUNDRED, 'plan', [caps.citation], [company])

  const rentRule = rules('hr.pit.rent', yearEnd).value
  const rentCitation = rules('hr.pit.rent', yearEnd).citation
  const rentExpenses = tracedFigure(words.marginal.flatExpenses(percentText(rentRule.flatExpenseShare.basisPoints)), atRate(HUNDRED, rentRule.flatExpenseShare.basisPoints), 'plan', [rentCitation])
  const rentBase = tracedFigure(words.marginal.rentBase, subtractMoney(HUNDRED, rentExpenses.amount), 'plan', [rentCitation], [company, deducted(rentExpenses)])
  const rentTax = tracedFigure(words.marginal.rentTax(percentText(rentRule.taxRate.basisPoints)), atRate(rentBase.amount, rentRule.taxRate.basisPoints), 'plan', [rentCitation], [rentBase])
  const rent = tracedFigure(words.marginal.rent, subtractMoney(HUNDRED, rentTax.amount), 'plan', [rentCitation], [company, deducted(rentTax)])

  const contributions = rules('hr.contrib.rates', start)
  const rates = contributions.value
  const healthRate = rates.healthRate.basisPoints
  const gross = tracedFigure(words.marginal.gross(percentText(healthRate)), moneyFromCents(dividedRounded(HUNDRED * WHOLE, WHOLE + healthRate)), 'plan', [contributions.citation], [company])
  const pillarOneRate = facts.pensionPillarTwo ? rates.pillarOneRateWithPillarTwo.basisPoints : rates.pillarOneRateWithoutPillarTwo.basisPoints
  const pillarOne = tracedFigure(words.marginal.pillarOne(percentText(pillarOneRate)), atRate(gross.amount, pillarOneRate), 'plan', [contributions.citation], [gross])
  const pillarTwoRate = facts.pensionPillarTwo ? rates.pillarTwoRate.basisPoints : (0 as Rate)
  const pillarTwo = tracedFigure(words.marginal.pillarTwo(percentText(pillarTwoRate)), atRate(gross.amount, pillarTwoRate), 'plan', [contributions.citation], [gross])
  const income = tracedFigure(
    words.marginal.income,
    subtractMoney(subtractMoney(gross.amount, pillarOne.amount), pillarTwo.amount),
    'plan',
    [contributions.citation],
    [gross, deducted(pillarOne), deducted(pillarTwo)],
  )
  const city = localRates(facts.residenceCity, yearEnd, rules)
  const salaryAt = (rate: Rate, label: string, relief: TracedFigure | null): TracedFigure => {
    const tax = tracedFigure(words.marginal.incomeTax(percentText(rate)), atRate(income.amount, rate), 'plan', [city.citation], [income])
    const steps = relief === null ? [income, deducted(tax)] : [income, deducted(tax), relief]
    return tracedFigure(label, sumMoney(steps.map((step) => step.amount)), 'plan', rulesOf(steps), steps)
  }

  const routes: MarginalRoute[] = [
    { id: 'tax-free', net: taxFree },
    { id: 'rent', net: rent },
    { id: 'dividend', net: dividendRoute(company, year, corporateRate, rules).net },
    { id: 'salary', net: salaryAt(city.lowerRate, words.marginal.salary, null) },
  ]
  const reliefRule = rules('hr.pit.youth-relief', yearEnd)
  const band =
    facts.birthYear === null
      ? undefined
      : reliefRule.value.bands.rows.find((row) => facts.birthYear !== null && facts.birthYear >= row.bornFrom.count && (row.bornTo === undefined || facts.birthYear <= row.bornTo.count))
  if (band !== undefined) {
    const lowerTax = atRate(income.amount, city.lowerRate)
    const relief = tracedFigure(words.marginal.youthRelief(percentText(band.reliefShare.basisPoints)), atRate(lowerTax, band.reliefShare.basisPoints), 'plan', [reliefRule.citation])
    routes.push({ id: 'salary-youth-relief', net: salaryAt(city.lowerRate, words.marginal.salaryWithRelief, relief) })
  }
  const brackets = rules('hr.pit.brackets', yearEnd)
  routes.push({
    id: 'salary-higher-rate',
    net: {
      ...salaryAt(city.higherRate, words.marginal.salaryHigher, null),
      rules: [city.citation, brackets.citation, contributions.citation],
    },
  })
  return routes
}
