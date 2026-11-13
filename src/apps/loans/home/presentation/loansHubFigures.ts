import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { loansNetWorthParts } from '../domain/loansNetWorthParts'
import { plannedLoans, upcomingPayments } from '../../overview/domain/loansTogether'
import type { UpcomingPayment } from '../../overview/domain/loansTogether'
import { LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import type { LoanBook } from '../../workbook/domain/readLoanBook'
import { words } from './words'

/** Your next payment as one line: its amount, the day and the bank loan, or whom an informal loan's plan repays, as soon as you are behind. */
function nextPaymentLine(payment: UpcomingPayment): string {
  const amount = formatMoney(payment.yourShare)
  if (payment.kind === 'bank') return words.nextPayment[payment.loan.repayment](amount, shortDayLabel(payment.date), payment.loan.name)
  const payee = payment.loan.counterparty || payment.loan.name
  return payment.overdue ? words.overduePayment(amount, payee) : words.nextPayment.informal(amount, shortDayLabel(payment.date), payee)
}

/** What you owe over every loan, with your next payment under it, and what others owe you when they do, for Net worth. */
export function loansHubFigures(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): HubFigures<CountedHubPart> {
  const [next] = upcomingPayments(plannedLoans(book.bankLoans), book.informalLoans, day, 1)
  const nextCaption = next === undefined ? null : nextPaymentLine(next)
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
