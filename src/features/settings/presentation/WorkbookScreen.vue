<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UTabs from '@nuxt/ui/components/Tabs.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import PageHeader from '../../../shared/ui/PageHeader.vue'
import LoanBucketSwitch from '../../../packs/hr-doo/presentation/LoanBucketSwitch.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import RulesTab from '../../rules/presentation/RulesTab.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { EditableTabs } from '../../workbook/application/workbookStore'
import { spreadsheetLink } from '../../workbook/infrastructure/sheetRowLink'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { rowsFrom } from '../../workbook/infrastructure/workbookTemplate'
import { DEFAULT_SETTINGS, changedSettings } from '../domain/settings'
import type { Settings } from '../domain/settings'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import GeneralSettingsForm from './GeneralSettingsForm.vue'

const TABS = [
  { label: 'General', value: 'general', icon: 'i-lucide-sliders-horizontal', slot: 'general' as const },
  { label: 'Rules', value: 'rules', icon: 'i-lucide-list-ordered', slot: 'rules' as const },
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

async function saveSection(section: 'categories' | 'accounts', edits: EditableTabs, saved: string): Promise<void> {
  savingSection.value = section
  await store.saveLocalEdits(edits)
  savingSection.value = null
  if (state.status === 'error') {
    toast.add({ title: 'Not saved', description: state.error ?? '', icon: 'i-lucide-triangle-alert', color: 'error' })
  } else {
    toast.add({ title: saved, icon: 'i-lucide-check', color: 'success' })
  }
}

/** Only the keys that changed are written, each checked against the value the app read for it. */
async function saveSettings(next: Settings): Promise<void> {
  const rows = state.snapshot?.settings ?? []
  const changes = changedSettings(settings.value, next).map(({ key, value }) => {
    const row = rows.find((candidate: SheetRow) => String(candidate.cells.key ?? '').trim().toLowerCase() === key)
    return { key, value, expected: row === undefined ? null : (row.cells.value ?? '') }
  })
  savingSection.value = 'settings'
  try {
    await store.changeSettings(changes)
    toast.add({ title: 'Settings saved', ...(source.value === 'google' ? { description: 'Written to the settings tab of the Sheet.' } : {}), icon: 'i-lucide-check', color: 'success' })
  } catch (failure) {
    toast.add({ title: 'Not saved', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  } finally {
    savingSection.value = null
  }
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
          : 'How your Sheet is set up. Settings and rules saved here are written to the Sheet. Categories and accounts are edited in the Sheet itself.'
      "
    />

    <UAlert
      v-if="source === 'google'"
      icon="i-lucide-sheet"
      color="neutral"
      variant="subtle"
      title="Categories and accounts are edited in the Sheet"
      description="The Apps Script reads and checks those two tabs every morning, so change them in the Sheet and sync. Settings, rules and the bucket of the loan categories can be saved from here."
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
            <GeneralSettingsForm :settings="settings" :saving="savingSection === 'settings' || state.writing" @save="saveSettings" />
          </section>
          <LoanBucketSwitch v-if="settings.ownerPayModule" :categories="state.workbook.categories" />
          <section v-if="state.workbook.problems.length" class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
            <header>
              <h2 class="text-sm font-medium text-highlighted">Rows the app could not use as written</h2>
              <p class="mt-0.5 text-xs text-muted">Each is left out, or read with its default, until it is fixed in the workbook.</p>
            </header>
            <ProblemList :problems="state.workbook.problems" />
          </section>
        </div>
      </template>

      <template #rules>
        <RulesTab />
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
