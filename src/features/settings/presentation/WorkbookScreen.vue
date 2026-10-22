<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import AppCard from '../../../shared/ui/AppCard.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../shared/ui/PageTabs.vue'
import LoanBucketSwitch from '../../../packs/hr-doo/presentation/LoanBucketSwitch.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import { presentedWorkbook } from '../../transactions/application/presentedWorkbook'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { RowTab } from '../../workbook/application/workbookWriter'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { readAssets } from '../../workbook/infrastructure/assetsTabReader'
import { readGrants } from '../../workbook/infrastructure/grantsTabReader'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import { readYearEnd } from '../../workbook/infrastructure/yearEndTabReader'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { ACCOUNT_ROWS, ASSET_ROWS, CATEGORY_ROWS, GRANT_ROWS, YEAR_END_ROWS, accountUses, categoryUses } from '../application/workbookTabRows'
import type { RowsOf } from '../application/workbookTabRows'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import FactTabEditor from './FactTabEditor.vue'
import { GRANT_COLUMNS, YEAR_END_COLUMNS, assetColumns } from './factTabColumns'
import GeneralSettingsForm from './GeneralSettingsForm.vue'
import { useSettingsSave } from './useSettingsSave'

const TABS: readonly PageTab[] = [
  { label: 'General', value: 'general', icon: 'i-lucide-sliders-horizontal' },
  { label: 'Categories', value: 'categories', icon: 'i-lucide-tags' },
  { label: 'Accounts', value: 'accounts', icon: 'i-lucide-landmark' },
  { label: 'Assets', value: 'assets', icon: 'i-lucide-laptop' },
  { label: 'Grants', value: 'grants', icon: 'i-lucide-hand-coins' },
  { label: 'Year end', value: 'year-end', icon: 'i-lucide-book-check' },
]

/** The tabs edited as a table of fields, each with its section text. */
const FACT_TABS = {
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

const { state } = useWorkbook()
const route = useRoute()
const { settings, saving: savingSettings, save: saveSettings } = useSettingsSave()

/** The tab a link from another screen opened. Its card opens even when this device keeps it collapsed, until another tab is picked. */
const linkedTab = ref(typeof route.query.tab === 'string' ? route.query.tab : null)

const source = computed(() => state.choice?.source ?? state.workbook?.source ?? null)

const rowsOfSnapshot: RowsOf = (tab) => state.snapshot?.[tab] ?? []
const categoriesInUse = computed(() => categoryUses(rowsOfSnapshot))
const accountsInUse = computed(() => accountUses(rowsOfSnapshot))
/** The reader's problems and the splits the figures leave out, such as one of a row an asset claims. */
const problems = computed(() => (state.workbook === null ? [] : presentedWorkbook(state.workbook).problems))
const grantSlugs = computed(() => state.workbook?.grants.map((grant) => grant.slug) ?? [])
const categorySlugs = computed(() => new Set(state.workbook?.categories.map((category) => category.slug) ?? []))

const factTabEditors = computed(() => ({
  assets: { columns: assetColumns(grantSlugs.value), read: (rows: readonly SheetRow[]) => readAssets(rows, new Set(grantSlugs.value)), newRow: () => ({}) },
  grants: { columns: GRANT_COLUMNS, read: readGrants, newRow: () => ({ release: 'fixed-then-assets' }) },
  'year-end': { columns: YEAR_END_COLUMNS, read: (rows: readonly SheetRow[]) => readYearEnd(rows, categorySlugs.value), newRow: newYearEndLine },
}))

const rowWrites = {
  categories: useRowWrites(CATEGORY_ROWS),
  accounts: useRowWrites(ACCOUNT_ROWS),
  assets: useRowWrites(ASSET_ROWS),
  grants: useRowWrites(GRANT_ROWS),
  'year-end': useRowWrites(YEAR_END_ROWS),
}

type RowSection = keyof typeof rowWrites

const TITLES: Readonly<Record<RowSection, string>> = {
  categories: 'Categories',
  accounts: 'Accounts',
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
      title="Workbook"
      :description="
        source === 'excel'
          ? 'How this workbook is set up. Changes are kept in this browser, and an export writes them into the file.'
          : 'How your Sheet is set up. A save here writes only the cells you changed to the Sheet, checks they read back, and offers Undo.'
      "
    />

    <PageTabs v-if="state.workbook" :tabs="TABS" label="Parts of the workbook" data-testid="workbook-tabs" @select="linkedTab = null">
      <template #general>
        <div class="flex flex-col gap-6">
          <AppCard
            title="Workbook settings"
            subtitle="From the settings tab. Theme is kept per device, on Settings."
            collapse-id="workbook.settings"
            summary="The company and owner facts and the bucket labels"
          >
            <div class="px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
              <GeneralSettingsForm :settings="settings" :saving="savingSettings || state.writing" @save="saveSettings" />
            </div>
          </AppCard>
          <LoanBucketSwitch v-if="settings.ownerPayModule" :categories="state.workbook.categories" />
          <AppCard
            v-if="problems.length"
            title="Rows the app could not use as written"
            subtitle="Each is left out, or read with its default, until it is fixed in the workbook."
            collapse-id="workbook.problems"
            :summary="rowsInWords(problems.length, 'row', 'rows')"
          >
            <div class="px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
              <ProblemList :problems="problems" />
            </div>
          </AppCard>
        </div>
      </template>

      <template #categories>
        <AppCard
          title="Categories"
          collapse-id="workbook.categories"
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
          collapse-id="workbook.accounts"
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

      <template v-for="(fact, tab) in FACT_TABS" :key="tab" #[tab]>
        <AppCard
          :title="fact.title"
          :collapse-id="`workbook.${tab}`"
          :summary="rowsInWords(state.snapshot?.[tab].length ?? 0, fact.rowNoun, `${fact.rowNoun}s`)"
          :reveal="linkedTab === tab"
        >
          <template #subtitle>
            {{ fact.description }}
            <span v-if="sheetLacks(tab)" class="mt-2 block text-toned">
              The Sheet has no {{ tab }} tab yet. Add one named {{ tab }} with these headers in row 1, then sync:
              <span class="identifier">{{ columnsOf(tab) }}</span>.
            </span>
          </template>
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
        </AppCard>
      </template>
    </PageTabs>
  </section>
</template>
