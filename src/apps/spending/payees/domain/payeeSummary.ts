import { inPeriod } from './payeePeriod'
import type { PayeePeriod } from './payeePeriod'
import { rowPayeeKey } from './payeeDirectory'
import { countsUnderPayee, payeeTotals } from './payeeTotals'
import type { PayeeTotals } from './payeeTotals'
import { usualCategories } from './usualCategory'
import { averagedMonths, firstWholeMonthOf } from '../../analytics/domain/averageMonth'
import type { CategoryMonth } from '../../analytics/domain/categoryMonths'
import { countedRowOf } from '../../analytics/domain/countedRow'
import type { CountedRow } from '../../analytics/domain/countedRow'
import { monthTotals } from '../../analytics/domain/monthTotals'
import type { MonthTotals } from '../../analytics/domain/monthTotals'
import { dayOfLine } from '../../sharedCosts/domain/sharedCostEntries'
import type { EntriesLine } from '../../sharedCosts/domain/sharedCostEntries'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { addMonths, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { divideMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** How many months the payee page's chart shows, this one last. */
export const CHARTED_MONTHS = 12

/** A payee's money on each side, money out and money in. */
export interface PayeeSides<Figure> {
  readonly out: Figure
  readonly in: Figure
}

/** One payee as their page shows them. */
export interface PayeeSummary {
  /** The payee's line on Payees over the period, or null while they have no part filed under spending or income in it. */
  readonly totals: PayeeTotals | null
  /** Each of the twelve months up to the day's on each side, as Overview counts the month over the payee's own parts. */
  readonly months: PayeeSides<readonly CategoryMonth[]>
  /** The average whole month on each side over the months before the day's an average reads, null for a book with none yet. */
  readonly average: PayeeSides<Money | null>
  /** How many whole months the average reads. */
  readonly averagedMonths: number
  /** The category each side usually goes under, which the entry dialog fills in, or null. */
  readonly usual: PayeeSides<RecordId | null>
}

/** The rows with a part that counts under the payee of the key, each cut to those parts, so every figure of the rows is the payee's own. */
function payeeRows(rows: readonly CountedRow[], key: string, directory: Pick<SpendingBook, 'payees'>): CountedRow[] {
  return rows.flatMap((row) => {
    const parts = row.parts.filter((part) => rowPayeeKey(directory, part) === key)
    return parts.length === 0 ? [] : [{ ...row, parts }]
  })
}

function sides(totals: readonly MonthTotals[]): PayeeSides<readonly CategoryMonth[]> {
  return {
    out: totals.map(({ month, spent, unrated }) => ({ month, counted: spent, unrated })),
    in: totals.map(({ month, income, unrated }) => ({ month, counted: income, unrated })),
  }
}

/**
 * The payee of the key over the period, from every counted row of the book. The money out and in are the payee's Payees line, so
 * they match the figure pressed there. The chart and the average keep to the months before and up to the day whatever the period,
 * and the average reads the same whole months Overview's does.
 */
export function payeeSummary(
  book: Pick<SpendingBook, 'categories' | 'payees' | 'transactions' | 'items'>,
  rows: readonly CountedRow[],
  key: string,
  period: PayeePeriod,
  day: CivilDate,
): PayeeSummary {
  const own = payeeRows(rows, key, book)
  const counted = inPeriod(period, day)
  const shown = own.filter((row) => counted(row.day))
  const thisMonth = monthOf(day)
  const charted = monthsFrom(addMonths(thisMonth, 1 - CHARTED_MONTHS), thisMonth).map((month) => monthTotals(own, book.categories, month))
  const averaged = sides(averagedMonths(day, firstWholeMonthOf(rows)).map((month) => monthTotals(own, book.categories, month)))
  const averageOf = (months: readonly CategoryMonth[]): Money | null => (months.length === 0 ? null : divideMoney(sumMoney(months.map((month) => month.counted)), months.length))
  return {
    totals: payeeTotals(shown, book.categories, book)[0] ?? null,
    months: sides(charted),
    average: { out: averageOf(averaged.out), in: averageOf(averaged.in) },
    averagedMonths: averaged.out.length,
    usual: { out: usualCategories(book, 'out').get(key) ?? null, in: usualCategories(book, 'in').get(key) ?? null },
  }
}

/** The lines Entries lists for the payee over the period, an entry or a shared cost with a part that counts under them, in the order given. */
export function payeeEntryLines(lines: readonly EntriesLine[], key: string, directory: Pick<SpendingBook, 'payees'>, period: PayeePeriod, day: CivilDate): EntriesLine[] {
  const counted = inPeriod(period, day)
  return lines.filter((line) => counted(dayOfLine(line)) && countsUnderPayee(line.kind === 'entry' ? countedRowOf(line.row) : line.entry.counted, key, directory))
}
