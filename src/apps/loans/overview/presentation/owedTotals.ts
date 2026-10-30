import { ZERO, negateMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import type { BankLoanFigures } from '../../bankLoans/presentation/bankLoanView'
import type { InformalLoanFigures } from '../../informalLoans/presentation/informalLoanView'

export interface OwedTotals {
  /** What you owe over every loan. */
  readonly owed: Money
  /** What others owe you on informal loans, apart from what you owe. */
  readonly owedToYou: Money
}

/** The figures of each loan, which the screen or card has worked out already. A bank loan whose plan cannot be worked out has none. */
export interface LoanFigures {
  readonly bank: readonly (BankLoanFigures | null)[]
  readonly informal: readonly InformalLoanFigures[]
}

/** The totals the Loans Overview and its card on the home lead with. A bank loan without figures adds nothing. */
export function owedTotals(loans: LoanFigures): OwedTotals {
  const owed: Money[] = [...loans.bank.map((figures) => figures?.owed ?? ZERO), ...loans.informal.map((figures) => figures.owedByYou)]
  return {
    owed: sumMoney(owed.filter((amount) => amount > 0)),
    owedToYou: sumMoney(owed.filter((amount) => amount < 0).map(negateMoney)),
  }
}
