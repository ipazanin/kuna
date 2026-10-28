import type { Grant, GrantClawback, GrantRelease } from './grants'
import type { YearEndLine } from '../yearEnd/yearEnd'
import { addDays, civilDate, daysBetween, parseCivilDate, yearOf } from '../../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../../shared/calendar/civilDate'
import type { DateRange } from '../../../../../../shared/calendar/dateRange'
import { addMonths, lastDayOf, monthKey, monthOf, monthsFrom, yearOfMonth } from '../../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../../shared/calendar/monthKey'
import { ZERO, addMoney, dividedRounded, moneyFromCents, subtractMoney, sumMoney } from '../../../../../../shared/money/money'
import type { Money } from '../../../../../../shared/money/money'
import { ruleValue } from '../../ruleset/ruleset'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { DepreciationSchedule } from '../assets/depreciationSchedule'
import { deducted, rulesOf, summed, tracedFigure } from '../payroll/payrollArithmetic'
import type { RuleSource } from '../payroll/payrollArithmetic'

export interface GrantMonth {
  readonly month: MonthKey
  readonly released: Money
}

export interface GrantYear {
  readonly year: number
  readonly released: TracedFigure
  readonly deferredAtYearEnd: TracedFigure
}

export interface GrantReleaseSchedule {
  readonly grant: Grant
  readonly policy: GrantRelease
  /** From the month of receipt to the last month that releases anything. */
  readonly months: readonly GrantMonth[]
  readonly years: readonly GrantYear[]
  /** What the policy never releases and so stays deferred: the variable part beyond everything the funded assets cost. */
  readonly neverReleased: TracedFigure
}

/** The accountant's figure for a year beside ours, and what the policy does not explain. */
export interface GrantComparison {
  readonly accountant: TracedFigure
  readonly ours: TracedFigure
  /** The accountant's figure less ours. */
  readonly residual: TracedFigure
}

export interface GrantYearCheck {
  readonly year: number
  /** Null when the year-end tab has no `released-in-year` line for the year. */
  readonly released: GrantComparison | null
  /** Null when the year-end tab has no `deferred-at-year-end` line for the year. */
  readonly deferred: GrantComparison | null
}

export interface ClawbackExposure {
  /** What the grantor could claim back if a condition broke on the day. */
  readonly amount: TracedFigure
  /** The last day the amount applies, or null once the grant period is over. */
  readonly until: CivilDate | null
}

interface PolicyPlan {
  readonly lastMonth: MonthKey
  /** Everything released by the end of the month, never before the month of receipt. */
  readonly releasedThrough: (month: MonthKey) => Money
  readonly yearSteps: (year: number, released: Money) => readonly TracedFigure[]
  readonly neverReleased: TracedFigure
}

/**
 * The grant's income month by month. `fixed-then-assets` releases the fixed part in the month of
 * receipt and the variable part as the assets it funded are depreciated or written off, up to the
 * variable part. Costs of a funded asset from before the receipt are released in the month of
 * receipt. `straight-line` spreads the whole grant over its period by days.
 */
export function grantRelease(
  grant: Grant,
  schedules: readonly DepreciationSchedule[],
  policy: GrantRelease = grant.release,
  rules: RuleSource = ruleValue,
): GrantReleaseSchedule {
  const plan = policy === 'fixed-then-assets' ? fixedThenAssets(grant, schedules) : straightLine(grant)
  const receiptMonth = monthOf(grant.received)
  const months = monthsFrom(receiptMonth, plan.lastMonth).map((month): GrantMonth => ({
    month,
    released: subtractMoney(plan.releasedThrough(month), month === receiptMonth ? ZERO : plan.releasedThrough(addMonths(month, -1))),
  }))
  const released = [...new Set(months.map((entry) => yearOfMonth(entry.month)))].map((year) => {
    const recognition = rules('hr.acc.grant-recognition', civilDate(year, 1, 1))
    const amount = sumMoney(months.filter((entry) => yearOfMonth(entry.month) === year).map((entry) => entry.released))
    const steps = plan.yearSteps(year, amount)
    return { year, figure: tracedFigure(`Grant released in ${year}`, amount, 'assets', [recognition.citation, ...rulesOf(steps)], steps) }
  })
  const releasedFigures = released.map((entry) => entry.figure)
  const years = released.map(({ year, figure }): GrantYear => ({
    year,
    released: figure,
    deferredAtYearEnd: deferredBy(grant, months, releasedFigures, civilDate(year, 12, 31)),
  }))
  return { grant, policy, months, years, neverReleased: plan.neverReleased }
}

/** The grant received and not yet released, by the end of the last month that has ended on the day. */
export function deferredOn(schedule: GrantReleaseSchedule, on: CivilDate): TracedFigure {
  return deferredBy(schedule.grant, schedule.months, schedule.years.map((year) => year.released), on)
}

/**
 * Our release and deferred balance against the accountant's `grant` lines on the year-end tab.
 * Those lines total every grant of the year, so ours adds up every schedule.
 */
export function grantResiduals(schedules: readonly GrantReleaseSchedule[], yearEnd: readonly YearEndLine[]): readonly GrantYearCheck[] {
  const grantLines = yearEnd.filter((line) => line.statement === 'grant')
  const years = [...new Set(grantLines.map((line) => line.year))].sort((earlier, later) => earlier - later)
  return years.map((year): GrantYearCheck => {
    const accountantFigure = (lineId: string): TracedFigure | null => {
      const line = grantLines.find((candidate) => candidate.year === year && candidate.line === lineId)
      return line === undefined || line.figure.kind !== 'money' ? null : tracedFigure(line.label, line.figure.amount, 'accountant', [])
    }
    const releasedSteps = schedules.flatMap((schedule) => schedule.years.filter((entry) => entry.year === year).map((entry) => entry.released))
    const deferredSteps = schedules.map((schedule) => deferredOn(schedule, civilDate(year, 12, 31)))
    return {
      year,
      released: compared(accountantFigure('released-in-year'), summed(`Released in ${year} by our policy`, releasedSteps, 'assets')),
      deferred: compared(accountantFigure('deferred-at-year-end'), summed(`Deferred at the end of ${year} by our policy`, deferredSteps, 'assets')),
    }
  })
}

/** What the grant's clawback terms put at risk on a day: the first-year terms for a year from the period's start, then the second-year terms. */
export function clawbackExposure(grant: Grant, on: CivilDate): ClawbackExposure | null {
  if (on < grant.received) {
    return { amount: tracedFigure('Nothing received yet', ZERO, 'assets', []), until: addDays(grant.received, -1) }
  }
  if (grant.period === null) {
    return null
  }
  if (on > grant.period.to) {
    return { amount: { ...tracedFigure('Nothing, the grant period ended on', ZERO, 'assets', []), on: grant.period.to }, until: null }
  }
  const firstYearEnds = addDays(anniversaryOf(grant.period.from), -1)
  if (on <= firstYearEnds) {
    return exposure(grant, grant.clawbackFirstYear, 'first', firstYearEnds)
  }
  return exposure(grant, grant.clawbackSecondYear, 'second', grant.period.to)
}

function fixedThenAssets(grant: Grant, schedules: readonly DepreciationSchedule[]): PolicyPlan {
  if (grant.parts === null) {
    throw new RangeError(`Grant ${grant.slug} has no fixed and variable parts, which fixed-then-assets needs.`)
  }
  const { fixed, variable } = grant.parts
  const receiptMonth = monthOf(grant.received)
  const costs = schedules.filter((schedule) => schedule.asset.fundedBy === grant.slug).flatMap(fundedCosts)
  const totalFunded = sumMoney(costs.map((cost) => cost.figure.amount))

  const variableThrough = (month: MonthKey): Money => {
    const funded = sumMoney(costs.filter((cost) => cost.month <= month).map((cost) => cost.figure.amount))
    return funded < variable ? funded : variable
  }
  const releasedThrough = (month: MonthKey): Money => (month < receiptMonth ? ZERO : addMoney(fixed, variableThrough(month)))

  const yearSteps = (year: number, released: Money): TracedFigure[] => {
    const inWindow = (month: MonthKey) => month <= monthKey(year, 12) && (year === yearOf(grant.received) || month > monthKey(year - 1, 12))
    const fixedStep = year === yearOf(grant.received) ? [tracedFigure('Fixed part, on receipt', fixed, 'assets', [])] : []
    const assetSteps = [...new Set(costs.map((cost) => cost.schedule))].flatMap((schedule) => {
      const ofAsset = costs.filter((cost) => cost.schedule === schedule && inWindow(cost.month))
      if (ofAsset.length === 0) {
        return []
      }
      const figures = ofAsset.map((cost) => cost.figure)
      return [tracedFigure(`${schedule.asset.name}, depreciation and write-offs`, sumMoney(figures.map((figure) => figure.amount)), 'assets', rulesOf(figures))]
    })
    const beyond = subtractMoney(sumMoney([...fixedStep, ...assetSteps].map((step) => step.amount)), released)
    const capStep = beyond > 0 ? [deducted(tracedFigure('Beyond the variable part, not released', beyond, 'assets', []))] : []
    return [...fixedStep, ...assetSteps, ...capStep]
  }

  const neverReleased = tracedFigure(
    'Variable part beyond what the funded assets cost',
    totalFunded < variable ? subtractMoney(variable, totalFunded) : ZERO,
    'assets',
    [],
  )
  // The schedule ends with the last funded cost, or earlier once the variable part is all released.
  const laterMonths = [...new Set(costs.map((cost) => cost.month))].filter((month) => month > receiptMonth).sort()
  const candidates = [receiptMonth, ...laterMonths]
  const lastMonth = candidates.find((month) => variableThrough(month) === variable) ?? candidates[candidates.length - 1] ?? receiptMonth
  return { lastMonth, releasedThrough, yearSteps, neverReleased }
}

function straightLine(grant: Grant): PolicyPlan {
  const period = grant.period
  if (period === null) {
    throw new RangeError(`Grant ${grant.slug} has no period, which straight-line needs.`)
  }
  const receiptMonth = monthOf(grant.received)
  const totalDays = daysBetween(period.from, period.to) + 1
  const daysThrough = (month: MonthKey): number => (month < receiptMonth ? 0 : daysCovered(period, lastDayOf(month)))
  const releasedThrough = (month: MonthKey): Money => moneyFromCents(dividedRounded(grant.amount * daysThrough(month), totalDays))
  const lastMonth = monthOf(period.to) > receiptMonth ? monthOf(period.to) : receiptMonth

  const yearSteps = (year: number): TracedFigure[] => {
    const before = year === yearOf(grant.received) ? 0 : daysThrough(monthKey(year - 1, 12))
    const days = daysThrough(monthKey(year, 12)) - before
    return [tracedFigure(`Whole grant, spread over ${days} of the period's ${totalDays} days`, grant.amount, 'assets', [])]
  }
  return { lastMonth, releasedThrough, yearSteps, neverReleased: tracedFigure('Nothing, the whole grant is spread over its period', ZERO, 'assets', []) }
}

function deferredBy(grant: Grant, months: readonly GrantMonth[], released: readonly TracedFigure[], on: CivilDate): TracedFigure {
  if (on < grant.received) {
    return { ...tracedFigure('Not received yet, so nothing deferred on', ZERO, 'assets', []), on }
  }
  const receivedFigure = tracedFigure('Grant received', grant.amount, 'assets', [])
  const releasedToDate = {
    ...tracedFigure('Released by', sumMoney(months.filter((entry) => lastDayOf(entry.month) <= on).map((entry) => entry.released)), 'assets', rulesOf(released)),
    on,
  }
  return { ...tracedFigure('Grant deferred on', subtractMoney(grant.amount, releasedToDate.amount), 'assets', releasedToDate.rules, [receivedFigure, deducted(releasedToDate)]), on }
}

interface FundedCost {
  readonly schedule: DepreciationSchedule
  readonly month: MonthKey
  readonly figure: TracedFigure
}

/** The depreciation of each month and any write-off of a funded asset, each with the rules behind it. */
function fundedCosts(schedule: DepreciationSchedule): FundedCost[] {
  const charges = schedule.months.map((entry): FundedCost => {
    const yearCharge = schedule.years.find((year) => year.year === yearOfMonth(entry.month))
    return { schedule, month: entry.month, figure: tracedFigure(`Depreciation in ${entry.month}`, entry.charge, 'assets', yearCharge?.charge.rules ?? []) }
  })
  const writeOff = schedule.writeOff === null ? [] : [{ schedule, month: monthOf(schedule.writeOff.on), figure: schedule.writeOff.figure }]
  return [...charges, ...writeOff]
}

function daysCovered(period: DateRange, through: CivilDate): number {
  if (through < period.from) {
    return 0
  }
  return daysBetween(period.from, through < period.to ? through : period.to) + 1
}

function exposure(grant: Grant, clawback: GrantClawback | null, year: 'first' | 'second', until: CivilDate): ClawbackExposure | null {
  if (clawback === null) {
    return null
  }
  const amount =
    clawback === 'whole'
      ? tracedFigure(`The whole grant, if a condition breaks in the ${year} year`, grant.amount, 'assets', [])
      : tracedFigure(`Clawback if a condition breaks in the ${year} year`, clawback, 'assets', [])
  return { amount, until }
}

/** The same day a year later, or 1 March when the day is 29 February. */
function anniversaryOf(day: CivilDate): CivilDate {
  const year = yearOf(day) + 1
  return parseCivilDate(`${year}${day.slice(4)}`) ?? civilDate(year, 3, 1)
}

function compared(accountant: TracedFigure | null, ours: TracedFigure): GrantComparison | null {
  if (accountant === null) {
    return null
  }
  const residual = tracedFigure('Not explained by our policy', subtractMoney(accountant.amount, ours.amount), 'accountant', ours.rules, [
    accountant,
    deducted(ours),
  ])
  return { accountant, ours, residual }
}
