import type { RouteLocationRaw } from 'vue-router'

import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import { BANK_LOAN_RECORDS, INFORMAL_LOAN_RECORDS } from '../../workbook/domain/loanKinds'
import type { BankLoanBook, InformalLoanBook, LoanBook } from '../../workbook/domain/readLoanBook'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

export const LOANS_OVERVIEW_ROUTE = '/loans'
export const BANK_LOAN_ROUTE = '/loans/bank-loan'
export const INFORMAL_LOAN_ROUTE = '/loans/informal-loan'

/** A bank loan's page, which names the loan by its bare UUID in `?loan=`. */
export function bankLoanLink(loan: BankLoan): RouteLocationRaw {
  return { path: BANK_LOAN_ROUTE, query: { loan: keyOfRecordId(BANK_LOAN_RECORDS, loan.id) } }
}

export function informalLoanLink(loan: InformalLoan): RouteLocationRaw {
  return { path: INFORMAL_LOAN_ROUTE, query: { loan: keyOfRecordId(INFORMAL_LOAN_RECORDS, loan.id) } }
}

/** The bank loan the page's `?loan=` names, or null when the file has none by that id. */
export function bankLoanNamed(book: LoanBook, key: unknown): BankLoanBook | null {
  return typeof key === 'string' ? (book.bankLoans.find((entry) => entry.loan.id === recordIdOf(BANK_LOAN_RECORDS, key)) ?? null) : null
}

export function informalLoanNamed(book: LoanBook, key: unknown): InformalLoanBook | null {
  return typeof key === 'string' ? (book.informalLoans.find((entry) => entry.loan.id === recordIdOf(INFORMAL_LOAN_RECORDS, key)) ?? null) : null
}
