import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { bankLoanFigures, owedByYou } from '../../bankLoans/domain/bankLoanFigures'
import type { BankLoanFigures } from '../../bankLoans/domain/bankLoanFigures'
import { informalLoanFigures } from '../../informalLoans/domain/informalLoanFigures'
import type { InformalLoanFigures } from '../../informalLoans/domain/informalLoanFigures'
import type { LoanDirection } from '../../workbook/domain/informalLoan'
import type { LoanBook } from '../../workbook/domain/readLoanBook'

export interface OwedTotals {
  /** What you owe over every loan, your part of each bank loan you took out with others. */
  readonly owed: Money
  /** What others owe you on informal loans, apart from what you owe. */
  readonly owedToYou: Money
  /** How many loans you owe on, and how many others owe you on. */
  readonly loansYouOwe: number
  readonly loansOwedToYou: number
}

/** The figures of each loan, which the screen or card has worked out already. A bank loan whose plan cannot be worked out has none. */
export interface LoanFigures {
  readonly bank: readonly (BankLoanFigures | null)[]
  readonly informal: readonly InformalLoanFigures[]
}

/** What you owe on one loan on the day, below zero when it is owed to you, with the loan's kind and its place among the file's loans of that kind. */
export interface OwedOnLoan {
  readonly kind: 'bank' | 'informal'
  readonly at: number
  readonly owed: Money
}

/** What you owe on each loan, bank loans first, your part of each bank loan you took out with others. A bank loan without figures is left out. */
export function owedPerLoan(loans: LoanFigures): OwedOnLoan[] {
  return [
    ...loans.bank.flatMap((figures, at) => (figures === null ? [] : [{ kind: 'bank' as const, at, owed: owedByYou(figures) }])),
    ...loans.informal.map((figures, at) => ({ kind: 'informal' as const, at, owed: figures.owedByYou })),
  ]
}

/** The totals the Loans Overview and its card on the home lead with, each way by who owes on the day. A bank loan without figures adds nothing. */
export function owedTotals(loans: LoanFigures): OwedTotals {
  const owed = owedPerLoan(loans).map((loan) => loan.owed)
  const youOwe = owed.filter((amount) => amount > 0)
  const owedToYou = owed.filter((amount) => amount < 0).map(negateMoney)
  return { owed: sumMoney(youOwe), owedToYou: sumMoney(owedToYou), loansYouOwe: youOwe.length, loansOwedToYou: owedToYou.length }
}

/** What others owe you less what you owe, below zero while you owe more. */
export function netOwed(totals: Pick<OwedTotals, 'owed' | 'owedToYou'>): Money {
  return subtractMoney(totals.owedToYou, totals.owed)
}

/** Who owes on balance by the sign of the net, or null when the two ways are even. */
export function netDirection(net: Money): LoanDirection | null {
  if (net === 0) return null
  return net < 0 ? 'you-owe' : 'owed-to-you'
}

/** The figures of every loan of the file on a day. */
export function loanFiguresOn(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): LoanFigures {
  return { bank: book.bankLoans.map((loan) => bankLoanFigures(loan, day)), informal: book.informalLoans.map((loan) => informalLoanFigures(loan, day)) }
}

/** The totals over every loan of the file on a day, for the figures shown outside the Overview. */
export function owedOnDay(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): OwedTotals {
  return owedTotals(loanFiguresOn(book, day))
}
