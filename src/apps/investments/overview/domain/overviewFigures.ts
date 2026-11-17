import { investmentLots, paidBackOf, receivedInEuros } from '../../holdings/domain/lots'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { civilDate, yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'

/** Income received so far this year against the same part of last year. */
export interface IncomeAgainstLastYear {
  readonly year: number
  readonly thisYear: Money
  /** From 1 January of last year to the same day a year before the figures' day. */
  readonly sameMonthsLastYear: Money
  readonly change: Money
}

/** Each payment after its tax withheld, without the part of a coupon that paid back accrued interest bought with the bond. */
export function incomeAgainstLastYear(book: InvestmentBook, today: CivilDate): IncomeAgainstLastYear {
  const paidBack = paidBackOf(investmentLots(book))
  const received = (from: CivilDate, to: CivilDate): Money => sumMoney(book.income.filter((payment) => payment.date >= from && payment.date <= to).map((payment) => receivedInEuros(payment, paidBack)))
  const year = yearOf(today)
  const thisYear = received(civilDate(year, 1, 1), today)
  const sameMonthsLastYear = received(civilDate(year - 1, 1, 1), dayMonthsLater(today, -12))
  return { year, thisYear, sameMonthsLastYear, change: subtractMoney(thisYear, sameMonthsLastYear) }
}
