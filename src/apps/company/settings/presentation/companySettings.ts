import type { AppSettings, AppSettingsTab } from '../../../../shared/app/appContribution'
import { shownPack } from '../../packs/packContribution'
import SyncCard from '../../sync/presentation/SyncCard.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useSettings } from '../application/useSettings'
import AccountsSettingsTab from './AccountsSettingsTab.vue'
import CategoriesSettingsTab from './CategoriesSettingsTab.vue'
import DataSourceCard from './DataSourceCard.vue'
import GeneralSettingsTab from './GeneralSettingsTab.vue'

const CORE_TABS: readonly AppSettingsTab[] = [
  { value: 'general', label: 'General', icon: 'i-lucide-sliders-horizontal', component: GeneralSettingsTab },
  { value: 'categories', label: 'Categories', icon: 'i-lucide-tags', component: CategoriesSettingsTab },
  { value: 'accounts', label: 'Accounts', icon: 'i-lucide-landmark', component: AccountsSettingsTab },
]

const { state } = useWorkbook()
const settings = useSettings()
const source = () => state.choice?.source ?? state.workbook?.source ?? null

/** The company's parts of Settings: the books' tabs with the pack's, and where the books are on This device. */
export const COMPANY_SETTINGS: AppSettings = {
  // The books' tabs need books on screen. This device's tab is there before any.
  tabs: () => (state.workbook === null ? [] : [...CORE_TABS, ...shownPack(settings.value).settingsTabs]),
  deviceCards: () => [DataSourceCard, ...(source() === 'drive' ? [SyncCard] : [])],
  intro: () =>
    source() === 'browser'
      ? 'How the workbook and this device are set up, and the law behind the figures. Changes are kept in this browser, and an export writes them into the file.'
      : 'How the workbook and this device are set up, and the law behind the figures. A save writes what you changed to the file on Drive, checks it reads back, and offers Undo.',
}
