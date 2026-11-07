import type { LoanBook } from '../workbook/domain/readLoanBook'
import * as loanKinds from '../workbook/domain/loanKinds'
import type { AppAssistant } from '../../../shared/app/appContribution'
import type { KnownPerson } from '../../../shared/privacy/domain/pseudonyms'

/** The people who lent the owner money informally, whose names go under an alias. */
export function informalLenders(book: LoanBook | null): readonly KnownPerson[] {
  return (book?.informalLoans ?? []).filter(({ loan }) => loan.direction === 'you-owe' && loan.counterparty.trim() !== '').map(({ loan }) => ({ name: loan.counterparty, employee: false, ibans: [] }))
}

/** What Loans tells the chat: what it keeps, and its informal lenders, read from the book `app.ts` hands in. It has no settings table of its own. */
export function loansAssistant(book: () => LoanBook | null): AppAssistant {
  return {
    kinds: Object.values(loanKinds),
    places: [],
    settings: [],
    guides: [],
    automations: [],
    reader: null,
    proposer: null,
    acceptance: null,
    quickActions: [],
    persons: () => informalLenders(book()),
  }
}
