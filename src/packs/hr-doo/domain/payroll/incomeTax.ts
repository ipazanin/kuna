import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { ZERO, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'
import { atRate, percentText, tracedFigure } from './payrollArithmetic'
import type { RuleSource } from './payrollArithmetic'

/** The employee's own facts, which are workbook settings and never part of the ruleset. */
export interface EmployeeFacts {
  /** The city of residence, which sets the income tax rates. It must be a city the ruleset lists. */
  readonly residenceCity: string
  readonly pensionPillarTwo: boolean
  /** Dependent family members and children on the tax card, each adding a multiple of the allowance. */
  readonly dependants: number
  /** Read only by the annual settlement, for the youth relief. Null when the workbook does not say. */
  readonly birthYear: number | null
}

export interface LocalRates {
  readonly lowerRate: Rate
  readonly higherRate: Rate
  readonly citation: RuleCitation
}

export function localRates(city: string, on: CivilDate, rules: RuleSource): LocalRates {
  const lookup = rules('hr.pit.local-rates', on)
  const cityRow = lookup.value.cityRates.rows.find((row) => row.city.text === city)
  if (cityRow === undefined) {
    throw new RangeError(`The ruleset has no income tax rates for ${city} on ${on}.`)
  }
  return { lowerRate: cityRow.lowerRate.basisPoints, higherRate: cityRow.higherRate.basisPoints, citation: lookup.citation }
}

/** The basic allowance plus one multiple of it for each dependant, by position on the tax card. */
export function personalAllowance(dependants: number, on: CivilDate, basis: FigureBasis, rules: RuleSource): TracedFigure {
  const lookup = rules('hr.pit.allowance', on)
  const coefficients = lookup.value.dependantCoefficients.rows
  if (!Number.isInteger(dependants) || dependants < 0 || dependants > coefficients.length) {
    throw new RangeError(`${dependants} dependants is outside the ${coefficients.length} positions the ruleset holds.`)
  }
  const basicAllowance = lookup.value.basicMonthlyAllowance.cents
  const citations = [lookup.citation]
  const dependantShares = coefficients
    .filter((row) => row.position.count <= dependants)
    .map((row) =>
      tracedFigure(
        `Dependant ${row.position.count} at ${row.coefficient.basisPoints / 10_000} of the allowance`,
        atRate(basicAllowance, row.coefficient.basisPoints),
        basis,
        citations,
      ),
    )
  const steps = [tracedFigure('Basic allowance', basicAllowance, basis, citations), ...dependantShares]
  return tracedFigure('Personal allowance', sumMoney(steps.map((step) => step.amount)), basis, citations, steps)
}

export interface BracketTax {
  readonly lowerRateTax: TracedFigure
  readonly higherRateTax: TracedFigure
}

/** The lower rate up to the threshold and the higher rate on the rest, each rounded to the cent. */
export function taxInBrackets(
  taxable: Money,
  threshold: Money,
  rates: LocalRates,
  basis: FigureBasis,
  rules: readonly RuleCitation[],
): BracketTax {
  const lowerPart = taxable < threshold ? taxable : threshold
  const higherPart = taxable > threshold ? subtractMoney(taxable, threshold) : ZERO
  return {
    lowerRateTax: tracedFigure(`At the lower rate of ${percentText(rates.lowerRate)}`, atRate(lowerPart, rates.lowerRate), basis, rules),
    higherRateTax: tracedFigure(`At the higher rate of ${percentText(rates.higherRate)}`, atRate(higherPart, rates.higherRate), basis, rules),
  }
}
