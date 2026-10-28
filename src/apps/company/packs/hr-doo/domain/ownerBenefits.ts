import { yearOf } from '../../../../../shared/calendar/civilDate'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { addMoney, sumMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { drillToTransactions } from '../../../filters/domain/drillTarget'
import type { Figure } from '../../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../filters/domain/filterState'
import type { Period } from '../../../filters/domain/filterState'
import { benefitCategoryOf } from '../../../owner-share/domain/ownerParts'
import type { OwnerShare } from '../../../owner-share/domain/ownerShare'
import type { Booking, Category } from '../../../workbook/domain/workbook'
import { ruleValue } from '../ruleset/ruleset'
import type { TracedFigure } from '../ruleset/tracedFigure'
import type { TracedRate } from './cit/citLiability'
import { dividendRoute } from './dividend/dividendRoute'
import type { DividendRoute } from './dividend/dividendRoute'
import { paidOut } from './paidOut'
import { rulesOf, tracedFigure } from './payroll/payrollArithmetic'
import type { RuleSource } from './payroll/payrollArithmetic'

/** The owner's parts of the costs of one category shared with the owner. */
export interface BenefitSource {
  readonly category: string
  /** The share its rows were counted at, `mixed` when they differ, or null for a row booked in the benefit category itself. */
  readonly share: OwnerShare | 'mixed' | null
  /** Paid out reads positive. Opens the benefit category, where each owner part names the category it comes from. */
  readonly amount: Figure
}

/** An amount of one calendar year, which the dividend comparison taxes at that year's rates. */
export interface YearAmount {
  readonly year: number
  readonly amount: Money
}

/** The owner's parts of shared company costs over a period, which count as owner pay with no tax on them. */
export interface OwnerBenefits {
  /** The owner-pay category with the owner-benefit role. */
  readonly category: string
  /** Paid out reads positive. Opens the benefit category. */
  readonly total: Figure
  /** How many rows and advances of the benefit category the period holds. */
  readonly payments: number
  /** By the category each part comes from, in the order the categories tab lists them. */
  readonly bySource: readonly BenefitSource[]
  /** Oldest first, only the years that hold a part. */
  readonly byYear: readonly YearAmount[]
}

/** What taking the same money out as a dividend would have cost and paid, each year at its own rates. */
export interface DividendComparison {
  /** The corporate tax and the dividend tax the benefits did not pay. */
  readonly taxAvoided: TracedFigure
  /** What the benefits would have reached the owner as a dividend. */
  readonly asDividend: TracedFigure
  /** Each year on its own, oldest first. */
  readonly years: readonly YearRoute[]
}

/** One year's amount taken out as a dividend. */
export interface YearRoute {
  readonly year: number
  readonly amount: TracedFigure
  readonly route: DividendRoute
}

/**
 * The benefit category's rows over a period, each counted by the category its share comes from. Null
 * without one owner-pay category carrying the owner-benefit role, since the shares then count as 0.
 */
export function ownerBenefits(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow): OwnerBenefits | null {
  const benefit = benefitCategoryOf(categories)
  if (benefit === null) {
    return null
  }
  const rows = transactionsInPeriod(bookings, period, window).filter((booking) => booking.category === benefit.slug)
  const drill = drillToTransactions({ period, categories: [benefit.slug] })
  const sourceOf = (booking: Booking): string => booking.ownerPart?.sourceCategory ?? booking.category
  const bySource = categories.flatMap((category): BenefitSource[] => {
    const own = rows.filter((booking) => sourceOf(booking) === category.slug)
    if (own.length === 0) {
      return []
    }
    const shares = [...new Set(own.map((booking) => booking.ownerPart?.share ?? null))]
    return [{ category: category.slug, share: shares.length === 1 ? shares[0]! : 'mixed', amount: { amount: paidOut(own), drill } }]
  })
  const years = [...new Set(rows.map((booking) => yearOf(booking.date)))].sort((left, right) => left - right)
  return {
    category: benefit.slug,
    total: { amount: paidOut(rows), drill },
    payments: rows.length,
    bySource,
    byYear: years.map((year) => ({ year, amount: paidOut(rows.filter((booking) => yearOf(booking.date) === year)) })),
  }
}

/**
 * An amount taken out as a dividend: corporate tax at the rate of the year it falls in, then
 * dividend tax on what is left at the rate of the year after. A period across years sums each year
 * at its own rates. `name` is what the amount is as the screens show it, such as the benefit
 * category's name.
 */
export function dividendComparison(byYear: readonly YearAmount[], name: string, corporateRateOf: (year: number) => TracedRate, rules: RuleSource = ruleValue): DividendComparison {
  const years = byYear.map(({ year, amount }): YearRoute => {
    const money = tracedFigure(`${name} in ${year}`, amount, 'ledger', [])
    return { year, amount: money, route: dividendRoute(money, year, corporateRateOf(year), rules) }
  })
  const perYear = years.map(({ year, amount, route }) => {
    const taxes = [{ ...route.corporateTax, steps: [amount] }, route.dividendTax]
    return {
      taxAvoided: tracedFigure(`Tax avoided in ${year}`, addMoney(route.corporateTax.amount, route.dividendTax.amount), 'ledger', rulesOf(taxes), taxes),
      asDividend: { ...route.net, label: `As a dividend in ${year}` },
    }
  })
  const [only] = perYear
  if (perYear.length === 1 && only !== undefined) {
    return { taxAvoided: { ...only.taxAvoided, label: 'Tax avoided against a dividend' }, asDividend: { ...only.asDividend, label: 'As a dividend, net' }, years }
  }
  const summed = (label: string, figures: readonly TracedFigure[]): TracedFigure => tracedFigure(label, sumMoney(figures.map((figure) => figure.amount)), 'ledger', rulesOf(figures), figures)
  return {
    taxAvoided: summed('Tax avoided against a dividend', perYear.map((entry) => entry.taxAvoided)),
    asDividend: summed('As a dividend, net', perYear.map((entry) => entry.asDividend)),
    years,
  }
}
