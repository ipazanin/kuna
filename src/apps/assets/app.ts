import type { AppContribution, AppScreen } from '../../shared/app/appContribution'
import { homeCardFigures } from '../../shared/app/homeCardFigures'
import { today } from '../../shared/calendar/civilDate'
import { DEFAULT_MONEY_FORMAT } from '../../shared/money/moneyFormat'
import { loadWorkbookChoice } from '../../shared/storage/infrastructure/workbookChoice'
import { resumeFileLookup } from '../../shared/storage/presentation/resumeFileLookup'
import { autoSyncOn } from '../../shared/sync/infrastructure/autoSyncSwitch'
import { words as assetWords } from './asset/presentation/words'
import { ASSETS_HOME_CARD } from './home/presentation/assetsHomeCard'
import { assetsHubFigures } from './home/presentation/assetsHubFigures'
import { startHouseIndex, useHouseIndex } from './houseIndex/presentation/useHouseIndex'
import { assetLoans } from './loans/application/assetLoans'
import { ASSET_ROUTE, ASSETS_OVERVIEW_ROUTE, ASSETS_SETTINGS_ROUTE, ASSETS_START_ROUTE } from './overview/presentation/assetLinks'
import { assetsSetUp } from './overview/presentation/assetsSetUp'
import { words as overviewWords } from './overview/presentation/words'
import { words as settingsWords } from './settings/presentation/words'
import { assetsSyncGroup } from './sync/presentation/assetsSyncGroup'
import { words } from './words'
import { useAssetsBooks } from './workbook/application/assetsStore'
import { ASSETS_APP } from './workbook/infrastructure/assetsDocument'
import { words as fileWords } from './workbook/presentation/words'

const OVERVIEW: AppScreen = { path: ASSETS_OVERVIEW_ROUTE, title: overviewWords.title, icon: 'i-lucide-layout-dashboard', component: () => import('./overview/presentation/OverviewScreen.vue') }
const SETTINGS: AppScreen = { path: ASSETS_SETTINGS_ROUTE, title: settingsWords.title, icon: 'i-lucide-settings', component: () => import('./settings/presentation/SettingsScreen.vue') }

const { state } = useAssetsBooks()
const index = useHouseIndex()

/** What you own, kept in a file of its own: each asset with its valuations, the flat carried by the house price index and the car by the customs table. */
export const assetsApp: AppContribution = {
  id: ASSETS_APP,
  name: words.name,
  colour: '--app-assets',
  async install() {
    // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
    if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
      const { seedFakeAssets } = await import('./workbook/infrastructure/fake/seedFakeAssets')
      await seedFakeAssets(new URLSearchParams(window.location.search).get('assets'))
    }
  },
  screens: [
    OVERVIEW,
    { path: ASSET_ROUTE, title: assetWords.asset, icon: 'i-lucide-house', component: () => import('./asset/presentation/AssetScreen.vue') },
    SETTINGS,
    { path: ASSETS_START_ROUTE, title: words.start, icon: 'i-lucide-door-open', component: () => import('./onboarding/presentation/StartScreen.vue'), bare: true },
  ],
  menu: () => [OVERVIEW],
  settings: SETTINGS,
  menuCount: () => null,
  subtitle: () => null,
  // Every figure is in euros, so it shows them in the language's format.
  moneyFormat: () => DEFAULT_MONEY_FORMAT,
  homeCard: ASSETS_HOME_CARD,
  hub: { counts: true, figures: () => homeCardFigures(state, (book) => assetsHubFigures(book, today(), index.value, assetLoans(today()))) },
  setUpLines: () => (state.workbook === null ? [] : assetsSetUp(state.workbook)),
  firstRun: () => state.status !== 'opening' && state.choice === null && state.workbook === null,
  startPath: ASSETS_START_ROUTE,
  setUpOrder: { after: 'loans', why: words.setUpAfterLoans },
  syncGroup: assetsSyncGroup,
  asksGoogleOnOpen: () => loadWorkbookChoice(ASSETS_APP)?.source === 'drive' && autoSyncOn.value,
  // The shell hands over only a find or a pick the Assets file asked Google for. The page's sync resumes a sync.
  start(router, googleReturn) {
    const stopIndex = startHouseIndex()
    resumeFileLookup({ store: useAssetsBooks(), words: fileWords, startRoute: ASSETS_START_ROUTE, overviewRoute: ASSETS_OVERVIEW_ROUTE }, router, googleReturn)
    return stopIndex
  },
}
