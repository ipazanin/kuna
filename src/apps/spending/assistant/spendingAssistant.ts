import { words as analysisWords } from '../analytics/presentation/words'
import {
  SPENDING_ACCOUNT_ROUTE,
  SPENDING_ACCOUNTS_ROUTE,
  SPENDING_ANALYSIS_ROUTE,
  SPENDING_ASSISTANT_LINK,
  SPENDING_BANK_SYNC_LINK,
  SPENDING_BUDGETS_ROUTE,
  SPENDING_OVERVIEW_ROUTE,
  SPENDING_PAYEES_ROUTE,
  SPENDING_REVIEW_LINK,
  SPENDING_SETTINGS_ROUTE,
  SPENDING_SORTING_ROUTE,
  SPENDING_TRANSACTIONS_ROUTE,
} from '../overview/presentation/spendingLinks'
import { payeeDirectory, personPayees } from '../payees/domain/payeeDirectory'
import { words as receiptWords } from '../receipts/presentation/words'
import { words as workbookWords } from '../workbook/domain/words'
import { words as screenWords } from '../screenWords'
import { words as settingsWords } from '../settings/presentation/words'
import { words as statementWords } from '../statements/presentation/words'
import * as spendingKinds from '../workbook/domain/spendingKinds'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../workbook/domain/spendingKinds'
import { BANK_SYNC_APPLICATION_KEY } from '../workbook/domain/spendingSettings'
import type { AppAssistant, AssistantPlace } from '../../../shared/app/appContribution'
import type { AppAcceptance, AppProposer } from '../../../shared/app/assistantOperations'
import { PAYEE_LINES, spendingReader } from './spendingReader'
import type { SpendingReading } from './spendingReader'
import { words } from './words'
import type { GuideLabels } from './words'

const IMPORT_LINK = `${SPENDING_TRANSACTIONS_ROUTE}?tab=import`
const RECEIPTS_LINK = `${SPENDING_SETTINGS_ROUTE}?tab=receipts`

/** Every Spending screen and tab, the tabs first, since a person on a tab is on that tab and not on its screen. */
const PLACES: readonly AssistantPlace[] = [
  { route: SPENDING_REVIEW_LINK, title: statementWords.tabs.review },
  { route: IMPORT_LINK, title: statementWords.tabs.import },
  { route: SPENDING_BANK_SYNC_LINK, title: settingsWords.tabs.bankSync },
  { route: RECEIPTS_LINK, title: settingsWords.tabs.receipts },
  { route: SPENDING_ASSISTANT_LINK, title: settingsWords.tabs.assistant },
  { route: `${SPENDING_ANALYSIS_ROUTE}?tab=over-time`, title: analysisWords.analysis.tabs.overTime, params: { category: { kind: CATEGORY_RECORDS.name } } },
  { route: `${SPENDING_ANALYSIS_ROUTE}?tab=year`, title: analysisWords.analysis.tabs.year, params: { category: { kind: CATEGORY_RECORDS.name }, year: 'year' } },
  { route: `${SPENDING_ANALYSIS_ROUTE}?tab=savings`, title: analysisWords.analysis.tabs.savings },
  { route: SPENDING_OVERVIEW_ROUTE, title: screenWords.overview, params: { group: { kind: CATEGORY_RECORDS.name } } },
  {
    route: SPENDING_TRANSACTIONS_ROUTE,
    title: screenWords.entries,
    params: { month: 'month', from: 'day', to: 'day', account: { kind: ACCOUNT_RECORDS.name }, category: { kind: CATEGORY_RECORDS.name }, payee: { kind: PAYEE_LINES.name } },
  },
  { route: SPENDING_BUDGETS_ROUTE, title: screenWords.limits, params: { month: 'month' } },
  { route: SPENDING_SORTING_ROUTE, title: screenWords.sorting },
  { route: SPENDING_PAYEES_ROUTE, title: screenWords.payees },
  { route: SPENDING_ANALYSIS_ROUTE, title: screenWords.analysis, params: { period: 'period' } },
  { route: SPENDING_ACCOUNTS_ROUTE, title: screenWords.accounts },
  { route: SPENDING_ACCOUNT_ROUTE, title: screenWords.account, params: { account: { kind: ACCOUNT_RECORDS.name } } },
  { route: SPENDING_SETTINGS_ROUTE, title: screenWords.settings },
]

const LABELS: GuideLabels = {
  entries: screenWords.entries,
  review: statementWords.tabs.review,
  import: statementWords.tabs.import,
  always: statementWords.review.always,
  settings: screenWords.settings,
  sorting: screenWords.sorting,
  bankSync: settingsWords.tabs.bankSync,
  limits: screenWords.limits,
  application: workbookWords.settingLabels.application,
  addReceipt: receiptWords.add,
}

/** What Spending tells the chat: what it keeps and where things are, with the first guides, its automation and what it can read. */
export const spendingAssistant = (reading: SpendingReading, changes: { readonly proposer: AppProposer; readonly acceptance: AppAcceptance } | null = null): AppAssistant => ({
  kinds: Object.values(spendingKinds),
  places: PLACES,
  automations: [{ id: 'bank-sync', title: words.automations.bankSync.title, what: words.automations.bankSync.what(LABELS), setUpRoute: SPENDING_BANK_SYNC_LINK, guide: 'link-a-bank' }],
  settings: [{ key: BANK_SYNC_APPLICATION_KEY, note: words.settings.bankSyncApplication, neverPropose: true }],
  guides: [
    { id: 'set-up', label: words.guides.setUp.label, title: words.guides.setUp.title, body: words.guides.setUp.body, places: [SPENDING_OVERVIEW_ROUTE, SPENDING_ACCOUNTS_ROUTE, IMPORT_LINK] },
    { id: 'first-rules', title: words.guides.rules.title, body: words.guides.rules.body(LABELS), places: [SPENDING_REVIEW_LINK, IMPORT_LINK, SPENDING_SORTING_ROUTE] },
    { id: 'first-import', title: words.guides.import.title, body: words.guides.import.body(LABELS), places: [IMPORT_LINK, SPENDING_REVIEW_LINK] },
    { id: 'link-a-bank', title: words.guides.bankSync.title, body: words.guides.bankSync.body(LABELS), places: [SPENDING_BANK_SYNC_LINK] },
    { id: 'first-limit', title: words.guides.limits.title, body: words.guides.limits.body(LABELS), places: [SPENDING_BUDGETS_ROUTE] },
    { id: 'categories', title: words.guides.categories.title, body: words.guides.categories.body(LABELS), places: [SPENDING_SORTING_ROUTE] },
    { id: 'receipts', title: words.guides.receipts.title, body: words.guides.receipts.body(LABELS), places: [SPENDING_TRANSACTIONS_ROUTE] },
  ],
  setUp: [
    { key: 'first-account', about: 'The file has no account yet.', operations: ['add-account'] },
    { key: 'first-entries', about: 'No entry is in yet.', operations: ['import-statement', 'add-entry'] },
  ],
  reader: spendingReader(reading),
  proposer: changes?.proposer ?? null,
  acceptance: changes?.acceptance ?? null,
  quickActions: [words.quickActions.sort, words.quickActions.rules, words.quickActions.higher],
  persons: () => {
    const book = reading.book()
    if (book === null) return []
    return personPayees(payeeDirectory(book.payees, book.readings.settings.facts)).flatMap((payee) => payee.names.map((name) => ({ name, employee: false, ibans: payee.ibans })))
  },
})
