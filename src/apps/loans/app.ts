import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { DEFAULT_MONEY_FORMAT } from '../../shared/money/moneyFormat'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { LOANS_START_ROUTE } from './onboarding/presentation/useLoansStart'
import { BANK_LOAN_ROUTE, INFORMAL_LOAN_ROUTE, LOANS_OVERVIEW_ROUTE } from './overview/presentation/loanLinks'
import { loansSyncGroup } from './sync/presentation/loansSyncGroup'
import { useLoansBooks } from './workbook/application/loansStore'
import { LOANS_APP } from './workbook/infrastructure/loansDocument'
import { useFindLoansFile } from './workbook/presentation/useFindLoansFile'

const OVERVIEW: AppScreen = { path: LOANS_OVERVIEW_ROUTE, title: 'Overview', icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') }

const { state } = useLoansBooks()

/** The loans kept in a file of their own beside the company's books: bank loans with the plan their terms give, and informal loans between people. */
export const loansApp: AppContribution = {
  id: LOANS_APP,
  name: 'Loans',
  async install() {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeLoans } = await import('./workbook/infrastructure/fake/seedFakeLoans')
      await seedFakeLoans(new URLSearchParams(window.location.search).get('loans'))
    }
  },
  screens: [
    OVERVIEW,
    { path: BANK_LOAN_ROUTE, title: 'Bank loan', icon: 'i-lucide-landmark', component: () => import('./bankLoans/presentation/BankLoanScreen.vue') },
    { path: INFORMAL_LOAN_ROUTE, title: 'Informal loan', icon: 'i-lucide-handshake', component: () => import('./informalLoans/presentation/InformalLoanScreen.vue') },
    { path: LOANS_START_ROUTE, title: 'Start', icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/StartScreen.vue'), bare: true },
  ],
  menu: () => [OVERVIEW],
  menuCount: () => null,
  subtitle: () => null,
  // Until Loans has settings of its own, it shows euros in the language's format.
  moneyFormat: () => DEFAULT_MONEY_FORMAT,
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: LOANS_START_ROUTE,
  syncGroup: loansSyncGroup,
  settings: async () => (await import('./settings/presentation/loansSettings')).LOANS_SETTINGS,
  asksGoogleOnOpen: () => loadWorkbookChoice(LOANS_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Loans file asked Google for. The page's sync resumes a sync.
  start(router, googleReturn) {
    if (googleReturn?.kind === 'granted' && (googleReturn.resume === 'find' || googleReturn.resume === 'pick')) {
      const store = useLoansBooks()
      const findLoansFile = useFindLoansFile()
      const lookup = googleReturn.resume
      void store.open().then(async () => {
        const opened = await findLoansFile(lookup)
        await router.isReady()
        // A find the first run left for ends on the Overview, as the find step's own tap does.
        if (opened && router.currentRoute.value.path === LOANS_START_ROUTE) await router.push('/loans')
      })
    }
    return () => {}
  },
}
