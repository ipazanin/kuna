import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { bindFiltersToRouter } from './filters/application/filterStore'
import { ONBOARDING_ROUTE } from './onboarding/presentation/useOnboarding'
import { hrDooPack } from './packs/hr-doo/hrDooPack'
import { HR_DOO_TABS } from './packs/hr-doo/infrastructure/hrDooTabs'
import { installPack, shownPack } from './packs/packContribution'
import { useSettings } from './settings/application/useSettings'
import { amountLocaleOf } from './settings/domain/settings'
import { companySyncGroup } from './sync/presentation/useSync'
import { useWorkbook } from './workbook/application/workbookStore'
import { needsReview } from './workbook/domain/needsReview'
import { COMPANY_APP } from './workbook/infrastructure/companyDocument'
import { installPackTabs } from './workbook/infrastructure/packTabs'
import { useGoogleReturn } from './workbook/presentation/useGoogleReturn'

const CORE_SCREENS: readonly AppScreen[] = [
  { path: '/company', title: 'Overview', icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') },
  { path: '/company/transactions', title: 'Transactions', icon: 'i-lucide-list', component: () => import('./transactions/presentation/TransactionsScreen.vue') },
  { path: '/company/review', title: 'Review', icon: 'i-lucide-inbox', component: () => import('./review/presentation/ReviewScreen.vue') },
  { path: '/company/invoicing', title: 'Invoicing', icon: 'i-lucide-receipt-text', component: () => import('./invoicing/presentation/InvoicingScreen.vue') },
  { path: '/company/analysis', title: 'Analysis', icon: 'i-lucide-chart-bar', component: () => import('./analysis/presentation/AnalysisScreen.vue') },
]

const { state } = useWorkbook()
const settings = useSettings()

/** The company's books, figures and setup, with the Croatian d.o.o. pack installed. */
export const companyApp: AppContribution = {
  id: COMPANY_APP,
  name: 'Company',
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
    { path: ONBOARDING_ROUTE, title: 'Start', icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/OnboardingScreen.vue'), bare: true },
  ],
  menu: () => [...CORE_SCREENS, ...shownPack(settings.value).screens],
  // Review counts every row that waits, whatever the filters, since the queue has no period.
  menuCount: (screen) => (screen.path === '/company/review' ? (state.workbook?.transactions.filter(needsReview).length ?? 0) : null),
  subtitle: () => state.workbook?.settings.companyName || null,
  moneyFormat: () => ({ currency: settings.value.currency, locale: amountLocaleOf(settings.value) }),
  // Nothing chosen and nothing kept: onboarding takes it, whatever screen the address names.
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: ONBOARDING_ROUTE,
  syncGroup: companySyncGroup,
  // Written inline so the production build folds it away with the gallery's chunk.
  ...(import.meta.env.DEV || import.meta.env.VITE_FAKE_WORKBOOK === 'true' ? { gallery: async () => (await import('./gallery/CompanyGallery.vue')).default } : {}),
  settings: async () => (await import('./settings/presentation/companySettings')).COMPANY_SETTINGS,
  // Each open of the books on Drive on a device that syncs as it opens fetches the page's one token first.
  asksGoogleOnOpen: () => loadWorkbookChoice(COMPANY_APP)?.source === 'drive' && autoSyncOn.value,
  start(router, googleReturn) {
    const unbindFilters = bindFiltersToRouter(router)
    useGoogleReturn(googleReturn)
    return unbindFilters
  },
}
