<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UTabs from '@nuxt/ui/components/Tabs.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import PageHeader from '../../../shared/ui/PageHeader.vue'
import LoanBucketSwitch from '../../../packs/hr-doo/presentation/LoanBucketSwitch.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import RulesTab from '../../rules/presentation/RulesTab.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { RowTab } from '../../workbook/application/workbookWriter'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { readAssets } from '../../workbook/infrastructure/assetsTabReader'
import { readGrants } from '../../workbook/infrastructure/grantsTabReader'
import { readClientRows } from '../../workbook/infrastructure/workbookReader'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { readYearEnd } from '../../workbook/infrastructure/yearEndTabReader'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { ACCOUNT_ROWS, ASSET_ROWS, CATEGORY_ROWS, CLIENT_ROWS, GRANT_ROWS, YEAR_END_ROWS, accountUses, categoryUses } from '../application/workbookTabRows'
import type { RowsOf } from '../application/workbookTabRows'
import { DEFAULT_SETTINGS, changedSettings } from '../domain/settings'
import type { Settings } from '../domain/settings'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import FactTabEditor from './FactTabEditor.vue'
import { CLIENT_COLUMNS, GRANT_COLUMNS, YEAR_END_COLUMNS, assetColumns } from './factTabColumns'
import GeneralSettingsForm from './GeneralSettingsForm.vue'

const TABS = [
  { label: 'General', value: 'general', icon: 'i-lucide-sliders-horizontal', slot: 'general' as const },
  { label: 'Rules', value: 'rules', icon: 'i-lucide-list-ordered', slot: 'rules' as const },
  { label: 'Categories', value: 'categories', icon: 'i-lucide-tags', slot: 'categories' as const },
  { label: 'Accounts', value: 'accounts', icon: 'i-lucide-landmark', slot: 'accounts' as const },
  { label: 'Clients', value: 'clients', icon: 'i-lucide-users', slot: 'clients' as const },
  { label: 'Assets', value: 'assets', icon: 'i-lucide-laptop', slot: 'assets' as const },
  { label: 'Grants', value: 'grants', icon: 'i-lucide-hand-coins', slot: 'grants' as const },
  { label: 'Year end', value: 'year-end', icon: 'i-lucide-book-check', slot: 'year-end' as const },
]

/** The tabs edited as a table of fields, each with its section text. */
const FACT_TABS = {
  clients: {
    title: 'Clients',
    description: 'Who pays your invoices, one row per IBAN they pay from, so a client paying from two accounts has two rows under one name.',
    rowNoun: 'client row',
    tabNoun: 'clients',
  },
  assets: {
    title: 'Assets',
    description: 'Purchases kept as fixed assets and depreciated, each once. The cost is without the VAT that was reclaimed.',
    rowNoun: 'asset',
    tabNoun: 'assets',
  },
  grants: {
    title: 'Grants',
    description: 'The terms of each grant. The fixed and variable parts add up to the amount.',
    rowNoun: 'grant',
    tabNoun: 'grants',
  },
  'year-end': {
    title: 'Year end',
    description: "The accountant's figures, one row per year, statement and line. A konto row names the categories it matches.",
    rowNoun: 'line',
    tabNoun: 'year-end lines',
  },
} as const

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
const settings = computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)

const rowsOfSnapshot: RowsOf = (tab) => state.snapshot?.[tab] ?? []
const categoriesInUse = computed(() => categoryUses(rowsOfSnapshot))
const accountsInUse = computed(() => accountUses(rowsOfSnapshot))
const billingItems = computed(() => [...new Set(state.workbook?.billingPlan.map((row) => row.item) ?? [])])

const savingSettings = ref(false)

const grantSlugs = computed(() => state.workbook?.grants.map((grant) => grant.slug) ?? [])
const categorySlugs = computed(() => new Set(state.workbook?.categories.map((category) => category.slug) ?? []))

const factTabEditors = computed(() => ({
  clients: { columns: CLIENT_COLUMNS, read: readClientRows, newRow: () => ({}) },
  assets: { columns: assetColumns(grantSlugs.value), read: (rows: readonly SheetRow[]) => readAssets(rows, new Set(grantSlugs.value)), newRow: () => ({}) },
  grants: { columns: GRANT_COLUMNS, read: readGrants, newRow: () => ({ release: 'fixed-then-assets' }) },
  'year-end': { columns: YEAR_END_COLUMNS, read: (rows: readonly SheetRow[]) => readYearEnd(rows, categorySlugs.value), newRow: newYearEndLine },
}))

const rowWrites = {
  categories: useRowWrites(CATEGORY_ROWS),
  accounts: useRowWrites(ACCOUNT_ROWS),
  clients: useRowWrites(CLIENT_ROWS),
  assets: useRowWrites(ASSET_ROWS),
  grants: useRowWrites(GRANT_ROWS),
  'year-end': useRowWrites(YEAR_END_ROWS),
}

type RowSection = keyof typeof rowWrites

const TITLES: Readonly<Record<RowSection, string>> = {
  categories: 'Categories',
  accounts: 'Accounts',
  clients: 'Clients',
  assets: 'Assets',
  grants: 'Grants',
  'year-end': 'Year end',
}

/** A new line starts in the latest year the tab holds, or last year, on the profit and loss. */
function newYearEndLine(): Record<string, string> {
  const years = state.workbook?.yearEndLines.map((line) => line.year) ?? []
  return { year: String(years.length > 0 ? Math.max(...years) : new Date().getFullYear() - 1), statement: 'pl' }
}

function sheetLacks(tab: RowTab): boolean {
  return source.value === 'google' && (state.snapshot?.meta.missingTabs.includes(tab) ?? false)
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

/** Only the keys that changed are written, each checked against the value the app read for it. */
async function saveSettings(next: Settings): Promise<void> {
  const rows = state.snapshot?.settings ?? []
  const changes = changedSettings(settings.value, next).map(({ key, value }) => {
    const row = rows.find((candidate: SheetRow) => String(candidate.cells.key ?? '').trim().toLowerCase() === key)
    return { key, value, expected: row === undefined ? null : (row.cells.value ?? '') }
  })
  savingSettings.value = true
  try {
    await store.changeSettings(changes)
    toast.add({ title: 'Settings saved', ...(source.value === 'google' ? { description: 'Written to the settings tab of the Sheet.' } : {}), icon: 'i-lucide-check', color: 'success' })
  } catch (failure) {
    toast.add({ title: 'Not saved', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  } finally {
    savingSettings.value = false
  }
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader
      title="Workbook"
      :description="
        source === 'excel'
          ? 'How this workbook is set up. Changes are kept in this browser, and an export writes them into the file.'
          : 'How your Sheet is set up. A save here writes only the cells you changed to the Sheet, checks they read back, and offers Undo.'
      "
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
            <GeneralSettingsForm
              :settings="settings"
              :saving="savingSettings || state.writing"
              :clients="state.workbook.clients"
              :billing-items="billingItems"
              @save="saveSettings"
            />
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
              The bucket decides where a row counts. Each category once, with category, family and bucket filled. A category in use keeps its name
              and its row.
            </p>
            <p v-if="source === 'google'" class="mt-1 text-xs text-muted" data-testid="dropdown-note">The ledger's category dropdown in the Sheet lists this tab's categories.</p>
            <p v-if="sheetLacks('categories')" class="mt-2 text-xs text-toned">
              The Sheet has no categories tab yet. Add one named categories with these headers in row 1, then sync:
              <span class="identifier">{{ columnsOf('categories') }}</span>.
            </p>
          </header>
          <CategoriesEditor :rows="state.snapshot?.categories ?? []" :uses="categoriesInUse" :saving="saving('categories')" @save="saveRows('categories', $event)" />
        </section>
      </template>

      <template #accounts>
        <section class="rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">Accounts</h2>
            <p class="mt-0.5 text-xs text-muted">Your bank accounts, by the names ledger rows use. A blank currency means {{ settings.currency }}.</p>
            <p v-if="sheetLacks('accounts')" class="mt-2 text-xs text-toned">
              The Sheet has no accounts tab yet. Add one named accounts with these headers in row 1, then sync:
              <span class="identifier">{{ columnsOf('accounts') }}</span>.
            </p>
          </header>
          <AccountsEditor
            :rows="state.snapshot?.accounts ?? []"
            :uses="accountsInUse"
            :currency="settings.currency"
            :saving="saving('accounts')"
            @save="saveRows('accounts', $event)"
          />
        </section>
      </template>

      <template v-for="(fact, tab) in FACT_TABS" :key="tab" #[tab]>
        <section class="rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">{{ fact.title }}</h2>
            <p class="mt-0.5 text-xs text-muted">{{ fact.description }}</p>
            <p v-if="sheetLacks(tab)" class="mt-2 text-xs text-toned">
              The Sheet has no {{ tab }} tab yet. Add one named {{ tab }} with these headers in row 1, then sync:
              <span class="identifier">{{ columnsOf(tab) }}</span>.
            </p>
          </header>
          <FactTabEditor
            :rows="state.snapshot?.[tab] ?? []"
            :columns="factTabEditors[tab].columns"
            :read="factTabEditors[tab].read"
            :new-row="factTabEditors[tab].newRow"
            :row-noun="fact.rowNoun"
            :tab-noun="fact.tabNoun"
            :saving="saving(tab)"
            @save="saveRows(tab, $event)"
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
