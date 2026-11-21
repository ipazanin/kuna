import { noteBankReturn, openBankSyncAfterReturn } from './bankSync/presentation/bankReturnOnOpen'
import { spendingData } from './workbook/presentation/spendingData'
import { SPENDING_HOME_CARD } from './home/presentation/spendingHomeCard'
import { spendingHubFigures } from './home/presentation/spendingHubFigures'
import {
  SPENDING_ACCOUNT_ROUTE,
  SPENDING_ACCOUNTS_ROUTE,
  SPENDING_ANALYSIS_ROUTE,
  SPENDING_BUDGETS_ROUTE,
  SPENDING_EVENTS_ROUTE,
  SPENDING_OVERVIEW_ROUTE,
  SPENDING_PAYEES_ROUTE,
  SPENDING_REVIEW_LINK,
  SPENDING_SETTINGS_ROUTE,
  SPENDING_SORTING_ROUTE,
  SPENDING_START_ROUTE,
  SPENDING_TRANSACTIONS_ROUTE,
} from './overview/presentation/spendingLinks'
import { rowLinksOf } from './facts'
import { SPENDING_MOVED_SCREENS } from './movedScreens'
import { toReviewCount } from './links/application/linkReview'
import { sourceOf, targetsOf } from './links/application/linkTargets'
import { companyTargets, readMoneyWithOwnerThrough } from './links/application/companyTargets'
import { loanTargets, readLoanTargetsThrough } from './links/application/loanRecords'
import { investmentTargets, readCashMovementsThrough } from './links/application/investmentTargets'
import { readAssetsThrough, ruleAssets } from './links/application/assetTargets'
import { companyOib, oibToMatch } from './company/application/companyFacts'
import { spendingSetUp } from './overview/presentation/spendingSetUp'
import { ratesNeeded } from './rates/domain/ratesNeeded'
import { useRates } from '../../shared/rates/application/pageRates'
import { everydayRates } from '../../shared/rates/domain/ratesState'
import { words as screenWords } from './screenWords'
import type { ReceiptPorts } from './assistant/operations/receiptOperation'
import type { SpendingPorts } from './assistant/operations/spendingOperations'
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
const SORTING: AppScreen = { path: SPENDING_SORTING_ROUTE, title: screenWords.sorting, icon: 'i-lucide-tags', component: () => import('./sorting/presentation/SortingScreen.vue') }
const EVENTS: AppScreen = { path: SPENDING_EVENTS_ROUTE, title: screenWords.events, icon: 'i-lucide-calendar-range', component: () => import('./events/presentation/EventsScreen.vue') }
const PAYEES: AppScreen = { path: SPENDING_PAYEES_ROUTE, title: screenWords.payees, icon: 'i-lucide-users-round', component: () => import('./payees/presentation/PayeesScreen.vue') }
const ANALYSIS: AppScreen = { path: SPENDING_ANALYSIS_ROUTE, title: screenWords.analysis, icon: 'i-lucide-chart-bar', component: () => import('./analytics/presentation/AnalysisScreen.vue') }
const ACCOUNTS: AppScreen = { path: SPENDING_ACCOUNTS_ROUTE, title: screenWords.accounts, icon: 'i-lucide-landmark', component: () => import('./accounts/presentation/AccountsScreen.vue') }
const SETTINGS: AppScreen = { path: SPENDING_SETTINGS_ROUTE, title: screenWords.settings, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useSpendingBooks()
const rates = useRates()

/** Your own accounts, kept in a file of their own: what comes in and goes out of each, by category, against monthly limits. */
export const spendingApp: AppContribution = {
  id: SPENDING_APP,
  name: words.name,
  colour: '--app-spending',
  async install(shell) {
    noteBankReturn()
    readMoneyWithOwnerThrough(() => shell.moneyWithOwner())
    readLoanTargetsThrough(() => shell.loanTargets())
    readCashMovementsThrough(() => shell.cashMovements())
    readAssetsThrough(() => shell.assets())
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeSpending } = await import('./workbook/infrastructure/fake/seedFakeSpending')
      const { fakeSpendingDayHere } = await import('./workbook/infrastructure/fake/fakeSpending')
      const { saveLastFetch } = await import('./bankSync/infrastructure/bankBrowserState')
      const { registerFakeSpendingChat } = await import('./assistant/infrastructure/fake/fakeSpendingChat')
      saveLastFetch(null)
      registerFakeSpendingChat()
      const query = new URLSearchParams(window.location.search)
      await seedFakeSpending(query.get('spending'), query.get('banksync'), fakeSpendingDayHere())
    }
    // The real books of `npm run dev:real`, inline for the same reason.
    if (import.meta.env.DEV && import.meta.env.VITE_REAL_BOOKS === 'true') {
      const { seedRealBook } = await import('../../shared/storage/infrastructure/real/realBooks')
      await seedRealBook(SPENDING_APP)
    }
  },
  screens: [
    OVERVIEW,
    TRANSACTIONS,
    BUDGETS,
    SORTING,
    EVENTS,
    PAYEES,
    ANALYSIS,
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
  moved: SPENDING_MOVED_SCREENS,
  menu: () => [OVERVIEW, TRANSACTIONS, BUDGETS, SORTING, EVENTS, PAYEES, ANALYSIS, ACCOUNTS],
  settings: SETTINGS,
  menuCount: (screen) => {
    const count = screen.path === SPENDING_TRANSACTIONS_ROUTE && state.workbook !== null ? toReviewCount(state.workbook, today()) : 0
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
      companyOib: () => oibToMatch(companyOib()),
    }
    const ports: SpendingPorts = {
      receipts,
      device: { bankSetup: heldBankSetup, lastAccountId, startingAccount, rememberLastAccount, forgetLastAccount },
      linkTargets: targetsOf,
      linkSource: sourceOf,
      loanTargets,
      companyPayments: () => companyTargets().flatMap(({ targets }) => (targets === null || typeof targets === 'string' ? [] : targets)),
      cashMovements: () => investmentTargets().flatMap(({ targets }) => (targets === null || typeof targets === 'string' ? [] : targets)),
      assets: ruleAssets,
    }
    return spendingAssistant(
      {
        status: () => (state.workbook !== null ? 'open' : state.status === 'opening' ? 'opening' : 'none'),
        book: () => state.workbook,
        rates: () => everydayRates(rates.value),
        bankSetup: heldBankSetup,
        qrTextOn,
        linkTargets: targetsOf,
        linkSource: sourceOf,
      },
      { proposer: spendingProposer(store, ports, file), acceptance: spendingAcceptance(store, ports, file) },
    )
  },
  homeCard: SPENDING_HOME_CARD,
  hub: { counts: true, figures: () => homeCardFigures(state, (book) => spendingHubFigures(book, rates.value, today())) },
  rowLinks: () => homeCardFigures(state, (book) => rowLinksOf(book, everydayRates(rates.value))),
  setUpLines: () => (state.workbook === null ? [] : spendingSetUp(state.workbook)),
  data: spendingData,
  firstRun: () => isFirstRun(state),
  startPath: SPENDING_START_ROUTE,
  syncGroup: spendingSyncGroup,
  ratesDemand: () => (state.workbook === null ? null : ratesNeeded(state.workbook)),
  asksGoogleOnOpen: () => loadWorkbookChoice(SPENDING_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Spending file asked Google for. The page's sync resumes a sync.
  start(router, googleReturn) {
    openBankSyncAfterReturn(router)
    resumeFileLookup({ store: useSpendingBooks(), words: fileWords, startRoute: SPENDING_START_ROUTE, overviewRoute: SPENDING_OVERVIEW_ROUTE }, router, googleReturn)
    return () => {}
  },
}
