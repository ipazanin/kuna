import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { bindFiltersToRouter } from './filters/application/filterStore'
import { COMPANY_HOME_CARD } from './home/presentation/companyHomeCard'
import { ONBOARDING_ROUTE } from './onboarding/presentation/useOnboarding'
import { hrDooPack } from './packs/hr-doo/hrDooPack'
import { HR_DOO_TABS } from './packs/hr-doo/infrastructure/hrDooTabs'
import { installPack, shownPack } from './packs/packContribution'
import { useSettings } from './settings/application/useSettings'
import { amountLocaleOf } from './settings/domain/settings'
import { words as analysisWords } from './analysis/presentation/words'
import { words as invoicingWords } from './invoicing/presentation/words'
import { words as onboardingWords } from './onboarding/presentation/words'
import { words as overviewWords } from './overview/presentation/words'
import { words as settingsWords } from './settings/presentation/words'
import { words as transactionWords } from './transactions/presentation/words'
import { companySyncGroup } from './sync/presentation/useSync'
import { words } from './words'
import { useWorkbook } from './workbook/application/workbookStore'
import { reviewCount } from './workbook/domain/needsReview'
import { COMPANY_APP } from './workbook/infrastructure/companyDocument'
import { installPackTabs } from './workbook/infrastructure/packTabs'
import { useGoogleReturn } from './workbook/presentation/useGoogleReturn'
import { COMPANY_MOVED_SCREENS } from './movedScreens'

const CORE_SCREENS: readonly AppScreen[] = [
  { path: '/company', title: overviewWords.title, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') },
  { path: '/company/transactions', title: transactionWords.title, icon: 'i-lucide-list', component: () => import('./transactions/presentation/TransactionsScreen.vue') },
  { path: '/company/invoicing', title: invoicingWords.title, icon: 'i-lucide-receipt-text', component: () => import('./invoicing/presentation/InvoicingScreen.vue') },
  { path: '/company/analysis', title: analysisWords.title, icon: 'i-lucide-chart-bar', component: () => import('./analysis/presentation/AnalysisScreen.vue') },
]

const SETTINGS: AppScreen = { path: '/company/settings', title: settingsWords.title, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useWorkbook()
const settings = useSettings()

/** The company's books, figures and setup, with the Croatian d.o.o. pack installed. */
export const companyApp: AppContribution = {
  id: COMPANY_APP,
  name: words.name,
  colour: '--app-company',
  async install() {
    installPack(hrDooPack)
    installPackTabs(HR_DOO_TABS)
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const [{ seedFakeWorkbook }, { fakeStaffOf }] = await Promise.all([import('./workbook/infrastructure/fake/seedFakeWorkbook'), import('./packs/hr-doo/infrastructure/fake/fakeStaff')])
      await seedFakeWorkbook(new URLSearchParams(window.location.search).get('fake'), fakeStaffOf)
    }
  },
  screens: [
    ...CORE_SCREENS,
    ...hrDooPack.screens,
    SETTINGS,
    { path: ONBOARDING_ROUTE, title: onboardingWords.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/OnboardingScreen.vue'), bare: true },
  ],
  moved: COMPANY_MOVED_SCREENS,
  menu: () => [...CORE_SCREENS, ...shownPack(settings.value).screens],
  settings: SETTINGS,
  // Transactions counts every row that waits for review, whatever the filters, since the queue has no period.
  menuCount: (screen) => (screen.path === '/company/transactions' ? reviewCount(state.workbook?.transactions ?? []) : null),
  subtitle: () => state.workbook?.settings.companyName || null,
  moneyFormat: () => ({ currency: settings.value.currency, locale: amountLocaleOf(settings.value) }),
  homeCard: COMPANY_HOME_CARD,
  // Nothing chosen and nothing kept: onboarding takes it, whatever screen the address names.
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: ONBOARDING_ROUTE,
  syncGroup: companySyncGroup,
  // Written inline so the production build folds it away with the gallery's chunk.
  ...(import.meta.env.DEV || import.meta.env.VITE_FAKE_WORKBOOK === 'true' ? { gallery: async () => (await import('./gallery/CompanyGallery.vue')).default } : {}),
  // Each open of the books on Drive on a device that syncs as it opens fetches the page's one token first.
  asksGoogleOnOpen: () => loadWorkbookChoice(COMPANY_APP)?.source === 'drive' && autoSyncOn.value,
  start(router, googleReturn) {
    const unbindFilters = bindFiltersToRouter(router)
    void useGoogleReturn(googleReturn).then(async (opened) => {
      await router.isReady()
      // A find onboarding left for ends on Overview, as the find step's own tap does.
      if (opened && router.currentRoute.value.path === ONBOARDING_ROUTE) await router.push('/company')
    })
    return unbindFilters
  },
}
