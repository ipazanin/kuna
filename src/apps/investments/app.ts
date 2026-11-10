import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { LOCAL_INVESTMENTS_TITLE } from './workbook/domain/investmentsBooks'
import { isFirstRun } from '../../shared/app/isFirstRun'
import { investmentsData } from './workbook/presentation/investmentsData'
import { DEFAULT_MONEY_FORMAT } from '../../shared/money/moneyFormat'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { INVESTMENTS_HOME_CARD } from './home/presentation/investmentsHomeCard'
import { investmentsHubFigures } from './home/presentation/investmentsHubFigures'
import { shownPortfolio } from './home/presentation/shownPortfolio'
import { INVESTMENTS_OVERVIEW_ROUTE, INVESTMENTS_SETTINGS_ROUTE, INVESTMENTS_START_ROUTE } from './overview/presentation/investmentLinks'
import { HOLDING_ROUTE, HOLDINGS_ROUTE } from './holdings/presentation/holdingLinks'
import { usePortfolio } from './holdings/presentation/usePortfolio'
import { useMailReports } from './mail/presentation/useMailReports'
import { TRANSACTIONS_ROUTE } from './transactions/presentation/transactionLinks'
import { words as transactionWords } from './transactions/presentation/words'
import { words as holdingsWords } from './holdings/presentation/words'
import { investmentsSetUp } from './overview/presentation/investmentsSetUp'
import { words as overviewWords } from './overview/presentation/words'
import { PERFORMANCE_ROUTE } from './performance/presentation/performanceLinks'
import { words as performanceWords } from './performance/presentation/words'
import { words as settingsWords } from './settings/presentation/words'
import { TAX_ROUTE } from './tax/presentation/taxLinks'
import { confirmHistoryComplete, forgetHistoryComplete, useTaxShown } from './tax/presentation/useTaxShown'
import { words as taxWords } from './tax/presentation/words'
import { investmentsSyncGroup } from './sync/presentation/investmentsSyncGroup'
import { words } from './words'
import { useInvestmentsBooks } from './workbook/application/investmentsStore'
import { INVESTMENTS_APP } from './workbook/infrastructure/investmentsDocument'
import { resumeFileLookup } from '../../shared/storage/presentation/resumeFileLookup'
import { words as fileWords } from './workbook/presentation/words'
import { pageRequestCounts, startPrices, usePrices } from './prices/presentation/usePrices'
import type { InvestmentsPorts } from './assistant/operations/investmentsOperations'

const OVERVIEW: AppScreen = { path: INVESTMENTS_OVERVIEW_ROUTE, title: overviewWords.title, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') }
const HOLDINGS: AppScreen = { path: HOLDINGS_ROUTE, title: holdingsWords.title, icon: 'i-lucide-layers', component: () => import('./holdings/presentation/HoldingsScreen.vue') }
const TRANSACTIONS: AppScreen = {
  path: TRANSACTIONS_ROUTE,
  title: transactionWords.title,
  icon: 'i-lucide-arrow-left-right',
  component: () => import('./transactions/presentation/TransactionsScreen.vue'),
}
const PERFORMANCE: AppScreen = {
  path: PERFORMANCE_ROUTE,
  title: performanceWords.title,
  icon: 'i-lucide-chart-spline',
  component: () => import('./performance/presentation/PerformanceScreen.vue'),
}
const TAX: AppScreen = { path: TAX_ROUTE, title: taxWords.title, icon: 'i-lucide-landmark', component: () => import('./tax/presentation/TaxScreen.vue') }
const SETTINGS: AppScreen = { path: INVESTMENTS_SETTINGS_ROUTE, title: settingsWords.title, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useInvestmentsBooks()
const { figures, sources } = usePortfolio()
const taxShown = useTaxShown()

/** The investments kept in a file of their own: every trade, income, deposit, exchange and transfer of the brokers' accounts. */
export const investmentsApp: AppContribution = {
  id: INVESTMENTS_APP,
  name: words.name,
  colour: '--app-investments',
  async install() {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeInvestments } = await import('./workbook/infrastructure/fake/seedFakeInvestments')
      const { registerFakeInvestmentsChat } = await import('./assistant/infrastructure/fake/fakeInvestmentsChat')
      registerFakeInvestmentsChat()
      const query = new URLSearchParams(window.location.search)
      await seedFakeInvestments(query.get('investments'), query.get('prices'), query.get('keys'))
    }
  },
  screens: [
    OVERVIEW,
    HOLDINGS,
    TRANSACTIONS,
    PERFORMANCE,
    TAX,
    { path: HOLDING_ROUTE, needsRecord: true, under: HOLDINGS_ROUTE, title: holdingsWords.holding, icon: 'i-lucide-chart-line', component: () => import('./holdings/presentation/HoldingScreen.vue') },
    SETTINGS,
    { path: INVESTMENTS_START_ROUTE, title: words.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/StartScreen.vue'), bare: true },
  ],
  menu: () => [OVERVIEW, HOLDINGS, TRANSACTIONS, PERFORMANCE, TAX],
  settings: SETTINGS,
  subtitle: () => null,
  // Every figure leaves the app in euros, so it shows them in the language's format.
  moneyFormat: () => DEFAULT_MONEY_FORMAT,
  assistant: async () => {
    const [{ investmentsAssistant }, { investmentsProposer, investmentsAcceptance }, { fetchAddedInBackground }] = await Promise.all([
      import('./assistant/investmentsAssistant'),
      import('./assistant/operations/investmentsOperations'),
      import('./prices/presentation/pricesStep'),
    ])
    const store = useInvestmentsBooks()
    const [{ browserFileOf }, { newInvestmentsFileContents }] = await Promise.all([import('../../shared/app/browserFileCards'), import('./workbook/presentation/investmentsFile')])
    const file = browserFileOf(store, { id: 'investments', name: words.name }, () => ({ contents: newInvestmentsFileContents(store), title: LOCAL_INVESTMENTS_TITLE }))
    const prices = usePrices()
    const { reading } = useMailReports()
    const ports: InvestmentsPorts = {
      rates: () => sources.value?.rates ?? null,
      fetchAddedPrices: () => fetchAddedInBackground(prices),
      prices,
      pricesFile: () => prices.state.copy?.file ?? null,
      mailReport: () => reading.value,
      history: { file: () => state.choice?.id ?? null, given: () => taxShown.value, give: confirmHistoryComplete, takeBack: forgetHistoryComplete },
      requestCounts: pageRequestCounts,
    }
    return investmentsAssistant(
      {
        status: () => (state.workbook !== null ? 'open' : state.status === 'opening' ? 'opening' : 'none'),
        book: () => state.workbook?.book ?? null,
        sources: () => sources.value,
        taxShown: () => taxShown.value,
      },
      { proposer: investmentsProposer(store, ports, file), acceptance: investmentsAcceptance(store, ports, file) },
    )
  },
  homeCard: INVESTMENTS_HOME_CARD,
  hub: { counts: true, figures: () => shownPortfolio(({ figures }) => investmentsHubFigures(figures)) },
  setUpLines: () => (state.workbook === null ? [] : investmentsSetUp(state.workbook.book, figures.value, taxShown.value)),
  data: investmentsData,
  firstRun: () => isFirstRun(state),
  startPath: INVESTMENTS_START_ROUTE,
  syncGroup: investmentsSyncGroup,
  // Written inline so the production build folds it away with the gallery's chunk.
  ...(import.meta.env.DEV || import.meta.env.VITE_FAKE_WORKBOOK === 'true' ? { gallery: async () => (await import('./gallery/InvestmentsGallery.vue')).default } : {}),
  asksGoogleOnOpen: () => loadWorkbookChoice(INVESTMENTS_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Investments file asked Google for. The page's sync resumes a sync.
  // The prices of the file on screen come on screen with it, and a file kept in this browser fetches the day's prices once it is read.
  start(router, googleReturn) {
    const stopPrices = startPrices()
    resumeFileLookup({ store: useInvestmentsBooks(), words: fileWords, startRoute: INVESTMENTS_START_ROUTE, overviewRoute: INVESTMENTS_OVERVIEW_ROUTE }, router, googleReturn)
    return stopPrices
  },
}
