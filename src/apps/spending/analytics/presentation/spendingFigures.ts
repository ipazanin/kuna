import { budgetMonths } from '../../budgets/domain/budgetCarry'
import type { BudgetMonth } from '../../budgets/domain/budgetCarry'
import { categoryTotal, monthTotals } from '../domain/monthTotals'
import type { MonthTotals } from '../domain/monthTotals'
import { euroRows } from '../../rates/domain/euroRows'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import type { RateBook } from '../../../../shared/money/rateBook'
import { ZERO } from '../../../../shared/money/money'

/** The book's figures at the rates in hand, each month's totals worked out once when first asked for. */
export interface SpendingFigures {
  totalsOf(month: MonthKey): MonthTotals
  /** Every limited category in the month, with its carry. */
  limitsIn(month: MonthKey): readonly BudgetMonth[]
}

export function spendingFigures(book: Pick<SpendingBook, 'accounts' | 'transactions' | 'categories' | 'budgets' | 'lines'>, rates: RateBook): SpendingFigures {
  const rows = euroRows(book, rates)
  const categories = new Map(book.categories.map((category) => [category.id, category]))
  const months = new Map<MonthKey, MonthTotals>()
  const totalsOf = (month: MonthKey): MonthTotals => {
    let totals = months.get(month)
    if (totals === undefined) {
      totals = monthTotals(rows, book.categories, month)
      months.set(month, totals)
    }
    return totals
  }
  return {
    totalsOf,
    limitsIn: (month) =>
      budgetMonths(
        book.budgets,
        (category, earlier) => {
          const limited = categories.get(category)
          if (limited === undefined) return { spent: ZERO, unrated: 0 }
          const { counted, unrated } = categoryTotal(totalsOf(earlier), limited)
          return { spent: counted, unrated }
        },
        month,
      ),
  }
}
