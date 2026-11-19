import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { loanFiguresOn, owedPerLoan, owedTotals } from '../../overview/domain/owedTotals'
import type { OwedOnLoan } from '../../overview/domain/owedTotals'
import type { LoanBook } from '../../workbook/domain/readLoanBook'

/** What Loans adds to the sum on Net worth: what others owe you, or what you owe on one loan, which is taken off. */
export type LoansNetWorthPart = { readonly side: 'has'; readonly cents: Money } | { readonly side: 'owes'; readonly cents: Money; readonly loan: Pick<OwedOnLoan, 'kind' | 'at'> }

/** What others owe you when they do, as one part, then what you owe on each loan you owe on, which add up to what `owedTotals` says you owe. */
export function loansNetWorthParts(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): LoansNetWorthPart[] {
  const figures = loanFiguresOn(book, day)
  const { owedToYou } = owedTotals(figures)
  return [
    ...(owedToYou > 0 ? [{ side: 'has' as const, cents: owedToYou }] : []),
    ...owedPerLoan(figures)
      .filter((loan) => loan.owed > 0)
      .map(({ kind, at, owed }) => ({ side: 'owes' as const, cents: owed, loan: { kind, at } })),
  ]
}
