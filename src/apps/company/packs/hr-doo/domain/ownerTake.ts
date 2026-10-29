import { isCompleteMonth } from '../../../../../shared/calendar/ledgerWindow'
import type { LedgerWindow } from '../../../../../shared/calendar/ledgerWindow'
import { monthOf } from '../../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../../shared/calendar/monthKey'
import { divideMoney, negateMoney, subtractMoney, sumMoney } from '../../../../../shared/money/money'
import type { Money } from '../../../../../shared/money/money'
import { drillToTransactions, monthPeriod } from '../../../filters/domain/drillTarget'
import type { Figure } from '../../../filters/domain/drillTarget'
import { transactionsInPeriod } from '../../../filters/domain/filterState'
import type { Period } from '../../../filters/domain/filterState'
import { periodMonths } from '../../../filters/domain/periodPresets'
import type { Booking, Category } from '../../../workbook/domain/workbook'
import { RULESET_FIRST_DAY, ruleValue } from '../ruleset/ruleset'
import { PACK_ROLES, categoriesInBucket, categoriesWithRole, dividendCategories } from './packRoles'
import { paidOut } from './paidOut'
import { atRate } from './payroll/payrollArithmetic'
import type { RuleSource } from './payroll/payrollArithmetic'

/** One category's money between the company and the owner. Paid to the owner reads positive. */
export interface OwnerTakeLine {
  readonly category: string
  readonly amount: Figure
}

export interface OwnerTake {
  /** What the owner keeps of the owner-pay bucket, loans and their repayments included, the rent after its tax. */
  readonly total: Figure
  /** The take less the loan categories in it, benefits from company costs included. */
  readonly withoutLoans: Figure
  /** The take without loans and without dividends, which pay out profit the months that earned it already count. */
  readonly withoutDividends: Figure
  /** The dividend categories of the bucket. */
  readonly dividends: Figure
  /** The income tax on the rent the company paid the owner, which the owner pays the tax office. The company never withholds it. */
  readonly rentTax: Figure
  /** Each owner-pay category that moved, as paid, in the order the tab lists them. A repayment reads negative. */
  readonly byCategory: readonly OwnerTakeLine[]
  /** Reimbursements either way. They settle a cost counted under its own category, so they are not owner pay. */
  readonly reimbursements: readonly OwnerTakeLine[]
}

/** The owner's net pay from every source over a period, a month at a time. */
export interface NetPayPerMonth {
  readonly perMonth: Money
  /** The months the period's rows fall in, a month the ledger covers only in part counting as one. */
  readonly months: number
}

export interface OwnerTakeMonth {
  readonly month: MonthKey
  readonly complete: boolean
  /** One figure per owner-pay category as paid, zero in a month it did not move. */
  readonly byCategory: Readonly<Record<string, Figure>>
  /** The rent tax on the month's rent rows, as the owner take of that month counts it. */
  readonly rentTax: Figure
  /** The owner take of the month, the rent after its tax. */
  readonly total: Figure
}

/** What the owner took out over a period, in total and by category, the rent after the tax in force on each row's day. */
export function ownerTake(bookings: readonly Booking[], categories: readonly Category[], period: Period, window: LedgerWindow, rules: RuleSource = ruleValue): OwnerTake {
  const rows = transactionsInPeriod(bookings, period, window)
  const pay = categoriesInBucket(categories, 'owner-pay')
  const loans = [...categoriesWithRole(categories, PACK_ROLES.ownerLoanOut), ...categoriesWithRole(categories, PACK_ROLES.ownerLoanRepaid)]
  const paid = pay.filter((category) => !loans.includes(category))
  const dividends = dividendCategories(categories)
  const salaried = paid.filter((category) => !dividends.includes(category))
  const rentRole = categoriesWithRole(categories, PACK_ROLES.ownerRent)
  const rented = salaried.filter((category) => rentRole.includes(category))
  const rentTax = rentTaxOn(
    rows.filter((booking) => rented.includes(booking.category)),
    rules,
  )
  const kept = (slugs: readonly string[]) => subtractMoney(paidOut(rows.filter((booking) => slugs.includes(booking.category))), rentTax)
  const reimbursements = categoriesWithRole(categories, PACK_ROLES.reimbursement).filter((category) => !pay.includes(category))
  const linesOf = (slugs: readonly string[]): OwnerTakeLine[] =>
    slugs.flatMap((category) => {
      const own = rows.filter((booking) => booking.category === category)
      return own.length === 0 ? [] : [{ category, amount: { amount: paidOut(own), drill: drillToTransactions({ period, categories: [category] }) } }]
    })
  return {
    total: { amount: kept(pay), drill: drillToTransactions({ period, buckets: ['owner-pay'] }) },
    withoutLoans: { amount: kept(paid), drill: drillToTransactions({ period, categories: paid }) },
    withoutDividends: { amount: kept(salaried), drill: drillToTransactions({ period, categories: salaried }) },
    dividends: { amount: paidOut(rows.filter((booking) => dividends.includes(booking.category))), drill: drillToTransactions({ period, categories: dividends }) },
    rentTax: { amount: rentTax, drill: drillToTransactions({ period, categories: rented }) },
    byCategory: linesOf(pay),
    reimbursements: linesOf(reimbursements),
  }
}

/**
 * The rent tax on each row: the tax rate on the rent less its flat expenses, so a refund of rent
 * gives its tax back. The ruleset holds no rule before its first day, so a row before it is untaxed.
 */
function rentTaxOn(rows: readonly Booking[], rules: RuleSource): Money {
  return sumMoney(
    rows
      .filter((booking) => booking.date >= RULESET_FIRST_DAY)
      .map((booking) => {
        const { flatExpenseShare, taxRate } = rules('hr.pit.rent', booking.date).value
        const rent = negateMoney(booking.amount)
        return atRate(subtractMoney(rent, atRate(rent, flatExpenseShare.basisPoints)), taxRate.basisPoints)
      }),
  )
}

/**
 * The take without loans over the months of the period it covers. A loan is not income, so it stays
 * out. Null when the period holds no month of the ledger.
 */
export function netPayPerMonth(take: OwnerTake, period: Period, window: LedgerWindow): NetPayPerMonth | null {
  const months = periodMonths(period, window).length
  return months === 0 ? null : { perMonth: divideMoney(take.withoutLoans.amount, months), months }
}

/** The owner-pay categories month by month, for a chart of draws, with each month's owner take and rent tax. */
export function ownerTakeByMonth(bookings: readonly Booking[], categories: readonly Category[], months: readonly MonthKey[], window: LedgerWindow, rules: RuleSource = ruleValue): OwnerTakeMonth[] {
  const pay = categoriesInBucket(categories, 'owner-pay')
  return months.map((month) => {
    const rows = bookings.filter((booking) => monthOf(booking.date) === month && pay.includes(booking.category))
    const { total, rentTax } = ownerTake(bookings, categories, monthPeriod(month), window, rules)
    return {
      month,
      complete: isCompleteMonth(window, month),
      byCategory: Object.fromEntries(
        pay.map((category) => [
          category,
          {
            amount: paidOut(rows.filter((booking) => booking.category === category)),
            drill: drillToTransactions({ period: monthPeriod(month), categories: [category] }),
          },
        ]),
      ),
      rentTax,
      total,
    }
  })
}
