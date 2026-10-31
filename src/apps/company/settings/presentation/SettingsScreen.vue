<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { useRoute } from 'vue-router'

import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import { shownPack } from '../../packs/packContribution'
import CategoryRulesTab from '../../rules/presentation/CategoryRulesTab.vue'
import { CATEGORY_RULES_TAB } from '../../rules/presentation/ruleLinks'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useSettings } from '../application/useSettings'
import AccountsSettingsTab from './AccountsSettingsTab.vue'
import CategoriesSettingsTab from './CategoriesSettingsTab.vue'
import DataSourceCard from './DataSourceCard.vue'
import GeneralSettingsTab from './GeneralSettingsTab.vue'
import { LINKED_SETTINGS_TAB } from './settingsTabs'
import type { SettingsTab } from './settingsTabs'
import { words } from './words'

/** The company's Settings at `#/company/settings`: the books' tabs with the pack's, and Books file, where the books are kept. */
const CORE_TABS: readonly SettingsTab[] = [
  { value: 'general', label: words.tabNames.general, icon: 'i-lucide-sliders-horizontal', component: GeneralSettingsTab },
  { value: 'categories', label: words.tabNames.categories, icon: 'i-lucide-tags', component: CategoriesSettingsTab },
  { value: CATEGORY_RULES_TAB, label: words.tabNames.categoryRules, icon: 'i-lucide-list-ordered', component: CategoryRulesTab },
  { value: 'accounts', label: words.tabNames.accounts, icon: 'i-lucide-landmark', component: AccountsSettingsTab },
]
const BOOKS_TAB = 'books'

const { state } = useWorkbook()
const settings = useSettings()

/** The books' tabs need books on screen, and Books file is there before any. Two tabs with one value would share a `?tab=` link, so they are refused. */
const bookTabs = computed(() => {
  const found = state.workbook === null ? [] : [...CORE_TABS, ...shownPack(settings.value).settingsTabs]
  const values = [...found.map((tab) => tab.value), BOOKS_TAB]
  const repeated = values.find((value, index) => values.indexOf(value) !== index)
  if (repeated !== undefined) {
    throw new Error(`Two tabs of Settings are called ${repeated}.`)
  }
  return found
})
const tabs = computed((): PageTab[] => [...bookTabs.value.map(({ label, value, icon }) => ({ label, value, icon })), { label: words.booksFile, value: BOOKS_TAB, icon: 'i-lucide-hard-drive' }])

const route = useRoute()
const linkedTab = ref(typeof route.query.tab === 'string' ? route.query.tab : null)
provide(LINKED_SETTINGS_TAB, linkedTab)
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />

    <PageTabs :tabs="tabs" :label="words.tabs" data-testid="settings-tabs" @select="linkedTab = null">
      <template v-for="tab in bookTabs" :key="tab.value" #[tab.value]>
        <component :is="tab.component" />
      </template>

      <template #[BOOKS_TAB]>
        <DataSourceCard />
      </template>
    </PageTabs>
  </section>
</template>
