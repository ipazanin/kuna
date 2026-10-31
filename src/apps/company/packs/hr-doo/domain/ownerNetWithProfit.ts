import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { firstDayOf, lastDayOf, yearOfMonth } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { ZERO, addMoney, divideMoney, subtractMoney, sumMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { drillToTransactions } from '../../../filters/domain/drillTarget'
import type { DrillTarget, Figure } from '../../../filters/domain/drillTarget'
import { periodRange } from '../../../filters/domain/filterState'
import type { Period } from '../../../filters/domain/filterState'
import { averagedPeriod, periodMonths } from '../../../filters/domain/periodPresets'
import { ruleValue } from '../ruleset/ruleset'
import type { TracedFigure } from '../ruleset/tracedFigure'
import type { TracedRate } from './cit/citLiability'
import type { ForecastLine } from './forecast/forecastLines'
import type { HrDooWorkbook } from './hrDooPart'
import { owedInPeriod } from './owedInPeriod'
import { dividendComparison } from './ownerBenefits'
import type { YearRoute } from './ownerBenefits'
import type { OwnerTake } from './ownerTake'
import { dividendCategories } from './packRoles'
import { paidOut } from './paidOut'
import type { RuleSource } from './payroll/payrollArithmetic'
import { words } from './words'

/** One calendar year of the profit counted with the owner's pay, taken out as a dividend. */
export interface ProfitYear extends YearRoute {
  /** The profit months in the year. */
  readonly months: readonly MonthKey[]
  /** The dividends paid to the owner in the year after, which pay out the year's profit, at most its profit after both taxes. */
  readonly paidOut: Figure
}

/** The owner's net a month with the profit counted as the months earn it, after corporate and dividend tax. */
export interface OwnerNetWithProfit {
  readonly state: 'ready'
  /** The owner take without loans and without dividends, the rent after its tax. */
  readonly pay: Figure
  /** The rent tax the pay leaves out, which the owner pays the tax office. */
  readonly rentTax: Figure
  /** The dividends the pay leaves out, since they pay out profit the months that earned it count. */
  readonly dividendsLeftOut: Figure
  /** The months the pay covers. A rolling window leaves out its part month, and any other period counts a month the ledger covers in part as one. */
  readonly payMonths: number
  readonly payPerMonth: Money
  /** The months the period covers whole, up to the last complete one, oldest first. The profit covers these alone. */
  readonly profitMonths: readonly MonthKey[]
  /** Oldest first, only the years that hold a profit month. */
  readonly years: readonly ProfitYear[]
  /** Profit before tax of the profit months, after corporate tax and dividend tax. */
  readonly profit: TracedFigure
  /** Zero without a profit month. */
  readonly profitPerMonth: Money
  readonly perMonth: Money
  readonly paidOut: Money
  /** The profit after both taxes that no dividend has paid out yet. */
  readonly leftInCompany: Money
  /** What the owner owes the company, net, on the period's last day or the newest booking before it, never below nothing. */
  readonly owed: { readonly amount: Money; readonly on: CivilDate; readonly drill: DrillTarget }
  /** The part of what is left that a payout sets off against what the owner owes, before any of it is paid in cash. */
  readonly setsOff: Money
}

export type OwnerNet = { readonly state: 'unregistered' } | OwnerNetWithProfit

/**
 * The owner's pay without loans and dividends over the months of the period, plus the profit of
 * the period's months up to the last complete one after corporate tax at each year's rate and
 * dividend tax at the next year's, over those months. The ledger's first part month counts, as it
 * does on Year. A dividend pays out profit the months that earned it already count, so it never
 * counts again in the period it is paid in. The profit is the company's, so it follows the period
 * alone. A year before the company was registered has no profit. Pay and profit cover the days an
 * average counts, so `take` is the owner take over `averagedPeriod`, while what the owner owes
 * stands on the period's own last day. Null when those days hold no month of the ledger.
 */
export function ownerNetWithProfit(
  take: OwnerTake,
  books: HrDooWorkbook,
  period: Period,
  window: LedgerWindow,
  newest: CivilDate,
  forecast: { readonly profitBeforeTax: (year: number) => ForecastLine; readonly corporateRate: (year: number) => TracedRate },
  rules: RuleSource = ruleValue,
): OwnerNet | null {
  const averaged = averagedPeriod(period, window)
  const months = periodMonths(averaged, window)
  if (months.length === 0) {
    return null
  }
  const registered = books.companyFacts.companyRegistered
  if (registered === null) {
    return { state: 'unregistered' }
  }
  const range = periodRange(period, window)
  const profitMonths = months.filter(
    (month) => month <= window.lastCompleteMonth && yearOfMonth(month) >= yearOf(registered) && (range === null || (range.from <= firstDayOf(month) && lastDayOf(month) <= range.to)),
  )
  const monthsIn = (year: number) => profitMonths.filter((month) => yearOfMonth(month) === year)
  const byYear = [...new Set(profitMonths.map(yearOfMonth))].map((year) => {
    const counted = monthsIn(year)
    const line = forecast.profitBeforeTax(year)
    return { year, amount: sumMoney(line.months.filter((entry) => counted.includes(entry.month)).map((entry) => entry.figure.amount)) }
  })
  const comparison = dividendComparison(byYear, words.owner.profitBeforeTax, forecast.corporateRate, rules)
  const dividends = dividendCategories(books.categories)
  const years = comparison.years.map((entry): ProfitYear => {
    const paid = paidOut(books.transactions.filter((row) => dividends.includes(row.category) && yearOf(row.date) === entry.year + 1))
    const available = entry.route.net.amount > 0 ? entry.route.net.amount : ZERO
    return {
      ...entry,
      months: monthsIn(entry.year),
      paidOut: { amount: paid < available ? paid : available, drill: drillToTransactions({ period: { preset: 'year', year: entry.year + 1 }, categories: dividends }) },
    }
  })
  const profit = { ...comparison.asDividend, label: words.owner.profitAfterTaxes }
  const payPerMonth = divideMoney(take.withoutDividends.amount, months.length)
  const profitPerMonth = profitMonths.length === 0 ? ZERO : divideMoney(profit.amount, profitMonths.length)
  const paid = sumMoney(years.map((entry) => entry.paidOut.amount))
  const leftInCompany = subtractMoney(profit.amount, paid)
  const owedOn = owedInPeriod(books, period, window, newest)
  const owed = owedOn.net.amount > 0 ? owedOn.net.amount : ZERO
  const left = leftInCompany > 0 ? leftInCompany : ZERO
  return {
    state: 'ready',
    pay: take.withoutDividends,
    rentTax: take.rentTax,
    dividendsLeftOut: take.dividends,
    payMonths: months.length,
    payPerMonth,
    profitMonths,
    years,
    profit,
    profitPerMonth,
    perMonth: addMoney(payPerMonth, profitPerMonth),
    paidOut: paid,
    leftInCompany,
    owed: { amount: owed, on: owedOn.on, drill: owedOn.net.drill },
    setsOff: left < owed ? left : owed,
  }
}
