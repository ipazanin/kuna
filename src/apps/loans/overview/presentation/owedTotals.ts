import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { bankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import type { BankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import { informalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import type { InformalLoanFigures } from '../../informalLoans/presentation/informalLoanView'
import type { LoanBook } from '../../workbook/domain/readLoanBook'

export interface OwedTotals {
  /** What you owe over every loan. */
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

/** The totals the Loans Overview and its card on the home lead with, each way by who owes on the day. A bank loan without figures adds nothing. */
export function owedTotals(loans: LoanFigures): OwedTotals {
  const owed: Money[] = [...loans.bank.flatMap((figures) => (figures === null ? [] : [figures.owed])), ...loans.informal.map((figures) => figures.owedByYou)]
  const youOwe = owed.filter((amount) => amount > 0)
  const owedToYou = owed.filter((amount) => amount < 0).map(negateMoney)
  return { owed: sumMoney(youOwe), owedToYou: sumMoney(owedToYou), loansYouOwe: youOwe.length, loansOwedToYou: owedToYou.length }
}

/** The totals over every loan of the file on a day, for the figures shown outside the Overview. */
export function owedOnDay(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): OwedTotals {
  return owedTotals({ bank: book.bankLoans.map((loan) => bankLoanFigures(loan, day)), informal: book.informalLoans.map((loan) => informalLoanFigures(loan, day)) })
}
