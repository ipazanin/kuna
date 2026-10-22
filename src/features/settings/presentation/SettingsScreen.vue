<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import AppCard from '../../../shared/ui/AppCard.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../shared/ui/PageTabs.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import { shownPack } from '../../packs/packContribution'
import { presentedWorkbook } from '../../transactions/application/presentedWorkbook'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { RowTab } from '../../workbook/application/workbookWriter'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { ACCOUNT_ROWS, CATEGORY_ROWS, accountUses, categoryUses } from '../application/workbookTabRows'
import type { RowsOf } from '../application/workbookTabRows'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import DevicePanel from './DevicePanel.vue'
import GeneralSettingsForm from './GeneralSettingsForm.vue'
import { useSettingsSave } from './useSettingsSave'

const { state } = useWorkbook()
const route = useRoute()
const { settings, saving: savingSettings, save: saveSettings } = useSettingsSave()
const pack = computed(() => shownPack(settings.value))

/** The workbook's tabs need a workbook on screen. This device's tab is there before one is. */
const tabs = computed((): PageTab[] => [
  ...(state.workbook === null
    ? []
    : [
        { label: 'General', value: 'general', icon: 'i-lucide-sliders-horizontal' },
        { label: 'Categories', value: 'categories', icon: 'i-lucide-tags' },
        { label: 'Accounts', value: 'accounts', icon: 'i-lucide-landmark' },
        ...pack.value.settingsTabs.map(({ label, value, icon }) => ({ label, value, icon })),
      ]),
  { label: 'This device', value: 'device', icon: 'i-lucide-monitor-smartphone' },
])

/** The tab a link from another screen opened. Its card opens even when this device keeps it collapsed, until another tab is picked. */
const linkedTab = ref(typeof route.query.tab === 'string' ? route.query.tab : null)

const source = computed(() => state.choice?.source ?? state.workbook?.source ?? null)

const rowsOfSnapshot: RowsOf = (tab) => state.snapshot?.[tab] ?? []
const categoriesInUse = computed(() => categoryUses(rowsOfSnapshot))
const accountsInUse = computed(() => accountUses(rowsOfSnapshot))
/** The reader's problems and the splits the figures leave out, such as one of a row an asset claims. */
const problems = computed(() => (state.workbook === null ? [] : presentedWorkbook(state.workbook).problems))

const rowWrites = {
  categories: useRowWrites(CATEGORY_ROWS),
  accounts: useRowWrites(ACCOUNT_ROWS),
}

type RowSection = keyof typeof rowWrites

const TITLES: Readonly<Record<RowSection, string>> = {
  categories: 'Categories',
  accounts: 'Accounts',
}

function sheetLacks(tab: RowTab): boolean {
  return source.value === 'google' && (state.snapshot?.meta.missingTabs.includes(tab) ?? false)
}

function rowsInWords(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function columnsOf(tab: RowTab): string {
  return TEMPLATE_COLUMNS[tab].map((column) => column.name).join(', ')
}

function saving(tab: RowSection): boolean {
  return rowWrites[tab].busy.value || state.writing
}

function saveRows(tab: RowSection, change: TabRowsChange): void {
  void rowWrites[tab].write(change, { title: `${TITLES[tab]} saved` }, 'Not saved')
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader
      title="Settings"
      :description="
        source === 'excel'
          ? 'How the workbook and this device are set up, and the law behind the figures. Changes are kept in this browser, and an export writes them into the file.'
          : 'How the workbook and this device are set up, and the law behind the figures. A save writes only the cells you changed to the Sheet, checks they read back, and offers Undo.'
      "
    />

    <PageTabs :tabs="tabs" label="Parts of the settings" data-testid="settings-tabs" @select="linkedTab = null">
      <template #general>
        <div v-if="state.workbook" class="flex flex-col gap-6">
          <GeneralSettingsForm :settings="settings" :saving="savingSettings || state.writing" @save="saveSettings" />
          <component :is="card" v-for="(card, index) in pack.settingsCards" :key="index" />
          <AppCard
            title="Rows the app could not use as written"
            :subtitle="problems.length > 0 ? 'Each is left out, or read with its default, until it is fixed in the workbook.' : undefined"
            collapse-id="settings.problems"
            :start-collapsed="problems.length === 0"
            :reveal="problems.length > 0"
            :summary="problems.length > 0 ? rowsInWords(problems.length, 'row', 'rows') : 'None, every row reads as written'"
          >
            <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
              <ProblemList v-if="problems.length > 0" :problems="problems" />
              <p v-else class="text-sm text-muted">Every row of the workbook reads as written.</p>
            </div>
          </AppCard>
        </div>
      </template>

      <template #categories>
        <AppCard
          title="Categories"
          collapse-id="settings.categories"
          :summary="rowsInWords(state.snapshot?.categories.length ?? 0, 'category', 'categories')"
          :reveal="linkedTab === 'categories'"
        >
          <template #subtitle>
            The bucket decides where a row counts. Each category once, with category, family and bucket filled. A category in use keeps its name and its
            row.
            <span v-if="source === 'google'" class="mt-1 block" data-testid="dropdown-note">The ledger's category dropdown in the Sheet lists this tab's categories.</span>
            <span v-if="sheetLacks('categories')" class="mt-2 block text-toned">
              The Sheet has no categories tab yet. Add one named categories with these headers in row 1, then sync:
              <span class="identifier">{{ columnsOf('categories') }}</span>.
            </span>
          </template>
          <CategoriesEditor :rows="state.snapshot?.categories ?? []" :uses="categoriesInUse" :saving="saving('categories')" @save="saveRows('categories', $event)" />
        </AppCard>
      </template>

      <template #accounts>
        <AppCard
          title="Accounts"
          collapse-id="settings.accounts"
          :summary="rowsInWords(state.snapshot?.accounts.length ?? 0, 'account', 'accounts')"
          :reveal="linkedTab === 'accounts'"
        >
          <template #subtitle>
            Your bank accounts, by the names ledger rows use. A blank currency means {{ settings.currency }}.
            <span v-if="sheetLacks('accounts')" class="mt-2 block text-toned">
              The Sheet has no accounts tab yet. Add one named accounts with these headers in row 1, then sync:
              <span class="identifier">{{ columnsOf('accounts') }}</span>.
            </span>
          </template>
          <AccountsEditor
            :rows="state.snapshot?.accounts ?? []"
            :uses="accountsInUse"
            :currency="settings.currency"
            :saving="saving('accounts')"
            @save="saveRows('accounts', $event)"
          />
        </AppCard>
      </template>

      <template v-for="tab in pack.settingsTabs" #[tab.value]>
        <component :is="tab.component" />
      </template>

      <template #device>
        <DevicePanel />
      </template>
    </PageTabs>
  </section>
</template>
