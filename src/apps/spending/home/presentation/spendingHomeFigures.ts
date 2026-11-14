import { spendingFigures } from '../../analytics/presentation/spendingFigures'
import { bankLinkLines } from '../../bankSync/presentation/bankLinkLines'
import { leftToSpend } from '../../budgets/domain/budgetCarry'
import { countedAccounts, unconvertedCount } from '../../rates/domain/euroRows'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { reviewCount } from '../../statements/domain/reviewQueue'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { HomeFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import type { RatesState } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import { spendingHubFigures } from './spendingHubFigures'
import { words } from './words'

/**
 * The Spending card on the Kuna home: Bank and cash and Overdrawn as Net worth and the Accounts screen show them, then what this month spent and what
 * is left of its limits. The waiting line names the rows to review, what a figure leaves out for want of a rate and a bank link that is ending.
 */
export function spendingHomeFigures(book: SpendingBook, rates: RatesState, day: CivilDate): HomeFigures | 'opening' | null {
  const accounts = spendingHubFigures(book, rates, day)
  if (accounts === null || accounts === 'opening') return accounts
  const month = monthOf(day)
  const figures = spendingFigures(book, everydayRates(rates))
  const totals = figures.totalsOf(month)
  const limits = figures.limitsIn(month)
  // This month's rows are all in the month's own count, so only the earlier months the limits carry from add to it.
  const unrated = totals.unrated + limits.reduce((sum, limit) => sum + limit.unratedCarried, 0)
  const unconverted = unconvertedCount(countedAccounts(book, day, everydayRates(rates)))
  const toReview = reviewCount(book)
  return {
    amounts: [
      ...accounts.parts.map((part) => ({ label: part.label, cents: part.cents })),
      { label: words.spentThisMonth, cents: totals.spent },
      ...(limits.length === 0 ? [] : [{ label: words.leftThisMonth, cents: leftToSpend(limits) }]),
    ],
    waiting:
      [
        toReview === 0 ? null : plural(words.toReview(toReview), toReview),
        unconverted === 0 ? null : plural(words.notConverted(unconverted), unconverted),
        unratedNote(unrated),
        ...bankLinkLines(book.settings, day),
      ]
        .filter((line) => line !== null)
        .join(' · ') || null,
  }
}
