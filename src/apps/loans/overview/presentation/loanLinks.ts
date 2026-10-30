import type { RouteLocationRaw } from 'vue-router'

import { OFFERS_TAB } from '../../scenarios/presentation/useScenarioCompare'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import { BANK_LOAN_RECORDS, INFORMAL_LOAN_RECORDS } from '../../workbook/domain/loanKinds'
import type { BankLoanBook, InformalLoanBook, LoanBook } from '../../workbook/domain/readLoanBook'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'

export const LOANS_OVERVIEW_ROUTE = '/loans'
/** The Loans first run, with its step in the query. */
export const LOANS_START_ROUTE = '/loans/start'
export const BANK_LOAN_ROUTE = '/loans/bank-loan'
export const INFORMAL_LOAN_ROUTE = '/loans/informal-loan'
export const SCENARIOS_ROUTE = '/loans/scenarios'

/** A bank loan's page, which names the loan by its bare UUID in `?loan=`. */
export function bankLoanLink(loan: BankLoan): RouteLocationRaw {
  return { path: BANK_LOAN_ROUTE, query: { loan: keyOfRecordId(BANK_LOAN_RECORDS, loan.id) } }
}

/** The key of a bank loan's tab on Scenarios, its bare UUID. */
export function scenarioTabOf(loan: BankLoan): string {
  return keyOfRecordId(BANK_LOAN_RECORDS, loan.id)
}

/** Scenarios on the bank loan's tab, or on Offers for null, with the scenario of the key picked when one is given. */
export function scenariosLink(loan: BankLoan | null, picked?: string): RouteLocationRaw {
  return { path: SCENARIOS_ROUTE, query: { tab: loan === null ? OFFERS_TAB : scenarioTabOf(loan), ...(picked === undefined ? {} : { compare: picked }) } }
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
