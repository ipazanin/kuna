import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { Money } from '../../../../shared/money/money'
import { owedOnDay } from '../../overview/domain/owedTotals'
import type { LoanBook } from '../../workbook/domain/readLoanBook'

/** What Loans adds to the sum on Net worth: what others owe you, or what you owe, which is taken off. */
export interface LoansNetWorthPart {
  readonly side: 'has' | 'owes'
  readonly cents: Money
}

/** What others owe you when they do, then what you owe over every loan. */
export function loansNetWorthParts(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>, day: CivilDate): LoansNetWorthPart[] {
  const { owed, owedToYou } = owedOnDay(book, day)
  return [...(owedToYou > 0 ? [{ side: 'has' as const, cents: owedToYou }] : []), { side: 'owes', cents: owed }]
}
