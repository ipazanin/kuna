import type { CompanyFacts } from '../../../../features/settings/domain/settings'
import type { Asset } from '../../../../features/workbook/domain/assets'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, lastDayOf, monthNumber, monthOf, yearOfMonth } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, moneyFromCents, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { RuleLookup, RuleValues } from '../../ruleset/ruleset'
import type { Rate } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import { deducted, dividedRounded, percentText, rulesOf, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

export type DepreciationSettings = Pick<CompanyFacts, 'depreciationDoubled'>

export interface DepreciationMonth {
  readonly month: MonthKey
  readonly charge: Money
}

export interface DepreciationYear {
  readonly year: number
  /** The yearly rate the year's charge used, doubled already when `doubled` holds. */
  readonly rate: Rate
  readonly doubled: boolean
  readonly charge: TracedFigure
  /** The part of the charge the corporate tax allows. Less than the charge only for a car above the cost cap. */
  readonly deductible: TracedFigure
}

/** What is left of an asset that goes out of the books at once: small inventory when put in use, or the book value at disposal. */
export interface AssetWriteOff {
  readonly on: CivilDate
  readonly figure: TracedFigure
}

export interface DepreciationSchedule {
  readonly asset: Asset
  readonly treatment: 'depreciated' | 'small-inventory'
  readonly cost: TracedFigure
  /** Every month that carries depreciation, oldest first. Empty for small inventory. */
  readonly months: readonly DepreciationMonth[]
  readonly years: readonly DepreciationYear[]
  /** Null while a depreciated asset is still held. */
  readonly writeOff: AssetWriteOff | null
}

const BASIS_POINTS_PER_WHOLE = 10_000
const MONTHS_PER_YEAR = 12

/**
 * Straight-line depreciation of one asset at its group's rate, doubled when the asset or the
 * settings say so. Each year's charge is rounded to the cent, and the months share it out so they
 * add up to it. An item at or below the asset threshold is small inventory, written off in full in
 * the month it is put in use.
 */
export function depreciationSchedule(asset: Asset, settings: DepreciationSettings, rules: RuleSource = ruleValue): DepreciationSchedule {
  const cost = tracedFigure('Cost without deductible VAT', asset.costNet, 'assets', [])
  const useYear = taxPeriodOf(yearOf(asset.inUse))
  const thresholdRule = rules('hr.cit.asset-threshold', useYear)
  if (asset.costNet <= thresholdRule.value.unitCostAbove.cents) {
    return smallInventory(asset, cost, thresholdRule, rules('hr.acc.capitalisation', useYear))
  }

  const startRule = rules('hr.cit.depreciation-start', useYear)
  const firstMonth = startRule.value.startsInMonthAfterUse.holds ? addMonths(monthOf(asset.inUse), 1) : monthOf(asset.inUse)
  const disposal = asset.disposed === null ? null : lastDepreciatedMonth(asset.disposed, rules)
  const lastMonth = disposal?.month ?? null

  const doubledAsked = asset.doubledRate || settings.depreciationDoubled
  const rateOf = (year: number): YearRate => groupRate(asset, year, doubledAsked, rules)

  const months = monthlyCharges(asset.costNet, firstMonth, lastMonth, (year) => rateOf(year).rate)
  const years = [...new Set(months.map((entry) => yearOfMonth(entry.month)))].map((year) => {
    const inYear = months.filter((entry) => yearOfMonth(entry.month) === year)
    const yearRate = rateOf(year)
    const stopsThisYear = disposal !== null && yearOfMonth(disposal.month) === year
    const disposalCitedApart = stopsThisYear && disposal.rule.citation.validFrom !== startRule.citation.validFrom
    const charge = tracedFigure(
      `Depreciation in ${year}, ${inYear.length} ${inYear.length === 1 ? 'month' : 'months'} at ${rateText(yearRate)}`,
      sumMoney(inYear.map((entry) => entry.charge)),
      'assets',
      disposalCitedApart ? [yearRate.lookup.citation, startRule.citation, disposal.rule.citation] : [yearRate.lookup.citation, startRule.citation],
      [cost],
    )
    const capRule = asset.group === 'car' ? rules('hr.cit.car-depreciation-cap', taxPeriodOf(year)) : null
    return { year, rate: yearRate.rate, doubled: yearRate.doubled, charge, deductible: deductibleOf(charge, asset.costNet, capRule) }
  })

  return { asset, treatment: 'depreciated', cost, months, years, writeOff: disposalWriteOff(asset, cost, months, years) }
}

/** Depreciation counted by a day: a month counts once its last day is reached, and every month counts once the asset is gone. */
export function accumulatedDepreciationOn(schedule: DepreciationSchedule, on: CivilDate): TracedFigure {
  const gone = schedule.writeOff !== null && schedule.writeOff.on <= on
  const counted = schedule.months.filter((entry) => gone || lastDayOf(entry.month) <= on)
  return { ...tracedFigure('Accumulated depreciation on', sumMoney(counted.map((entry) => entry.charge)), 'assets', rulesOf(schedule.years.map((year) => year.charge))), on }
}

/** Cost less accumulated depreciation. Nothing before the asset was bought, and nothing once it is written off. */
export function bookValueOn(schedule: DepreciationSchedule, on: CivilDate): TracedFigure {
  if (on < schedule.asset.bought) {
    return { ...tracedFigure('Not bought yet, so no book value on', ZERO, 'assets', []), on }
  }
  const writeOff = schedule.writeOff
  if (writeOff !== null && writeOff.on <= on) {
    return { ...tracedFigure('No book value after the write-off on', ZERO, 'assets', writeOff.figure.rules, [writeOff.figure]), on: writeOff.on }
  }
  const accumulated = accumulatedDepreciationOn(schedule, on)
  return { ...tracedFigure('Book value on', subtractMoney(schedule.cost.amount, accumulated.amount), 'assets', accumulated.rules, [schedule.cost, deducted(accumulated)]), on }
}

/** The last month that carries depreciation: the month of disposal, or the one before when the rule stops earlier. */
function lastDepreciatedMonth(
  disposed: CivilDate,
  rules: RuleSource,
): { readonly month: MonthKey; readonly rule: RuleLookup<RuleValues['hr.cit.depreciation-start']> } {
  const rule = rules('hr.cit.depreciation-start', taxPeriodOf(yearOf(disposed)))
  const month = rule.value.endsInMonthOfDisposal.holds ? monthOf(disposed) : addMonths(monthOf(disposed), -1)
  return { month, rule }
}

interface YearRate {
  readonly rate: Rate
  readonly doubled: boolean
  readonly lookup: RuleLookup<RuleValues['hr.cit.depreciation-rates']>
}

function groupRate(asset: Asset, year: number, doubledAsked: boolean, rules: RuleSource): YearRate {
  const lookup = rules('hr.cit.depreciation-rates', taxPeriodOf(year))
  const group = lookup.value.groups.rows.find((row) => row.group.text === asset.group)
  if (group === undefined) {
    throw new RangeError(`The depreciation rates in force in ${year} have no group ${asset.group}.`)
  }
  const single = group.maximumRate.basisPoints
  if (single <= 0) {
    throw new RangeError(`The depreciation rate of ${asset.group} in ${year} is not above zero.`)
  }
  const doubled = doubledAsked && lookup.value.doublingAllowed.holds
  return { rate: (doubled ? single * 2 : single) as Rate, doubled, lookup }
}

function rateText(yearRate: YearRate): string {
  return yearRate.doubled ? `${percentText(yearRate.rate)}, the doubled rate` : percentText(yearRate.rate)
}

/**
 * The charge of each month from `firstMonth` until the cost is written off or `lastMonth` passes.
 * Within a year, month k carries the year's charge for k months, rounded, less that for k - 1.
 */
function monthlyCharges(base: Money, firstMonth: MonthKey, lastMonth: MonthKey | null, rateOf: (year: number) => Rate): DepreciationMonth[] {
  const months: DepreciationMonth[] = []
  let remaining: number = base
  let month = firstMonth
  let monthsIntoYear = 0
  while (remaining > 0 && (lastMonth === null || month <= lastMonth)) {
    monthsIntoYear = month === firstMonth || monthNumber(month) === 1 ? 1 : monthsIntoYear + 1
    const rate = rateOf(yearOfMonth(month))
    const step = chargeForMonths(base, rate, monthsIntoYear) - chargeForMonths(base, rate, monthsIntoYear - 1)
    const charge = Math.min(step, remaining)
    months.push({ month, charge: moneyFromCents(charge) })
    remaining -= charge
    month = addMonths(month, 1)
  }
  return months
}

function chargeForMonths(base: Money, rate: Rate, months: number): number {
  return dividedRounded(base * rate * months, BASIS_POINTS_PER_WHOLE * MONTHS_PER_YEAR)
}

function deductibleOf(
  charge: TracedFigure,
  cost: Money,
  capRule: RuleLookup<RuleValues['hr.cit.car-depreciation-cap']> | null,
): TracedFigure {
  if (capRule === null || cost <= capRule.value.costCapPerCar.cents) {
    return tracedFigure('Depreciation the corporate tax allows, all of it', charge.amount, 'assets', charge.rules, [charge])
  }
  const cap = capRule.value.costCapPerCar.cents
  const capped = tracedFigure('Car cost the corporate tax counts', cap, 'assets', [capRule.citation])
  return tracedFigure(
    'Depreciation the corporate tax allows, in proportion to the capped cost',
    moneyFromCents(dividedRounded(charge.amount * cap, cost)),
    'assets',
    rulesOf([charge, capped]),
    [charge, capped],
  )
}

function smallInventory(
  asset: Asset,
  cost: TracedFigure,
  thresholdRule: RuleLookup<RuleValues['hr.cit.asset-threshold']>,
  capitalisationRule: RuleLookup<RuleValues['hr.acc.capitalisation']>,
): DepreciationSchedule {
  if (!capitalisationRule.value.smallInventoryWrittenOffOnUse.holds) {
    throw new RangeError(`The capitalisation rule in force on ${asset.inUse} does not write small inventory off when put in use.`)
  }
  const figure = tracedFigure('Small inventory, written off when put in use', cost.amount, 'assets', [
    thresholdRule.citation,
    capitalisationRule.citation,
  ], [cost])
  return { asset, treatment: 'small-inventory', cost, months: [], years: [], writeOff: { on: asset.inUse, figure } }
}

function disposalWriteOff(
  asset: Asset,
  cost: TracedFigure,
  months: readonly DepreciationMonth[],
  years: readonly DepreciationYear[],
): AssetWriteOff | null {
  if (asset.disposed === null) {
    return null
  }
  const charges = years.map((year) => year.charge)
  const accumulated = tracedFigure('Depreciation until disposal', sumMoney(months.map((entry) => entry.charge)), 'assets', rulesOf(charges))
  const figure = tracedFigure('Book value written off on disposal', subtractMoney(cost.amount, accumulated.amount), 'assets', accumulated.rules, [
    cost,
    deducted(accumulated),
  ])
  return { on: asset.disposed, figure }
}

/** The rules of the corporate tax are looked up by the tax period, which a calendar year starts. */
function taxPeriodOf(year: number): CivilDate {
  return civilDate(year, 1, 1)
}
