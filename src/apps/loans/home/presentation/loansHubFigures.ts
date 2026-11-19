import type { CountedHubPart, HubFigures } from '../../../../shared/app/appContribution'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { loansNetWorthParts } from '../domain/loansNetWorthParts'
import type { LoansNetWorthPart } from '../domain/loansNetWorthParts'
import { loanKeys } from '../../overview/presentation/loanKeys'
import { plannedLoans, upcomingPayments } from '../../overview/domain/loansTogether'
import type { UpcomingPayment } from '../../overview/domain/loansTogether'
import { bankLoanLink, informalLoanLink, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import type { LoanBook } from '../../workbook/domain/readLoanBook'
import { words } from './words'

/** Your next payment on a loan as one line under its name: its amount and day, and whom an informal loan's plan repays, as soon as you are behind. */
function nextPaymentLine(payment: UpcomingPayment): string {
  const amount = formatMoney(payment.youPay)
  if (payment.kind === 'bank') return words.nextPayment[payment.loan.repayment](amount, shortDayLabel(payment.date))
  const payee = payment.loan.counterparty || payment.loan.name
  return payment.overdue ? words.overduePayment(amount, payee) : words.nextPayment.informal(amount, shortDayLabel(payment.date), payee)
}

type LoanPart = Extract<LoansNetWorthPart, { side: 'owes' }>

/** One loan you owe on, by its name, with your next payment on it under it, opening its page. */
function loanPart(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, part: LoanPart, keys: ReturnType<typeof loanKeys>, day: CivilDate): CountedHubPart {
  const { kind, at } = part.loan
  if (kind === 'bank') {
    const loanBook = book.bankLoans[at]!
    const [next] = upcomingPayments(plannedLoans([loanBook]), [], day, 1)
    return { side: 'owes', cents: part.cents, key: keys.bank[at]!, label: loanBook.loan.name, caption: next === undefined ? null : nextPaymentLine(next), to: bankLoanLink(loanBook.loan) }
  }
  const loanBook = book.informalLoans[at]!
  const [next] = upcomingPayments([], [loanBook], day, 1)
  return { side: 'owes', cents: part.cents, key: keys.informal[at]!, label: loanBook.loan.name, caption: next === undefined ? null : nextPaymentLine(next), to: informalLoanLink(loanBook.loan) }
}

/** What others owe you when they do, then each loan you owe on with your next payment on it, for Net worth. */
export function loansHubFigures(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): HubFigures<CountedHubPart> {
  const keys = loanKeys(book)
  return {
    parts: loansNetWorthParts(book, day).map((part) =>
      part.side === 'has' ? { ...part, key: 'owed to you', label: words.owedToYou, caption: null, to: LOANS_OVERVIEW_ROUTE } : loanPart(book, part, keys, day),
    ),
    notes: [],
  }
}
