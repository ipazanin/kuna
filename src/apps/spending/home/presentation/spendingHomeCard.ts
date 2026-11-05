import { spendingFigures } from '../../analytics/presentation/spendingFigures'
import { leftToSpend } from '../../budgets/domain/budgetCarry'
import { reviewCount } from '../../statements/domain/reviewQueue'
import { ratesIn, waitsForRates } from '../../rates/domain/ratesState'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { useRates } from '../../rates/presentation/useRates'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { AppHomeCard } from '../../../../shared/app/appContribution'
import { homeCardFigures } from '../../../../shared/app/homeCardFigures'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

const { state } = useSpendingBooks()
const rates = useRates()

/** The Spending card on the Kuna home: what this month spent, what is left of its limits, the rows waiting for a category and the rows either figure counts as nothing. */
export const SPENDING_HOME_CARD: AppHomeCard = {
  icon: 'i-lucide-wallet',
  purpose: words.purpose,
  figures: () =>
    homeCardFigures(state, (book) => {
      if (book.accounts.length === 0) return null
      if (waitsForRates(book.accounts, rates.value)) return 'opening'
      const month = monthOf(today())
      const figures = spendingFigures(book, ratesIn(rates.value))
      const totals = figures.totalsOf(month)
      const limits = figures.limitsIn(month)
      // This month's rows are all in the month's own count, so only the earlier months the limits carry from add to it.
      const unrated = totals.unrated + limits.reduce((sum, limit) => sum + limit.unratedCarried, 0)
      const toReview = reviewCount(book)
      return {
        amounts: [{ label: words.spentThisMonth, cents: totals.spent }, ...(limits.length === 0 ? [] : [{ label: words.leftThisMonth, cents: leftToSpend(limits) }])],
        waiting: [toReview === 0 ? null : plural(words.toReview(toReview), toReview), unratedNote(unrated)].filter((line) => line !== null).join(' · ') || null,
      }
    }),
}
