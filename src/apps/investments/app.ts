import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { DEFAULT_MONEY_FORMAT } from '../../shared/money/moneyFormat'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { INVESTMENTS_HOME_CARD } from './home/presentation/investmentsHomeCard'
import { INVESTMENTS_OVERVIEW_ROUTE, INVESTMENTS_SETTINGS_ROUTE, INVESTMENTS_START_ROUTE } from './overview/presentation/investmentLinks'
import { heldHoldings } from './holdings/domain/holdingsList'
import { HOLDING_ROUTE, HOLDINGS_ROUTE } from './holdings/presentation/holdingLinks'
import { usePortfolio } from './holdings/presentation/usePortfolio'
import { transactionCount } from './transactions/domain/listedTransactions'
import { TRANSACTIONS_ROUTE } from './transactions/presentation/transactionLinks'
import { words as transactionWords } from './transactions/presentation/words'
import { words as holdingsWords } from './holdings/presentation/words'
import { words as overviewWords } from './overview/presentation/words'
import { words as settingsWords } from './settings/presentation/words'
import { investmentsSyncGroup } from './sync/presentation/investmentsSyncGroup'
import { words } from './words'
import { useInvestmentsBooks } from './workbook/application/investmentsStore'
import { INVESTMENTS_APP } from './workbook/infrastructure/investmentsDocument'
import { useFindFile } from '../../shared/storage/presentation/useFindFile'
import { words as fileWords } from './workbook/presentation/words'
import { startPrices } from './prices/presentation/usePrices'

const OVERVIEW: AppScreen = { path: INVESTMENTS_OVERVIEW_ROUTE, title: overviewWords.title, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') }
const HOLDINGS: AppScreen = { path: HOLDINGS_ROUTE, title: holdingsWords.title, icon: 'i-lucide-layers', component: () => import('./holdings/presentation/HoldingsScreen.vue') }
const TRANSACTIONS: AppScreen = {
  path: TRANSACTIONS_ROUTE,
  title: transactionWords.title,
  icon: 'i-lucide-arrow-left-right',
  component: () => import('./transactions/presentation/TransactionsScreen.vue'),
}
const SETTINGS: AppScreen = { path: INVESTMENTS_SETTINGS_ROUTE, title: settingsWords.title, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useInvestmentsBooks()
const { figures } = usePortfolio()

/** The investments kept in a file of their own: every trade, income, deposit, exchange and transfer of the brokers' accounts. */
export const investmentsApp: AppContribution = {
  id: INVESTMENTS_APP,
  name: words.name,
  colour: '--app-investments',
  async install() {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeInvestments } = await import('./workbook/infrastructure/fake/seedFakeInvestments')
      const query = new URLSearchParams(window.location.search)
      await seedFakeInvestments(query.get('investments'), query.get('prices'))
    }
  },
  screens: [
    OVERVIEW,
    HOLDINGS,
    TRANSACTIONS,
    { path: HOLDING_ROUTE, title: holdingsWords.holding, icon: 'i-lucide-chart-line', component: () => import('./holdings/presentation/HoldingScreen.vue') },
    SETTINGS,
    { path: INVESTMENTS_START_ROUTE, title: words.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/StartScreen.vue'), bare: true },
  ],
  menu: () => [OVERVIEW, HOLDINGS, TRANSACTIONS],
  settings: SETTINGS,
  menuCount: (screen) => {
    let count = 0
    if (screen === HOLDINGS && figures.value !== null) count = heldHoldings(figures.value).length
    if (screen === TRANSACTIONS && state.workbook !== null) count = transactionCount(state.workbook.book)
    return count === 0 ? null : count
  },
  subtitle: () => null,
  // Every figure leaves the app in euros, so it shows them in the language's format.
  moneyFormat: () => DEFAULT_MONEY_FORMAT,
  homeCard: INVESTMENTS_HOME_CARD,
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: INVESTMENTS_START_ROUTE,
  syncGroup: investmentsSyncGroup,
  asksGoogleOnOpen: () => loadWorkbookChoice(INVESTMENTS_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Investments file asked Google for. The page's sync resumes a sync.
  // The prices of the file on screen come on screen with it, and a file kept in this browser fetches the day's prices once it is read.
  start(router, googleReturn) {
    const stopPrices = startPrices()
    if (googleReturn?.kind === 'granted' && (googleReturn.resume === 'find' || googleReturn.resume === 'pick')) {
      const store = useInvestmentsBooks()
      const findFile = useFindFile(store, fileWords)
      const lookup = googleReturn.resume
      void store.open().then(async () => {
        const opened = await findFile(lookup)
        await router.isReady()
        // A find the first run left for ends on the Overview, as the find step's own tap does.
        if (opened && router.currentRoute.value.path === INVESTMENTS_START_ROUTE) await router.push(INVESTMENTS_OVERVIEW_ROUTE)
      })
    }
    return stopPrices
  },
}
