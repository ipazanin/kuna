<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../shared/ui/PageTabs.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import { installedPack, shownPack } from '../../packs/packContribution'
import { presentedWorkbook } from '../../transactions/application/presentedWorkbook'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { ACCOUNT_RECORDS, CATEGORY_RECORDS } from '../../workbook/domain/recordKind'
import { NO_RECORDS, recordsOf } from '../../workbook/domain/recordsRead'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
import { useMissingColumns } from '../../workbook/presentation/missingColumns'
import MissingTabHint from '../../workbook/presentation/MissingTabHint.vue'
import { useRecordWrites } from '../../workbook/presentation/useRecordWrites'
import { writeDrafts } from '../application/draftWrites'
import { removeSettings } from '../application/settingWrites'
import { unreadSettingKeys } from '../domain/settings'
import { ACCOUNT_WRITES, CATEGORY_WRITES, accountUses, categoryUses } from '../application/namedRecordWrites'
import type { RecordsOfKind } from '../application/namedRecordWrites'
import { storedOf } from '../../workbook/domain/recordsRead'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import DevicePanel from './DevicePanel.vue'
import GeneralSettingsForm from './GeneralSettingsForm.vue'
import { knownRoles } from '../domain/categoryGuards'
import { useSettingsSave } from './useSettingsSave'

const { state } = useWorkbook()
const route = useRoute()
const { settings, facts: packFacts, statementsFolderUnset, saving: savingSettings, saveGeneral } = useSettingsSave()
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

const recordsOnScreen: RecordsOfKind = (kind) => (state.records === null ? NO_RECORDS : recordsOfKindIn(state.records, kind))
const categoriesInUse = computed(() => categoryUses(recordsOnScreen))
const roles = knownRoles(installedPack().workbook?.categoryRoles ?? [])
const accountsInUse = computed(() => accountUses(recordsOnScreen))
const categories = computed(() => state.records?.categories ?? NO_RECORDS)
const accounts = computed(() => state.records?.accounts ?? NO_RECORDS)
/** The reader's problems and the splits the figures leave out, such as one of a row an asset claims. */
const problems = computed(() => (state.workbook === null ? [] : presentedWorkbook(state.workbook).problems))

const writes = useRecordWrites()

const settingRecords = computed(() => state.records?.settings ?? NO_RECORDS)
/** The keys the settings tab holds that no setting reads, unknown keys and import profiles, with how many rows hold each. */
const unreadKeys = computed(() => unreadSettingKeys(recordsOf(settingRecords.value), installedPack().workbook?.settings ?? null))

function removeKey(key: string): void {
  void writes.write('Setting removed', (unit) => removeSettings(unit, settingRecords.value, [key]), {
    description: `${key} is off the settings tab. Settings keep no Undo, so add it in the Sheet again to bring it back.`,
    failedTitle: 'Not removed',
  })
}

function rowsInWords(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`
}

function storedCount(read: RecordsRead<unknown>): number {
  return read.records.length + read.refused.length
}

const saving = computed(() => writes.busy.value || state.writing)

/** A save that fills a column the Sheet lacks adds it, as the editor's notice says before the save. */
const categoryColumnsMissing = useMissingColumns(CATEGORY_RECORDS)
const accountColumnsMissing = useMissingColumns(ACCOUNT_RECORDS)

function saveCategories(made: readonly { readonly saved: number | null; readonly record: CategoryRecord }[]): void {
  void writes.write('Categories saved', (unit) => writeDrafts(unit.of(CATEGORY_WRITES), storedOf(categories.value), made), {
    failedTitle: 'Not saved',
    addMissingKinds: categoryColumnsMissing.value.length > 0,
  })
}

function saveAccounts(made: readonly { readonly saved: number | null; readonly record: AccountRecord }[]): void {
  void writes.write('Accounts saved', (unit) => writeDrafts(unit.of(ACCOUNT_WRITES), storedOf(accounts.value), made), {
    failedTitle: 'Not saved',
    addMissingKinds: accountColumnsMissing.value.length > 0,
  })
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
          <GeneralSettingsForm
            :settings="settings"
            :facts="packFacts"
            :statements-folder-unset="statementsFolderUnset"
            :saving="savingSettings || state.writing"
            @save="saveGeneral"
          />
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
              <ProblemList v-if="problems.length > 0" :problems="problems">
                <template #action="{ problem }">
                  <UButton
                    v-if="problem.tab === 'settings' && unreadKeys.get(problem.label) === 1"
                    label="Remove the key"
                    icon="i-lucide-trash-2"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    class="self-start sm:self-auto"
                    :disabled="saving"
                    :aria-label="`Remove ${problem.label} from the settings tab`"
                    data-testid="remove-setting"
                    @click="removeKey(problem.label)"
                  />
                  <p v-else-if="problem.tab === 'settings' && (unreadKeys.get(problem.label) ?? 0) > 1" class="text-xs text-muted sm:max-w-56" data-testid="setting-on-rows">
                    Set on {{ unreadKeys.get(problem.label) }} rows. Keep one in the workbook, then remove it here.
                  </p>
                </template>
              </ProblemList>
              <p v-else class="text-sm text-muted">Every row of the workbook reads as written.</p>
            </div>
          </AppCard>
        </div>
      </template>

      <template #categories>
        <AppCard
          title="Categories"
          collapse-id="settings.categories"
          :summary="rowsInWords(storedCount(categories), 'category', 'categories')"
          :reveal="linkedTab === 'categories'"
        >
          <template #subtitle>
            The bucket decides where a row counts. Each category once, with category, family and bucket filled. A category in use keeps its name and its
            row.
            <span v-if="source === 'google'" class="mt-1 block" data-testid="dropdown-note">The ledger's category dropdown in the Sheet lists this tab's categories.</span>
            <MissingTabHint :kind="CATEGORY_RECORDS" />
          </template>
          <CategoriesEditor :records="categories" :uses="categoriesInUse" :roles="roles" :saving="saving" @save="saveCategories" />
        </AppCard>
      </template>

      <template #accounts>
        <AppCard
          title="Accounts"
          collapse-id="settings.accounts"
          :summary="rowsInWords(storedCount(accounts), 'account', 'accounts')"
          :reveal="linkedTab === 'accounts'"
        >
          <template #subtitle>
            Your bank accounts, by the names ledger rows use. A blank currency means {{ settings.currency }}.
            <MissingTabHint :kind="ACCOUNT_RECORDS" />
          </template>
          <AccountsEditor
            :records="accounts"
            :uses="accountsInUse"
            :currency="settings.currency"
            :saving="saving"
            @save="saveAccounts"
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
