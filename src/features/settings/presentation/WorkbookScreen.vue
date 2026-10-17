<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UTabs from '@nuxt/ui/components/Tabs.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import PageHeader from '../../../shared/ui/PageHeader.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { EditableTabs } from '../../workbook/application/workbookStore'
import { spreadsheetLink } from '../../workbook/infrastructure/sheetRowLink'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { rowsFrom, settingsTabRows } from '../../workbook/infrastructure/workbookTemplate'
import { DEFAULT_SETTINGS, isKnownSetting } from '../domain/settings'
import type { Settings } from '../domain/settings'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import GeneralSettingsForm from './GeneralSettingsForm.vue'

const TABS = [
  { label: 'General', value: 'general', icon: 'i-lucide-sliders-horizontal', slot: 'general' as const },
  { label: 'Categories', value: 'categories', icon: 'i-lucide-tags', slot: 'categories' as const },
  { label: 'Accounts', value: 'accounts', icon: 'i-lucide-landmark', slot: 'accounts' as const },
]

type WorkbookTab = (typeof TABS)[number]['value']

const store = useWorkbook()
const { state } = store
const toast = useToast()
const route = useRoute()
const router = useRouter()

/** The tab lives in the query, so a link opens the same tab. General is the default and is left out. */
const activeTab = computed<WorkbookTab>({
  get: () => TABS.find((tab) => tab.value === route.query.tab)?.value ?? 'general',
  set: (tab) => {
    const { tab: _previous, ...others } = route.query
    void router.replace({ query: tab === 'general' ? others : { ...others, tab } })
  },
})

const source = computed(() => state.choice?.source ?? state.workbook?.source ?? null)
const editable = computed(() => source.value === 'excel')
const settings = computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)
const sheetLink = computed(() => (source.value === 'google' && state.workbook !== null ? spreadsheetLink(state.workbook.id) : null))

const usedCategories = computed(() => new Set(state.workbook?.transactions.map((transaction) => transaction.category) ?? []))
const usedAccounts = computed(() => new Set(state.workbook?.transactions.map((transaction) => transaction.account) ?? []))

const savingSection = ref<'settings' | 'categories' | 'accounts' | null>(null)

async function saveSection(section: 'settings' | 'categories' | 'accounts', edits: EditableTabs, saved: string): Promise<void> {
  savingSection.value = section
  await store.saveLocalEdits(edits)
  savingSection.value = null
  if (state.status === 'error') {
    toast.add({ title: 'Not saved', description: state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error' })
  } else {
    toast.add({ title: saved, icon: 'i-lucide-check', color: 'success' })
  }
}

function saveSettings(next: Settings): void {
  const unknownRows = (state.snapshot?.settings ?? []).filter((row: SheetRow) => !isKnownSetting(String(row.cells.key ?? '')))
  void saveSection('settings', { settings: settingsTabRows(next, unknownRows) }, 'Settings saved')
}

function saveCategories(cells: SheetRow['cells'][]): void {
  void saveSection('categories', { categories: rowsFrom(cells) }, 'Categories saved')
}

function saveAccounts(cells: SheetRow['cells'][]): void {
  void saveSection('accounts', { accounts: rowsFrom(cells) }, 'Accounts saved')
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader
      title="Workbook"
      :description="
        editable
          ? 'How this workbook is set up. Changes are kept in this browser, and an export writes them into the file.'
          : 'What the app reads from your Sheet. Edit these in the Sheet itself.'
      "
    />

    <UAlert
      v-if="source === 'google'"
      icon="i-lucide-sheet"
      color="neutral"
      variant="subtle"
      title="These live in the Sheet's settings, categories and accounts tabs"
      description="Change them in the Sheet and sync. A missing settings tab means the defaults below."
      :actions="sheetLink ? [{ label: 'Open the Sheet', icon: 'i-lucide-external-link', color: 'neutral', variant: 'outline', to: sheetLink, target: '_blank' }] : []"
    />

    <UTabs
      v-if="state.workbook"
      v-model="activeTab"
      :items="TABS"
      variant="link"
      color="neutral"
      :ui="{ root: 'min-w-0 gap-5', list: 'workbook-tabs', indicator: 'bottom-0 h-0.5 bg-[var(--accent)]', trigger: 'shrink-0' }"
      data-testid="workbook-tabs"
    >
      <template #general>
        <div class="flex flex-col gap-6">
          <section class="rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
            <header class="mb-4">
              <h2 class="text-sm font-medium text-highlighted">Workbook settings</h2>
              <p class="mt-0.5 text-xs text-muted">From the settings tab. Theme is kept per device, on Settings.</p>
            </header>
            <GeneralSettingsForm :settings="settings" :editable="editable" :saving="savingSection === 'settings'" @save="saveSettings" />
          </section>
          <section v-if="state.workbook.problems.length" class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
            <header>
              <h2 class="text-sm font-medium text-highlighted">Rows the app could not use as written</h2>
              <p class="mt-0.5 text-xs text-muted">Each is left out, or read with its default, until it is fixed in the workbook.</p>
            </header>
            <ProblemList :problems="state.workbook.problems" />
          </section>
        </div>
      </template>

      <template #categories>
        <section class="rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">Categories</h2>
            <p class="mt-0.5 text-xs text-muted">
              The bucket decides where a row counts. Each category once, with category, family and bucket filled. A category ledger rows use keeps
              its name.
            </p>
          </header>
          <CategoriesEditor
            :rows="state.snapshot?.categories ?? []"
            :used-names="usedCategories"
            :editable="editable"
            :saving="savingSection === 'categories'"
            @save="saveCategories"
          />
        </section>
      </template>

      <template #accounts>
        <section class="rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">Accounts</h2>
            <p class="mt-0.5 text-xs text-muted">Your bank accounts, by the names ledger rows use. A blank currency means {{ settings.currency }}.</p>
          </header>
          <AccountsEditor
            :rows="state.snapshot?.accounts ?? []"
            :used-names="usedAccounts"
            :currency="settings.currency"
            :editable="editable"
            :saving="savingSection === 'accounts'"
            @save="saveAccounts"
          />
        </section>
      </template>
    </UTabs>
  </section>
</template>

<style scoped>
/* On a phone the tab strip scrolls on its own, so a longer list of tabs never widens the page. */
:deep(.workbook-tabs) {
  max-width: 100%;
  overflow-x: auto;
  scrollbar-width: none;
}
</style>
