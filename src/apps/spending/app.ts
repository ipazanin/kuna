import { noteBankReturn, openBankSyncAfterReturn } from './bankSync/presentation/bankReturnOnOpen'
import { spendingData } from './workbook/presentation/spendingData'
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
import { ratesIn } from './rates/domain/ratesState'
import { startRates, useRates } from './rates/presentation/useRates'
import { words as screenWords } from './screenWords'
import { SPENDING_ASSIST } from './assistant/spendingAssist'
import type { ReceiptPorts } from './assistant/operations/receiptOperation'
import type { SpendingPorts } from './assistant/operations/spendingOperations'
import { reviewCount } from './statements/domain/reviewQueue'
import { spendingSyncGroup } from './sync/presentation/spendingSyncGroup'
import { words } from './words'
import { useSpendingBooks } from './workbook/application/spendingStore'
import { SPENDING_APP } from './workbook/domain/spendingBooks'
import { words as fileWords } from './workbook/presentation/words'
import { providerInUse } from '../../shared/ai/presentation/aiProvider'
import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { homeCardFigures } from '../../shared/app/homeCardFigures'
import { isFirstRun } from '../../shared/app/isFirstRun'
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
      const { fakeSpendingDay } = await import('./workbook/infrastructure/fake/fakeSpending')
      const { saveLastFetch } = await import('./bankSync/infrastructure/bankBrowserState')
      const { registerFakeSpendingChat } = await import('./assistant/infrastructure/fake/fakeSpendingChat')
      saveLastFetch(null)
      registerFakeSpendingChat()
      const query = new URLSearchParams(window.location.search)
      await seedFakeSpending(query.get('spending'), query.get('banksync'), fakeSpendingDay(query.get('day')))
    }
  },
  screens: [
    OVERVIEW,
    TRANSACTIONS,
    BUDGETS,
    ACCOUNTS,
    {
      path: SPENDING_ACCOUNT_ROUTE,
      needsRecord: true,
      under: SPENDING_ACCOUNTS_ROUTE,
      title: screenWords.account,
      icon: 'i-lucide-landmark',
      component: () => import('./accounts/presentation/AccountScreen.vue'),
    },
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
  assistant: async () => {
    const [
      { spendingAssistant },
      { spendingProposer, spendingAcceptance },
      { qrTextOn },
      { canKeepPhotoNow, receiptPhotos },
      { modelOf },
      { heldBankSetup },
      { forgetLastAccount, lastAccountId, rememberLastAccount, startingAccount },
    ] = await Promise.all([
      import('./assistant/spendingAssistant'),
      import('./assistant/operations/spendingOperations'),
      import('./receipts/infrastructure/qrDecode'),
      import('./receipts/presentation/receiptPhotosPort'),
      import('../../shared/ai/application/assistSettings'),
      import('./bankSync/presentation/useBankSync'),
      import('./entries/infrastructure/lastAccount'),
    ])
    const store = useSpendingBooks()
    const [{ browserFileOf }, { newSpendingFileContents, LOCAL_SPENDING_TITLE }] = await Promise.all([import('../../shared/app/browserFileCards'), import('./workbook/presentation/spendingFile')])
    const file = browserFileOf(store, { id: 'spending', name: words.name }, () => ({ contents: newSpendingFileContents(store), title: LOCAL_SPENDING_TITLE }))
    const receipts: ReceiptPorts = {
      qrTextOn,
      keepsOnDrive: () => store.state.choice?.source === 'drive',
      mayKeepNow: canKeepPhotoNow,
      photos: () => receiptPhotos(store.state.choice?.id ?? ''),
      reader: () => {
        const preset = providerInUse()
        return preset === null ? '' : modelOf(preset.id).id
      },
    }
    const ports: SpendingPorts = { receipts, device: { bankSetup: heldBankSetup, lastAccountId, startingAccount, rememberLastAccount, forgetLastAccount } }
    return spendingAssistant(
      {
        status: () => (state.workbook !== null ? 'open' : state.status === 'opening' ? 'opening' : 'none'),
        book: () => state.workbook,
        rates: () => ratesIn(rates.value),
        bankSetup: heldBankSetup,
      },
      { proposer: spendingProposer(store, ports, file), acceptance: spendingAcceptance(store, ports, file) },
    )
  },
  homeCard: SPENDING_HOME_CARD,
  hub: { counts: true, figures: () => homeCardFigures(state, (book) => spendingHubFigures(book, rates.value, today())) },
  assist: SPENDING_ASSIST,
  setUpLines: () => (state.workbook === null ? [] : spendingSetUp(state.workbook)),
  data: spendingData,
  firstRun: () => isFirstRun(state),
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
