import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { companyData } from './workbook/presentation/companyData'
import { homeCardFigures } from '../../shared/app/homeCardFigures'
import { isFirstRun } from '../../shared/app/isFirstRun'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { COMPANY_ASSIST } from './assist/presentation/companyAssist'
import { bindFiltersToRouter } from './filters/application/filterStore'
import { COMPANY_HOME_CARD } from './home/presentation/companyHomeCard'
import { companyHubFigures } from './home/presentation/companyHubFigures'
import { ONBOARDING_ROUTE } from './onboarding/presentation/useOnboarding'
import { hrDooPack } from './packs/hr-doo/hrDooPack'
import { HR_DOO_TABS } from './packs/hr-doo/infrastructure/hrDooTabs'
import { installPack, shownPack } from './packs/packContribution'
import { useSettings } from './settings/application/useSettings'
import { moneyFormatOf } from './settings/domain/settings'
import { words as analysisWords } from './analysis/presentation/words'
import { words as invoicingWords } from './invoicing/presentation/words'
import { words as onboardingWords } from './onboarding/presentation/words'
import { words as overviewWords } from './overview/presentation/words'
import { words as settingsWords } from './settings/presentation/words'
import { words as transactionWords } from './transactions/presentation/words'
import { companySyncGroup } from './sync/presentation/useSync'
import { words } from './words'
import { gettingSetUp } from './onboarding/presentation/gettingSetUp'
import { useCategoriesLookRight } from './onboarding/presentation/useCategoriesLookRight'
import { useDeliveryOffer } from './onboarding/presentation/useDeliveryOffer'
import { useWorkbook } from './workbook/application/workbookStore'
import { reviewCount } from './workbook/domain/needsReview'
import { COMPANY_APP } from './workbook/infrastructure/companyDocument'
import { installPackTabs } from './workbook/infrastructure/packTabs'
import { useGoogleReturn } from './workbook/presentation/useGoogleReturn'
import { REVIEW_LINK } from './transactions/presentation/transactionsLinks'

const CORE_SCREENS: readonly AppScreen[] = [
  { path: '/company', title: overviewWords.title, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') },
  { path: '/company/transactions', title: transactionWords.title, icon: 'i-lucide-list', component: () => import('./transactions/presentation/TransactionsScreen.vue') },
  { path: '/company/invoicing', title: invoicingWords.title, icon: 'i-lucide-receipt-text', component: () => import('./invoicing/presentation/InvoicingScreen.vue') },
  { path: '/company/analysis', title: analysisWords.title, icon: 'i-lucide-chart-bar', component: () => import('./analysis/presentation/AnalysisScreen.vue') },
]

const SETTINGS: AppScreen = { path: '/company/settings', title: settingsWords.title, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useWorkbook()
const { lookRight: categoriesLookRight } = useCategoriesLookRight()
const { offered: deliveryOffered } = useDeliveryOffer()
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
      const [{ seedFakeWorkbook }, { fakeStaffOf }, { registerFakeSuggestions }, { registerFakeExplanation }] = await Promise.all([
        import('./workbook/infrastructure/fake/seedFakeWorkbook'),
        import('./packs/hr-doo/infrastructure/fake/fakeStaff'),
        import('./assist/infrastructure/fake/fakeSuggestions'),
        import('./packs/hr-doo/assist/infrastructure/fake/fakeExplanation'),
      ])
      await seedFakeWorkbook(new URLSearchParams(window.location.search).get('fake'), fakeStaffOf)
      registerFakeSuggestions()
      registerFakeExplanation()
    }
  },
  screens: [
    ...CORE_SCREENS,
    ...hrDooPack.screens,
    SETTINGS,
    { path: ONBOARDING_ROUTE, title: onboardingWords.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/OnboardingScreen.vue'), bare: true },
  ],
  menu: () => [...CORE_SCREENS, ...shownPack(settings.value).screens],
  settings: SETTINGS,
  // Transactions counts every row that waits for review, whatever the filters, since the queue has no period.
  menuCount: (screen) => {
    const count = screen.path === '/company/transactions' ? reviewCount(state.workbook?.transactions ?? []) : 0
    return count === 0 ? null : { count, opens: REVIEW_LINK }
  },
  subtitle: () => state.workbook?.settings.companyName || null,
  moneyFormat: () => moneyFormatOf(settings.value),
  homeCard: COMPANY_HOME_CARD,
  hub: { counts: false, figures: () => homeCardFigures(state, companyHubFigures) },
  assist: COMPANY_ASSIST,
  assistant: async () => {
    const [{ companyAssistant }, { HR_DOO_ASSISTANT }] = await Promise.all([import('./assistant/companyAssistant'), import('./packs/hr-doo/assistant/hrDooAssistant')])
    return companyAssistant(HR_DOO_ASSISTANT)
  },
  // Nothing chosen and nothing kept: onboarding takes it, whatever screen the address names.
  setUpLines: () => (state.workbook === null ? [] : gettingSetUp(state.workbook, categoriesLookRight.value, deliveryOffered.value)),
  data: companyData,
  firstRun: () => isFirstRun(state),
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
