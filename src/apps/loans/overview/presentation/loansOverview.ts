import type { RouteLocationRaw } from 'vue-router'

import { bankLoanFigures, bankLoanPaidOffOn } from '../../bankLoans/presentation/bankLoanView'
import type { BankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import { DIRECTION_LOOKS } from '../../directions/presentation/loanDirection'
import type { DirectionLook } from '../../directions/presentation/loanDirection'
import { planStanding } from '../../informalLoans/domain/expectedPlan'
import type { PlanStanding } from '../../informalLoans/domain/expectedPlan'
import { informalClosedOn, informalLoanFigures, standingWords } from '../../informalLoans/presentation/informalLoanView'
import type { InformalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import type { LoanDirection } from '../../workbook/domain/informalLoan'
import type { BankLoanBook, InformalLoanBook, LoanBook } from '../../workbook/domain/readLoanBook'
import type { UpcomingPayment } from '../domain/loansTogether'
import { bankLoanLink, informalLoanLink } from './loanLinks'
import { owedTotals } from './owedTotals'
import type { OwedTotals } from './owedTotals'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { negateMoney, subtractMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { plural } from '../../../../shared/text/translation'

export interface OverviewBankLoan {
  readonly book: BankLoanBook
  /** Null while the plan cannot be worked out. */
  readonly figures: BankLoanFigures | null
}

export interface OverviewInformalLoan {
  readonly book: InformalLoanBook
  readonly figures: InformalLoanFigures
  /** The look of the loan's direction, whatever its balance. */
  readonly look: DirectionLook
  readonly standing: PlanStanding | null
}

/** A loan at zero as the Completed card lists it. */
export interface CompletedLoan {
  readonly key: string
  readonly name: string
  /** Who it was with, or what kind of loan it is. */
  readonly with: string
  readonly look: DirectionLook
  /** When it was settled or paid off. */
  readonly closed: string
  readonly to: RouteLocationRaw
}

/** The larger direction less the smaller, and the way it goes, null when the two are even. */
export interface NetOwed {
  readonly amount: Money
  readonly direction: LoanDirection | null
}

/** The loans of the Overview: the open ones for a card each, the loans at zero for Completed, and the totals both ways. */
export interface LoansOverview {
  readonly openBank: readonly OverviewBankLoan[]
  readonly openInformal: readonly OverviewInformalLoan[]
  readonly completed: readonly CompletedLoan[]
  readonly totals: OwedTotals
  readonly net: NetOwed
}

/** A bank loan is closed once its payoff day has passed, and an informal loan once it is settled. Totals count every loan by who owes on the day. */
export function loansOverview(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): LoansOverview {
  const bank = book.bankLoans.map((loanBook) => ({ open: { book: loanBook, figures: bankLoanFigures(loanBook, day) }, paidOff: bankLoanPaidOffOn(loanBook, day) }))
  const informal = book.informalLoans.map((loanBook) => ({
    open: { book: loanBook, figures: informalLoanFigures(loanBook, day), look: DIRECTION_LOOKS[loanBook.loan.direction], standing: planStanding(loanBook.loan, loanBook.movements, day) },
    settled: informalClosedOn(loanBook, day),
  }))
  const totals = owedTotals({ bank: bank.map((entry) => entry.open.figures), informal: informal.map((entry) => entry.open.figures) })
  const net = subtractMoney(totals.owedToYou, totals.owed)
  return {
    openBank: bank.flatMap((entry) => (entry.paidOff === null ? [entry.open] : [])),
    openInformal: informal.flatMap((entry) => (entry.settled === null ? [entry.open] : [])),
    completed: [
      ...bank.flatMap(({ open, paidOff }) => {
        const { loan } = open.book
        return paidOff === null
          ? []
          : [{ key: loan.id, name: loan.name, with: loan.lender, look: DIRECTION_LOOKS['you-owe'], closed: words.completed.paidOffOn(dayLabel(paidOff)), to: bankLoanLink(loan) }]
      }),
      ...informal.flatMap(({ open, settled }) => {
        const { loan } = open.book
        return settled === null ? [] : [{ key: loan.id, name: loan.name, with: loan.counterparty, look: open.look, closed: words.completed.settledOn(dayLabel(settled)), to: informalLoanLink(loan) }]
      }),
    ],
    totals,
    net: { amount: net < 0 ? negateMoney(net) : net, direction: net === 0 ? null : net < 0 ? 'you-owe' : 'owed-to-you' },
  }
}

/** How many loans a direction's tile adds up, and who is behind on an expected plan among the open loans that run that way. */
export function directionCaption(overview: LoansOverview, direction: LoanDirection): string {
  const count = direction === 'you-owe' ? overview.totals.loansYouOwe : overview.totals.loansOwedToYou
  const loans = count === 0 ? (direction === 'you-owe' ? words.tiles.youOweNothing : words.tiles.nobodyOwesYou) : plural(words.tiles.onLoans(count), count)
  const behind = overview.openInformal.flatMap((entry) =>
    entry.book.loan.direction === direction && entry.standing !== null && entry.standing.ahead < 0 ? [{ loan: entry.book.loan, standing: entry.standing }] : [],
  )
  const [only] = behind
  if (only === undefined) return loans
  return [loans, behind.length === 1 ? standingWords(only.loan, only.standing).text : plural(words.tiles.behindOnPlans(behind.length), behind.length)].join(', ')
}

/** When the next payment falls due and what it is for: the bank loan, or whom an informal loan's plan repays, now when you are behind. */
export function nextPaymentCaption(payment: UpcomingPayment): string {
  if (payment.kind === 'bank') return words.tiles.nextOn(shortDayLabel(payment.date), payment.loan.name)
  const payee = payment.loan.counterparty || payment.loan.name
  return payment.overdue ? words.tiles.overdueTo(payee) : words.tiles.nextTo(shortDayLabel(payment.date), payee)
}

/** The day the bank plans leave you free of all debt, null while an informal loan you owe is open, since nothing gives the day it ends. */
export function freeOfAllDebtOn(overview: LoansOverview, bankLoansPaidOff: CivilDate | null): CivilDate | null {
  return overview.openInformal.some((entry) => entry.figures.owedByYou > 0) ? null : bankLoansPaidOff
}
