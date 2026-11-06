import { noteBankReturn, openBankSyncAfterReturn } from './bankSync/presentation/bankReturnOnOpen'
import { SPENDING_HOME_CARD } from './home/presentation/spendingHomeCard'
import { spendingHubFigures } from './home/presentation/spendingHubFigures'
import {
  SPENDING_ACCOUNT_ROUTE,
  SPENDING_ACCOUNTS_ROUTE,
  SPENDING_BUDGETS_ROUTE,
  SPENDING_OVERVIEW_ROUTE,
  SPENDING_REVIEW_LINK,
  SPENDING_SETTINGS_ROUTE,
  SPENDING_START_ROUTE,
  SPENDING_TRANSACTIONS_ROUTE,
} from './overview/presentation/spendingLinks'
import { spendingSetUp } from './overview/presentation/spendingSetUp'
import { startRates, useRates } from './rates/presentation/useRates'
import { words as screenWords } from './screenWords'
import { READ_RECEIPT_SUMMARY } from './receipts/assist/presentation/receiptAssist'
import { reviewCount } from './statements/domain/reviewQueue'
import { spendingSyncGroup } from './sync/presentation/spendingSyncGroup'
import { words } from './words'
import { useSpendingBooks } from './workbook/application/spendingStore'
import { SPENDING_APP } from './workbook/infrastructure/spendingDocument'
import { words as fileWords } from './workbook/presentation/words'
import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { homeCardFigures } from '../../shared/app/homeCardFigures'
import { today } from '../../shared/calendar/civilDate'
import { DEFAULT_MONEY_FORMAT } from '../../shared/money/moneyFormat'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { resumeFileLookup } from '../../shared/storage/presentation/resumeFileLookup'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'

const OVERVIEW: AppScreen = { path: SPENDING_OVERVIEW_ROUTE, title: screenWords.overview, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') }
const TRANSACTIONS: AppScreen = { path: SPENDING_TRANSACTIONS_ROUTE, title: screenWords.entries, icon: 'i-lucide-list', component: () => import('./entries/presentation/TransactionsScreen.vue') }
const BUDGETS: AppScreen = { path: SPENDING_BUDGETS_ROUTE, title: screenWords.limits, icon: 'i-lucide-gauge', component: () => import('./budgets/presentation/BudgetsScreen.vue') }
const ACCOUNTS: AppScreen = { path: SPENDING_ACCOUNTS_ROUTE, title: screenWords.accounts, icon: 'i-lucide-landmark', component: () => import('./accounts/presentation/AccountsScreen.vue') }
const SETTINGS: AppScreen = { path: SPENDING_SETTINGS_ROUTE, title: screenWords.settings, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useSpendingBooks()
const rates = useRates()

/** Your own accounts, kept in a file of their own: what comes in and goes out of each, by category, against monthly limits. */
export const spendingApp: AppContribution = {
  id: SPENDING_APP,
  name: words.name,
  colour: '--app-spending',
  async install() {
    noteBankReturn()
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeSpending } = await import('./workbook/infrastructure/fake/seedFakeSpending')
      const { saveLastFetch } = await import('./bankSync/infrastructure/bankBrowserState')
      const { registerFakeReceiptRead } = await import('./receipts/assist/infrastructure/fake/fakeReceiptRead')
      saveLastFetch(null)
      registerFakeReceiptRead()
      const query = new URLSearchParams(window.location.search)
      await seedFakeSpending(query.get('spending'), query.get('banksync'))
    }
  },
  screens: [
    OVERVIEW,
    TRANSACTIONS,
    BUDGETS,
    ACCOUNTS,
    { path: SPENDING_ACCOUNT_ROUTE, title: screenWords.account, icon: 'i-lucide-landmark', component: () => import('./accounts/presentation/AccountScreen.vue') },
    SETTINGS,
    { path: SPENDING_START_ROUTE, title: words.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/StartScreen.vue'), bare: true },
  ],
  menu: () => [OVERVIEW, TRANSACTIONS, BUDGETS, ACCOUNTS],
  settings: SETTINGS,
  menuCount: (screen) => {
    const count = screen.path === SPENDING_TRANSACTIONS_ROUTE && state.workbook !== null ? reviewCount(state.workbook) : 0
    return count === 0 ? null : { count, opens: SPENDING_REVIEW_LINK }
  },
  subtitle: () => null,
  // Every figure on the Spending screens and on Net worth is in euros, so it shows them in the language's format.
  moneyFormat: () => DEFAULT_MONEY_FORMAT,
  homeCard: SPENDING_HOME_CARD,
  hub: { counts: true, figures: () => homeCardFigures(state, (book) => spendingHubFigures(book, rates.value, today())) },
  assist: { tasks: () => [READ_RECEIPT_SUMMARY] },
  setUpLines: () => (state.workbook === null ? [] : spendingSetUp(state.workbook)),
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: SPENDING_START_ROUTE,
  syncGroup: spendingSyncGroup,
  asksGoogleOnOpen: () => loadWorkbookChoice(SPENDING_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Spending file asked Google for. The page's sync resumes a sync.
  start(router, googleReturn) {
    const stopRates = startRates()
    openBankSyncAfterReturn(router)
    resumeFileLookup({ store: useSpendingBooks(), words: fileWords, startRoute: SPENDING_START_ROUTE, overviewRoute: SPENDING_OVERVIEW_ROUTE }, router, googleReturn)
    return stopRates
  },
}
