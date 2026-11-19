import { distinctNames } from '../../../../shared/app/distinctNames'
import type { LoanBook } from '../../workbook/domain/readLoanBook'

/** Each loan of the file as the chat and Net worth key it, by its lender and payout day or its start day and never by a name a person gave, in the file's order, with a number after a repeat. */
export function loanKeys(book: Pick<LoanBook, 'bankLoans' | 'informalLoans'>): { readonly bank: readonly string[]; readonly informal: readonly string[] } {
  return {
    bank: distinctNames(book.bankLoans.map(({ loan }) => `bank loan from ${loan.lender} paid out ${loan.drawdown}`)),
    informal: distinctNames(book.informalLoans.map(({ loan }) => `informal loan started ${loan.start}`)),
  }
}
