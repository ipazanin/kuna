import type { AppSettings, AppSettingsTab } from '../../../../shared/app/appContribution'
import { shownPack } from '../../packs/packContribution'
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

/** The company's parts of Settings: the books' tabs with the pack's, and where the books are on This device. */
export const COMPANY_SETTINGS: AppSettings = {
  // The books' tabs need books on screen. This device's tab is there before any.
  tabs: () => (state.workbook === null ? [] : [...CORE_TABS, ...shownPack(settings.value).settingsTabs]),
  deviceCards: () => [DataSourceCard],
}
