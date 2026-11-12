import { anonymisingNow } from '../../shared/ai/presentation/aiProvider'
import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { companyData } from './workbook/presentation/companyData'
import { homeCardFigures } from '../../shared/app/homeCardFigures'
import { isFirstRun } from '../../shared/app/isFirstRun'
import { forgetSetUpAnswer, hasSetUpAnswer, keepSetUpAnswer } from '../../shared/app/setUpAnswer'
import { tokenFor } from '../../shared/google/googleAuth'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { bindFiltersToRouter } from './filters/application/filterStore'
import { COMPANY_HOME_CARD } from './home/presentation/companyHomeCard'
import { companyHubFigures } from './home/presentation/companyHubFigures'
import { ONBOARDING_ROUTE } from './onboarding/presentation/useOnboarding'
import { hrDooPack } from './packs/hr-doo/hrDooPack'
import { HR_DOO_TABS } from './packs/hr-doo/infrastructure/hrDooTabs'
import { installPack, installedPack, shownPack } from './packs/packContribution'
import { useSettings } from './settings/application/useSettings'
import { moneyFormatOf } from './settings/domain/settings'
import { words as analysisWords } from './analysis/presentation/words'
import { mailDraftsOn, switchMailDrafts } from './invoicing/infrastructure/mailDraftSwitch'
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
import { COMPANY_APP } from './workbook/domain/companyApp'
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
      const [{ seedFakeWorkbook }, { fakeStaffOf }, { registerFakeCompanyChat }, { registerFakeTripChat }] = await Promise.all([
        import('./workbook/infrastructure/fake/seedFakeWorkbook'),
        import('./packs/hr-doo/infrastructure/fake/fakeStaff'),
        import('./assistant/infrastructure/fake/fakeCompanyChat'),
        import('./packs/hr-doo/assistant/infrastructure/fake/fakeTripChat'),
      ])
      await seedFakeWorkbook(new URLSearchParams(window.location.search).get('fake'), fakeStaffOf)
      registerFakeCompanyChat()
      registerFakeTripChat()
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
  assistant: async () => {
    const [{ companyAssistant }, { HR_DOO_ASSISTANT }, { companyProposer, companyAcceptance }, { hrDooOperations }, { useStatementSync }, { gmailForDrafts }] = await Promise.all([
      import('./assistant/companyAssistant'),
      import('./packs/hr-doo/assistant/hrDooAssistant'),
      import('./assistant/operations/companyOperations'),
      import('./packs/hr-doo/assistant/operations/packOperations'),
      import('./imports/presentation/useStatementSync'),
      import('./invoicing/application/invoiceGoogle'),
    ])
    const store = useWorkbook()
    const [{ browserFileOf }, { newCompanyBooks }] = await Promise.all([import('../../shared/app/browserFileCards'), import('./workbook/presentation/workbookFiles')])
    const file = browserFileOf(store, { id: 'company', name: words.name }, newCompanyBooks)
    const statementSync = useStatementSync()
    const ports = {
      heldStatements: () => statementSync.state.outcome?.held ?? [],
      // The answers are kept per file on this device, as the set-up card keeps them, so with no file open none is given.
      setUpAnswers: {
        given: (answer: string) => state.choice !== null && hasSetUpAnswer(state.choice.id, answer),
        give: (answer: string) => {
          if (state.choice !== null) keepSetUpAnswer(state.choice.id, answer)
        },
        takeBack: (answer: string) => {
          if (state.choice !== null) forgetSetUpAnswer(state.choice.id, answer)
        },
      },
      mailDrafts: {
        on: () => mailDraftsOn.value,
        switchTo: switchMailDrafts,
        gmail: () => gmailForDrafts(state.workbook?.source === 'drive'),
        askGmail: () => tokenFor('gmail.compose', null),
      },
      pack: hrDooOperations(anonymisingNow),
    }
    return companyAssistant(
      HR_DOO_ASSISTANT,
      {
        status: () => (state.workbook !== null ? 'open' : state.status === 'opening' ? 'opening' : 'none'),
        workbook: () => state.workbook,
        records: () => state.records,
      },
      () => [...(state.records === null ? [] : installedPack().employees(state.records)), ...(state.workbook?.settings.personPayees ?? []).map((name) => ({ name, employee: false, ibans: [] }))],
      { proposer: companyProposer(store, ports, file), acceptance: companyAcceptance(store, ports, file) },
    )
  },
  // Nothing chosen and nothing kept: onboarding takes it, whatever screen the address names.
  setUpLines: () => (state.workbook === null ? [] : gettingSetUp(state.workbook, categoriesLookRight.value, deliveryOffered.value)),
  data: companyData,
  firstRun: () => isFirstRun(state),
  startPath: ONBOARDING_ROUTE,
  syncGroup: companySyncGroup,
  ratesDemand: () => (state.workbook === null ? null : installedPack().ratesDemand(state.workbook)),
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
