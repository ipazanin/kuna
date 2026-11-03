import { investmentLots, paidBackOf, receivedInEuros, withheldInEuros } from '../../holdings/domain/lots'
import type { Income, IncomeKind } from '../../workbook/domain/income'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { ZERO, addMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How the year table groups income: a coupon is interest from a bond. */
const INCOME_GROUPS = ['dividends', 'interest', 'other'] as const

export type IncomeGroup = (typeof INCOME_GROUPS)[number]

const GROUP_OF: Readonly<Record<IncomeKind, IncomeGroup>> = { dividend: 'dividends', coupon: 'interest', interest: 'interest', lending: 'other', referral: 'other', other: 'other' }

/** A payment or a sum of them in euros, where gross less withheld is received to the cent. */
export interface IncomeAmounts {
  readonly gross: Money
  readonly withheld: Money
  readonly received: Money
}

export interface MonthIncome {
  readonly month: MonthKey
  readonly received: Money
}

export interface GroupIncome extends IncomeAmounts {
  readonly group: IncomeGroup
}

export interface YearIncome {
  readonly year: number
  /** The groups that had a payment in the year, in the order of `INCOME_GROUPS`. */
  readonly groups: readonly GroupIncome[]
  readonly total: IncomeAmounts
}

/** A payment in euros, without the part of a coupon that paid back accrued interest, with the tax withheld as the gross in euros less what it paid in euros. */
export function paymentAmounts(payment: Income, paidBack: ReadonlyMap<RecordId, Money>): IncomeAmounts {
  const received = receivedInEuros(payment, paidBack)
  const withheld = withheldInEuros(payment)
  return { gross: addMoney(received, withheld), withheld, received }
}

export function sumAmounts(amounts: readonly IncomeAmounts[]): IncomeAmounts {
  return {
    gross: sumMoney(amounts.map((entry) => entry.gross)),
    withheld: sumMoney(amounts.map((entry) => entry.withheld)),
    received: sumMoney(amounts.map((entry) => entry.received)),
  }
}

/** Income received up to the day, each month from the first payment's to the day's, a month without any at zero. */
export function incomeByMonth(book: InvestmentBook, today: CivilDate): MonthIncome[] {
  const paid = paidUpTo(book, today)
  const first = paid.map((payment) => payment.date).sort()[0]
  if (first === undefined) {
    return []
  }
  const paidBack = paidBackOf(investmentLots(book))
  const totals = new Map<MonthKey, Money>()
  for (const payment of paid) {
    const month = monthOf(payment.date)
    totals.set(month, addMoney(totals.get(month) ?? ZERO, receivedInEuros(payment, paidBack)))
  }
  return monthsFrom(monthOf(first), monthOf(today)).map((month) => ({ month, received: totals.get(month) ?? ZERO }))
}

/** Income up to the day by calendar year, newest first, as dividends, interest and other income. */
export function incomeByYear(book: InvestmentBook, today: CivilDate): YearIncome[] {
  const paidBack = paidBackOf(investmentLots(book))
  const byYear = new Map<number, Map<IncomeGroup, IncomeAmounts[]>>()
  for (const payment of paidUpTo(book, today)) {
    const groups = byYear.get(yearOf(payment.date)) ?? new Map<IncomeGroup, IncomeAmounts[]>()
    const group = GROUP_OF[payment.kind]
    groups.set(group, [...(groups.get(group) ?? []), paymentAmounts(payment, paidBack)])
    byYear.set(yearOf(payment.date), groups)
  }
  return [...byYear]
    .sort(([earlier], [later]) => later - earlier)
    .map(([year, groups]) => {
      const groupIncome = INCOME_GROUPS.flatMap((group): GroupIncome[] => {
        const amounts = groups.get(group)
        return amounts === undefined ? [] : [{ group, ...sumAmounts(amounts) }]
      })
      return { year, groups: groupIncome, total: sumAmounts(groupIncome) }
    })
}

/** The payments of the file dated on or before the day, in the file's order. */
export function paidUpTo(book: InvestmentBook, today: CivilDate): Income[] {
  return book.income.filter((payment) => payment.date <= today)
}
