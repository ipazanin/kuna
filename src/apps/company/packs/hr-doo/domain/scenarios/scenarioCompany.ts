import { displayName } from '../../../../workbook/domain/displayName'
import type { Grant } from '../grants/grants'
import type { HrDooWorkbook } from '../hrDooPart'
import { yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { negateMoney, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { TaxBaseInput } from '../cit/taxBase'
import { dividendCapacity } from '../dividend/dividendCapacity'
import { forecastYear } from '../forecast/forecastYear'
import { isOwnerPayCost } from '../packRoles'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

/** The company's side of a pay scenario: what the year earns before any owner pay, and what it holds. */
export interface ScenarioCompany {
  /** The forecast year the figures come from: the scenario's own year, or the latest year the forecast covers, the year after the newest booking, when the scenario's is later. */
  readonly takenFrom: number
  readonly registered: CivilDate
  /** The PD build-up's inputs of that year, with the owner pay taken out of the expenses. */
  readonly taxBaseInput: TaxBaseInput
  /** The salary, its taxes and the rent the forecast counts, read positive. */
  readonly ownerPayInForecast: TracedFigure
  readonly profitBeforeOwnerPay: TracedFigure
  /** Cash at the year end with December settled, before the owner pay and the year's corporate tax. */
  readonly cashBeforeOwnerPay: TracedFigure
  /** What the owner owes the company, net, which a dividend settles first. */
  readonly owedByOwner: TracedFigure
  /** Retained earnings of earlier years still undistributed, less losses brought forward. */
  readonly retainedBroughtIn: TracedFigure
  readonly reserves: TracedFigure
  readonly shareCapital: TracedFigure
  readonly grants: readonly Grant[]
}

/**
 * The company figures a pay scenario for `year` runs on, from the forecast seen on `asOf`. The
 * forecast reaches the year after the newest booking, as the Forecast tab of Year does, so a later
 * scenario year takes that year's figures and `takenFrom` says so. The owner pay the forecast
 * counts, a plan's scenarios included, is taken back out, so each scenario sets its own.
 */
export function scenarioCompany(workbook: HrDooWorkbook, year: number, asOf: CivilDate, rules: RuleSource = ruleValue): ScenarioCompany {
  const registered = workbook.companyFacts.companyRegistered
  if (registered === null) {
    throw new RangeError('A pay scenario needs hr_company_registered, the day the first tax period starts.')
  }
  const covered = yearOf(asOf) + 1
  const takenFrom = year > covered ? covered : year
  const forecast = forecastYear(workbook, takenFrom, asOf, rules)
  const capacity = dividendCapacity(takenFrom, forecast, workbook, rules)

  const payLines = forecast.categories
    .filter((entry) => isOwnerPayCost(entry.category))
    .map((entry) =>
      tracedFigure(displayName(entry.category.slug, entry.category.label ?? ''), negateMoney(entry.forecast.total.amount), 'ledger', entry.forecast.total.rules, [deducted(entry.forecast.total)]),
    )
  const ownerPayInForecast = summed(`Owner pay in the ${takenFrom} forecast`, payLines, 'ledger')

  const { expenses } = forecast.taxBaseInput
  const expensesWithoutPay = tracedFigure('PD line 2, expenses without owner pay', subtractMoney(expenses.amount, ownerPayInForecast.amount), 'ledger', rulesOf([expenses, ownerPayInForecast]), [
    expenses,
    deducted(ownerPayInForecast),
  ])
  const profitBeforeTax = forecast.taxBase.profitBeforeTax
  const profitBeforeOwnerPay = summed(`Profit before owner pay, ${takenFrom} forecast`, [profitBeforeTax, ownerPayInForecast], 'ledger')

  const cashBeforeOwnerPay = summed(
    `Cash at the end of ${takenFrom} with December settled, before owner pay and the year's corporate tax`,
    [capacity.prudence.cashAfterObligations, ownerPayInForecast, forecast.liability.liability],
    'ledger',
  )
  const retainedSteps = [capacity.retainedEarnings, deducted(capacity.lossesBroughtForward), deducted(capacity.paidOutInYear)]
  const retainedBroughtIn = tracedFigure(
    `Retained earnings of earlier years not yet paid out in ${takenFrom}`,
    sumMoney(retainedSteps.map((step) => step.amount)),
    'ledger',
    rulesOf(retainedSteps),
    retainedSteps,
  )

  return {
    takenFrom,
    registered,
    taxBaseInput: { ...forecast.taxBaseInput, expenses: expensesWithoutPay },
    ownerPayInForecast,
    profitBeforeOwnerPay,
    cashBeforeOwnerPay,
    owedByOwner: capacity.prudence.owedByOwner,
    retainedBroughtIn,
    reserves: capacity.reserves,
    shareCapital: capacity.shareCapital,
    grants: workbook.grants,
  }
}
