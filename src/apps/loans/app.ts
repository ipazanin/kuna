import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { DEFAULT_MONEY_FORMAT } from '../../shared/money/moneyFormat'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { words as bankLoanWords } from './bankLoans/presentation/words'
import { LOANS_HOME_CARD } from './home/presentation/loansHomeCard'
import { words as informalLoanWords } from './informalLoans/presentation/words'
import { BANK_LOAN_ROUTE, INFORMAL_LOAN_ROUTE, LOANS_OVERVIEW_ROUTE, LOANS_START_ROUTE, SCENARIOS_ROUTE } from './overview/presentation/loanLinks'
import { words as overviewWords } from './overview/presentation/words'
import { words as scenarioWords } from './scenarios/presentation/words'
import { words as settingsWords } from './settings/presentation/words'
import { loansSyncGroup } from './sync/presentation/loansSyncGroup'
import { words } from './words'
import { useLoansBooks } from './workbook/application/loansStore'
import { LOANS_APP } from './workbook/infrastructure/loansDocument'
import { useFindFile } from '../../shared/storage/presentation/useFindFile'
import { words as fileWords } from './workbook/presentation/words'

const OVERVIEW: AppScreen = { path: LOANS_OVERVIEW_ROUTE, title: overviewWords.title, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') }
const SCENARIOS: AppScreen = { path: SCENARIOS_ROUTE, title: scenarioWords.title, icon: 'i-lucide-scale', component: () => import('./scenarios/presentation/ScenariosScreen.vue') }
const SETTINGS: AppScreen = { path: '/loans/settings', title: settingsWords.title, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useLoansBooks()

/** The loans kept in a file of their own beside the company's books: bank loans with the plan their terms give, and informal loans between people. */
export const loansApp: AppContribution = {
  id: LOANS_APP,
  name: words.name,
  colour: '--app-loans',
  async install() {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeLoans } = await import('./workbook/infrastructure/fake/seedFakeLoans')
      await seedFakeLoans(new URLSearchParams(window.location.search).get('loans'))
    }
  },
  screens: [
    OVERVIEW,
    SCENARIOS,
    { path: BANK_LOAN_ROUTE, title: bankLoanWords.bankLoan, icon: 'i-lucide-landmark', component: () => import('./bankLoans/presentation/BankLoanScreen.vue') },
    { path: INFORMAL_LOAN_ROUTE, title: informalLoanWords.informalLoan, icon: 'i-lucide-handshake', component: () => import('./informalLoans/presentation/InformalLoanScreen.vue') },
    SETTINGS,
    { path: LOANS_START_ROUTE, title: words.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/StartScreen.vue'), bare: true },
  ],
  menu: () => [OVERVIEW, SCENARIOS],
  settings: SETTINGS,
  menuCount: () => null,
  subtitle: () => null,
  // Until Loans has settings of its own, it shows euros in the language's format.
  moneyFormat: () => DEFAULT_MONEY_FORMAT,
  homeCard: LOANS_HOME_CARD,
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: LOANS_START_ROUTE,
  syncGroup: loansSyncGroup,
  asksGoogleOnOpen: () => loadWorkbookChoice(LOANS_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Loans file asked Google for. The page's sync resumes a sync.
  start(router, googleReturn) {
    if (googleReturn?.kind === 'granted' && (googleReturn.resume === 'find' || googleReturn.resume === 'pick')) {
      const store = useLoansBooks()
      const findFile = useFindFile(store, fileWords)
      const lookup = googleReturn.resume
      void store.open().then(async () => {
        const opened = await findFile(lookup)
        await router.isReady()
        // A find the first run left for ends on the Overview, as the find step's own tap does.
        if (opened && router.currentRoute.value.path === LOANS_START_ROUTE) await router.push('/loans')
      })
    }
    return () => {}
  },
}
