import { words as bankLoanWords } from '../bankLoans/presentation/words'
import { words as informalLoanWords } from '../informalLoans/presentation/words'
import { BANK_LOAN_ROUTE, INFORMAL_LOAN_ROUTE, LOANS_ASSISTANT_LINK, LOANS_OVERVIEW_ROUTE, LOANS_SETTINGS_ROUTE, SCENARIOS_ROUTE } from '../overview/presentation/loanLinks'
import { words as overviewWords } from '../overview/presentation/words'
import { words as scenarioWords } from '../scenarios/presentation/words'
import { words as settingsWords } from '../settings/presentation/words'
import type { LoanBook } from '../workbook/domain/readLoanBook'
import * as loanKinds from '../workbook/domain/loanKinds'
import { BANK_LOAN_RECORDS, INFORMAL_LOAN_RECORDS, LOAN_SCENARIO_RECORDS } from '../workbook/domain/loanKinds'
import type { AppAssistant, AssistantPlace } from '../../../shared/app/appContribution'
import type { AppAcceptance, AppProposer } from '../../../shared/app/assistantOperations'
import type { KnownPerson } from '../../../shared/privacy/domain/pseudonyms'
import { loansReader } from './loansReader'
import type { LoansReading } from './loansReader'
import { words } from './words'

/** Every Loans screen and tab, the tab first, since a person on a tab is on that tab and not on its screen. */
const PLACES: readonly AssistantPlace[] = [
  { route: LOANS_ASSISTANT_LINK, title: settingsWords.tabs.assistant },
  { route: LOANS_OVERVIEW_ROUTE, title: overviewWords.title },
  { route: SCENARIOS_ROUTE, title: scenarioWords.title, params: { compare: { kind: LOAN_SCENARIO_RECORDS.name }, base: { kind: LOAN_SCENARIO_RECORDS.name } } },
  { route: BANK_LOAN_ROUTE, title: bankLoanWords.bankLoan, params: { loan: { kind: BANK_LOAN_RECORDS.name } } },
  { route: INFORMAL_LOAN_ROUTE, title: informalLoanWords.informalLoan, params: { loan: { kind: INFORMAL_LOAN_RECORDS.name } } },
  { route: LOANS_SETTINGS_ROUTE, title: settingsWords.title },
]

/** The people of the informal loans, whichever way the money went, whose names go under an alias. */
export function informalCounterparties(book: LoanBook | null): readonly KnownPerson[] {
  return (book?.informalLoans ?? []).filter(({ loan }) => loan.counterparty.trim() !== '').map(({ loan }) => ({ name: loan.counterparty, employee: false, ibans: [] }))
}

/** What Loans tells the chat: what it keeps and where, what it can read, and the changes it takes, over the book and store `app.ts` hands in. It has no settings table of its own. */
export function loansAssistant(reading: LoansReading, changes: { readonly proposer: AppProposer; readonly acceptance: AppAcceptance } | null = null): AppAssistant {
  return {
    kinds: Object.values(loanKinds),
    places: PLACES,
    settings: [],
    guides: [],
    automations: [],
    reader: loansReader(reading),
    proposer: changes?.proposer ?? null,
    acceptance: changes?.acceptance ?? null,
    quickActions: [words.quickActions.next, words.quickActions.offers, words.quickActions.extra],
    persons: () => informalCounterparties(reading.book()),
    fileFormats: [],
  }
}
