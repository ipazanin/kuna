import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { loansNetWorthParts } from '../domain/loansNetWorthParts'
import { plannedLoans, upcomingPayments } from '../../overview/domain/loansTogether'
import { LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { nextPaymentCaption } from '../../overview/presentation/loansOverview'
import type { LoanBook } from '../../workbook/domain/readLoanBook'
import { words } from './words'

/** What you owe over every loan, with your next payment under it, and what others owe you when they do, for Net worth. */
export function loansHubFigures(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): HubFigures<CountedHubPart> {
  const [next] = upcomingPayments(plannedLoans(book.bankLoans), book.informalLoans, day, 1)
  const nextCaption = next === undefined ? null : words.nextPayment(formatMoney(next.yourShare), nextPaymentCaption(next))
  return {
    parts: loansNetWorthParts(book, day).map((part) => ({
      ...part,
      label: part.side === 'has' ? words.owedToYou : words.owed,
      caption: part.side === 'has' ? null : nextCaption,
      to: LOANS_OVERVIEW_ROUTE,
    })),
    notes: [],
  }
}
