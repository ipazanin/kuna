import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { subtractMoney } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { TracedRate } from '../cit/citLiability'
import { atRate, deducted, percentText, rulesOf, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { words } from './words'

/** Company money paid out as a dividend, step by step. */
export interface DividendRoute {
  readonly corporateTax: TracedFigure
  readonly afterCorporateTax: TracedFigure
  readonly dividendTax: TracedFigure
  /** What reaches the owner. */
  readonly net: TracedFigure
}

/**
 * A year's company money paid out as a dividend: corporate tax at the year's rate, then dividend
 * tax on what is left at the rate of the year after, when the year's profit can be paid out.
 */
export function dividendRoute(money: TracedFigure, year: number, corporateRate: TracedRate, rules: RuleSource = ruleValue): DividendRoute {
  const corporateTax = tracedFigure(words.route.corporateTax(percentText(corporateRate.basisPoints)), atRate(money.amount, corporateRate.basisPoints), money.basis, corporateRate.rules)
  const afterCorporateTax = tracedFigure(words.route.afterCorporateTax, subtractMoney(money.amount, corporateTax.amount), money.basis, corporateRate.rules, [money, deducted(corporateTax)])
  const dividendRule = rules('hr.pit.dividend', civilDate(year + 1, 1, 1))
  const dividendTax = tracedFigure(
    words.route.dividendTax(percentText(dividendRule.value.rate.basisPoints)),
    atRate(afterCorporateTax.amount, dividendRule.value.rate.basisPoints),
    money.basis,
    [dividendRule.citation],
    [afterCorporateTax],
  )
  const net = tracedFigure(words.route.net, subtractMoney(afterCorporateTax.amount, dividendTax.amount), money.basis, rulesOf([afterCorporateTax, dividendTax]), [
    afterCorporateTax,
    deducted(dividendTax),
  ])
  return { corporateTax, afterCorporateTax, dividendTax, net }
}
