import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import { ZERO, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { findLocalUnit } from '../../ruleset/localUnits'
import type { Rate, RuleCitation } from '../../ruleset/schema'
import type { FigureBasis, TracedFigure } from '../../ruleset/tracedFigure'
import { atRate, percentText, tracedFigure } from './payrollArithmetic'
import type { RuleSource } from './payrollArithmetic'
import { words } from './words'

/** The employee's own facts, which the employees tab holds and the ruleset never does. */
export interface EmployeeFacts {
  /** The city or municipality of residence, which sets the income tax rates, as `findLocalUnit` reads a name. */
  readonly residenceCity: string
  readonly pensionPillarTwo: boolean
  /** A member of the company who is its director, whose salary has the director floor. Any other employee is paid what the contract says. */
  readonly director: boolean
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
  const { unit, problem } = findLocalUnit(city)
  if (unit === null) {
    throw new RangeError(words.allowance.noLocalRates(on, problem))
  }
  const lookup = rules('hr.pit.local-rates', on)
  const unitRow = lookup.value.citiesAndMunicipalities.rows.find((row) => row.unit.text === unit.unit && row.county.text === unit.county)
  if (unitRow === undefined) {
    throw new RangeError(words.allowance.noRatesFor(unit.label, on))
  }
  return { lowerRate: unitRow.lowerRate.basisPoints, higherRate: unitRow.higherRate.basisPoints, citation: lookup.citation }
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
    .map((row) => tracedFigure(words.allowance.dependant(row.position.count, row.coefficient.basisPoints / 10_000), atRate(basicAllowance, row.coefficient.basisPoints), basis, citations))
  const steps = [tracedFigure(words.allowance.basic, basicAllowance, basis, citations), ...dependantShares]
  return tracedFigure(words.allowance.personal, sumMoney(steps.map((step) => step.amount)), basis, citations, steps)
}

export interface BracketTax {
  readonly lowerRateTax: TracedFigure
  readonly higherRateTax: TracedFigure
}

/** The lower rate up to the threshold and the higher rate on the rest, each rounded to the cent. */
export function taxInBrackets(taxable: Money, threshold: Money, rates: LocalRates, basis: FigureBasis, rules: readonly RuleCitation[]): BracketTax {
  const lowerPart = taxable < threshold ? taxable : threshold
  const higherPart = taxable > threshold ? subtractMoney(taxable, threshold) : ZERO
  return {
    lowerRateTax: tracedFigure(words.allowance.lowerRate(percentText(rates.lowerRate)), atRate(lowerPart, rates.lowerRate), basis, rules),
    higherRateTax: tracedFigure(words.allowance.higherRate(percentText(rates.higherRate)), atRate(higherPart, rates.higherRate), basis, rules),
  }
}
