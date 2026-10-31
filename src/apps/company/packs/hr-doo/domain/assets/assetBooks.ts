import type { Asset } from './assets'
import type { Grant } from '../grants/grants'
import { civilDate } from '../../../../../../shared/calendar/civilDate'
import { subtractMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleLookup, RuleValues } from '../../ruleset/ruleset'
import type { Rate } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { grantRelease } from '../grants/grantRelease'
import type { GrantReleaseSchedule } from '../grants/grantRelease'
import { atRate, deducted, percentText, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'
import { depreciationSchedule } from './depreciationSchedule'
import type { DepreciationSchedule, DepreciationSettings, DepreciationYear } from './depreciationSchedule'
import { words } from './words'

/** Every asset's depreciation and every grant's release, worked out under one depreciation setting. */
export interface AssetBooks {
  /** In the order of the assets tab. */
  readonly schedules: readonly DepreciationSchedule[]
  /** In the order of the grants tab. */
  readonly grants: readonly GrantReleaseSchedule[]
}

export interface AssetCharge {
  readonly schedule: DepreciationSchedule
  readonly year: DepreciationYear
}

export interface DepreciationYearTotal {
  readonly year: number
  /** Its steps are the charges of `byAsset`, in the same order. */
  readonly total: TracedFigure
  readonly byAsset: readonly AssetCharge[]
}

/** How doubled rates would move one year's figures against the rates the workbook asks for. Positive means more. */
export interface DoubledRatesYear {
  readonly year: number
  readonly depreciation: TracedFigure
  /** A grant released with the depreciation of the assets it paid for rises with it. */
  readonly grantReleased: TracedFigure
  readonly profitBeforeTax: TracedFigure
  /** The corporate tax rate of the year, which the profit tax change applies to the profit change. */
  readonly rate: Rate
  readonly profitTax: TracedFigure
}

export interface DoubledRatesEffect {
  readonly doubled: AssetBooks
  /** Every year either setting depreciates or releases anything in, oldest first. */
  readonly years: readonly DoubledRatesYear[]
  /** False when every asset already depreciates at the doubled rate, or the law allows no doubling. */
  readonly changesAnything: boolean
}

export function assetBooks(assets: readonly Asset[], grants: readonly Grant[], settings: DepreciationSettings, rules: RuleSource = ruleValue): AssetBooks {
  const schedules = assets.map((asset) => depreciationSchedule(asset, settings, rules))
  return { schedules, grants: grants.map((grant) => grantRelease(grant, schedules, grant.release, rules)) }
}

/** Depreciation summed over the assets for each year any of them is depreciated. Small inventory and disposals are write-offs, not depreciation. */
export function depreciationByYear(schedules: readonly DepreciationSchedule[]): readonly DepreciationYearTotal[] {
  return yearsOf(schedules.flatMap((schedule) => schedule.years.map((year) => year.year))).map((year) => {
    const byAsset = schedules.flatMap((schedule) => schedule.years.filter((entry) => entry.year === year).map((entry) => ({ schedule, year: entry })))
    return {
      year,
      total: summed(
        words.books.depreciationIn(year),
        byAsset.map((charge) => charge.year.charge),
        'assets',
      ),
      byAsset,
    }
  })
}

/** What the year's depreciation charges above what the corporate tax allows, one step per asset, such as a car above the cost cap. */
export function depreciationAboveAllowed(schedules: readonly DepreciationSchedule[], year: number): TracedFigure {
  return summed(
    words.books.aboveAllowed,
    schedules.flatMap((schedule) =>
      schedule.years
        .filter((entry) => entry.year === year && entry.deductible.amount !== entry.charge.amount)
        .map((entry) => tracedFigure(schedule.asset.name, subtractMoney(entry.charge.amount, entry.deductible.amount), 'assets', entry.deductible.rules)),
    ),
    'assets',
  )
}

/**
 * The same assets and grants at doubled rates, and the change in each year's depreciation, grant
 * release, profit before tax and profit tax. The profit tax change is the profit change at the
 * corporate tax rate of that year, picked by `rateTestRevenue`. Nothing here is saved.
 */
export function doubledRatesEffect(
  assets: readonly Asset[],
  grants: readonly Grant[],
  asWorkbook: AssetBooks,
  rateTestRevenue: (year: number) => Money,
  rules: RuleSource = ruleValue,
): DoubledRatesEffect {
  const doubled = assetBooks(assets, grants, { depreciationDoubled: true }, rules)
  const baseDepreciation = depreciationByYear(asWorkbook.schedules)
  const doubledDepreciation = depreciationByYear(doubled.schedules)
  const years = yearsOf([
    ...[...baseDepreciation, ...doubledDepreciation].map((entry) => entry.year),
    ...[...asWorkbook.grants, ...doubled.grants].flatMap((schedule) => schedule.years.map((entry) => entry.year)),
  ]).map((year): DoubledRatesYear => {
    const depreciation = change(
      words.books.moreDepreciation(year),
      depreciationIn(doubledDepreciation, year, words.books.atDoubled),
      depreciationIn(baseDepreciation, year, words.books.atWorkbookRates),
    )
    const grantReleased = change(words.books.moreGrant(year), releasedIn(doubled.grants, year, words.books.atDoubled), releasedIn(asWorkbook.grants, year, words.books.atWorkbookRates))
    const profitBeforeTax = tracedFigure(words.books.profitChange(year), subtractMoney(grantReleased.amount, depreciation.amount), 'assets', rulesOf([grantReleased, depreciation]), [
      grantReleased,
      deducted(depreciation),
    ])
    return { year, depreciation, grantReleased, profitBeforeTax, ...profitTaxChange(year, profitBeforeTax, grantReleased, rateTestRevenue(year), rules) }
  })
  return { doubled, years, changesAnything: years.some((entry) => entry.depreciation.amount !== 0) }
}

function profitTaxChange(year: number, profitBeforeTax: TracedFigure, grantReleased: TracedFigure, revenue: Money, rules: RuleSource): { readonly rate: Rate; readonly profitTax: TracedFigure } {
  const lookup = rules('hr.cit.rate', civilDate(year, 1, 1))
  const high = revenue >= lookup.value.threshold.cents
  const rate = high ? lookup.value.highRate.basisPoints : lookup.value.lowRate.basisPoints
  const grantRevenue = grantReleased.amount === 0 ? [] : [taxableGrantRevenue(year, rules).citation]
  const profitTax = tracedFigure(
    words.books.taxChange(year, percentText(rate), high),
    atRate(profitBeforeTax.amount, rate),
    'assets',
    [lookup.citation, ...grantRevenue, ...profitBeforeTax.rules],
    [profitBeforeTax],
  )
  return { rate, profitTax }
}

/** The profit change is the tax base change only while the grant released is taxable income. */
function taxableGrantRevenue(year: number, rules: RuleSource): RuleLookup<RuleValues['hr.cit.grant-revenue']> {
  const lookup = rules('hr.cit.grant-revenue', civilDate(year, 1, 1))
  if (!lookup.value.taxableWhenRecognised.holds) {
    throw new RangeError(`The grant rule in force in ${year} does not tax a grant when it is recognised.`)
  }
  return lookup
}

function depreciationIn(totals: readonly DepreciationYearTotal[], year: number, basis: string): TracedFigure {
  const total = totals.find((entry) => entry.year === year)?.total
  return summed(words.books.depreciationInBasis(year, basis), total === undefined ? [] : [total], 'assets')
}

function releasedIn(schedules: readonly GrantReleaseSchedule[], year: number, basis: string): TracedFigure {
  const released = schedules.flatMap((schedule) => schedule.years.filter((entry) => entry.year === year).map((entry) => entry.released))
  return summed(words.books.grantInBasis(year, basis), released, 'assets')
}

function change(label: string, after: TracedFigure, before: TracedFigure): TracedFigure {
  return tracedFigure(label, subtractMoney(after.amount, before.amount), 'assets', rulesOf([after, before]), [after, deducted(before)])
}

function yearsOf(years: readonly number[]): number[] {
  return [...new Set(years)].sort((earlier, later) => earlier - later)
}
