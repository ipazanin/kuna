import { spendingFigures } from '../../analytics/domain/spendingFigures'
import { bankLinkLines } from '../../bankSync/presentation/bankLinkLines'
import { holdsMonthlyLimit, leftToSpend } from '../../budgets/domain/budgetCarry'
import { countedAccounts, unconvertedCount } from '../../rates/domain/euroRows'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { reviewCount } from '../../statements/domain/reviewQueue'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { HomeFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { negateMoney } from '../../../../shared/money/money'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import type { RatesState } from '../../../../shared/rates/domain/ratesState'
import { plural } from '../../../../shared/text/translation'
import { spendingHubFigures } from './spendingHubFigures'
import { words } from './words'

/**
 * The Spending card on the Kuna home: Bank and cash and Overdrawn as balances, Overdrawn below zero, as Net worth and the Accounts screen count them, then what this month
 * spent as money out and what is left of its limits. The waiting line names the rows to review with what To review asks about Loans, what a figure leaves out for want of a rate and a bank link that is ending.
 */
export function spendingHomeFigures(book: SpendingBook, rates: RatesState, day: CivilDate, loanAsks = 0): HomeFigures | 'opening' | null {
  const accounts = spendingHubFigures(book, rates, day)
  if (accounts === null || accounts === 'opening') return accounts
  const month = monthOf(day)
  const figures = spendingFigures(book, everydayRates(rates))
  const totals = figures.totalsOf(month)
  const limits = figures.limitsIn(month)
  // This month's rows are all in the month's own count, so only the earlier months the limits carry from add to it.
  const unrated = totals.unrated + limits.reduce((sum, limit) => sum + limit.unratedCarried, 0)
  const unconverted = unconvertedCount(countedAccounts(book, day, everydayRates(rates)))
  const toReview = reviewCount(book, loanAsks)
  return {
    amounts: [
      ...accounts.parts.map((part) => ({ label: part.label, cents: part.side === 'has' ? part.cents : negateMoney(part.cents), tone: 'balance' as const })),
      { label: words.spentThisMonth, cents: negateMoney(totals.spent), tone: 'flow' as const },
      ...(!holdsMonthlyLimit(limits) ? [] : [{ label: words.leftThisMonth, cents: leftToSpend(limits), tone: 'balance' as const }]),
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
