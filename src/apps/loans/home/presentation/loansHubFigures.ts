import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plannedLoans, upcomingPayments } from '../../overview/domain/loansTogether'
import { LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { nextPaymentCaption } from '../../overview/presentation/loansOverview'
import { owedOnDay } from '../../overview/presentation/owedTotals'
import type { LoanBook } from '../../workbook/domain/readLoanBook'
import { words } from './words'

/** What you owe over every loan, with your next payment under it, and what others owe you when they do, for Net worth. */
export function loansHubFigures(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): HubFigures<CountedHubPart> {
  const { owed, owedToYou } = owedOnDay(book, day)
  const [next] = upcomingPayments(plannedLoans(book.bankLoans), book.informalLoans, day, 1)
  return {
    parts: [
      ...(owedToYou > 0 ? [{ label: words.owedToYou, cents: owedToYou, side: 'has' as const, caption: null, to: LOANS_OVERVIEW_ROUTE }] : []),
      { label: words.owed, cents: owed, side: 'owes', caption: next === undefined ? null : words.nextPayment(formatMoney(next.yourShare), nextPaymentCaption(next)), to: LOANS_OVERVIEW_ROUTE },
    ],
    notes: [],
  }
}
