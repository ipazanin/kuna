<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { activeTheme, chooseTheme } from '../../../shared/theme/theme'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import SwitchSourceDialog from '../../data-source/presentation/SwitchSourceDialog.vue'
import { exportReminderDue } from '../../excel/domain/exportReminder'
import ImportDialog from '../../excel/presentation/ImportDialog.vue'
import ProblemList from '../../excel/presentation/ProblemList.vue'
import { useExport } from '../../excel/presentation/useExport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { EditableTabs } from '../../workbook/application/workbookStore'
import { XLSX_MIME_TYPE } from '../../workbook/infrastructure/workbookFile'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { rowsFrom, settingsTabRows } from '../../workbook/infrastructure/workbookTemplate'
import { DEFAULT_SETTINGS, isKnownSetting } from '../domain/settings'
import type { Settings } from '../domain/settings'
import AccountsEditor from './AccountsEditor.vue'
import CategoriesEditor from './CategoriesEditor.vue'
import GeneralSettingsForm from './GeneralSettingsForm.vue'

const store = useWorkbook()
const { state } = store
const toast = useToast()
const { exporting, exportNow } = useExport()

const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const privacyPage = `${import.meta.env.BASE_URL}privacy.html`

const source = computed(() => state.choice?.source ?? state.workbook?.source ?? null)
const editable = computed(() => source.value === 'excel')
const meta = computed(() => state.snapshot?.meta ?? null)
const settings = computed(() => state.workbook?.settings ?? DEFAULT_SETTINGS)

const workbookName = computed(() => state.choice?.name ?? state.workbook?.title ?? null)
const changedAt = computed(() => (state.syncedAt === null ? null : stamp.format(new Date(state.syncedAt))))
const exportedAt = computed(() => (meta.value?.lastExportedAt ? day.format(new Date(meta.value.lastExportedAt)) : null))
const reminderDue = computed(() => exportReminderDue(meta.value?.unexportedSince ?? null, new Date()))
const sheetLink = computed(() =>
  source.value === 'google' && state.workbook !== null ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(state.workbook.id)}/edit` : null,
)

const usedCategories = computed(() => new Set(state.workbook?.transactions.map((transaction) => transaction.category) ?? []))
const usedAccounts = computed(() => new Set(state.workbook?.transactions.map((transaction) => transaction.account) ?? []))

const switching = ref(false)

const signingOut = ref(false)

async function signOut(): Promise<void> {
  signingOut.value = true
  await store.signOutOfGoogle()
  signingOut.value = false
  toast.add({ title: 'Signed out of Google', description: 'The next sync asks Google to sign you in again.', icon: 'i-lucide-log-out', color: 'success' })
}
const pickedFile = ref<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function takeFile(event: Event): void {
  const input = event.target as HTMLInputElement
  pickedFile.value = input.files?.[0] ?? null
  input.value = ''
}

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

const darkTheme = computed({
  get: () => activeTheme.value === 'dark',
  set: (dark: boolean) => chooseTheme(dark ? 'dark' : 'light'),
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader
      title="Settings"
      :description="
        editable
          ? 'How this workbook is set up. Changes are kept in this browser, and an export writes them into the file.'
          : 'What the app reads from your Sheet. Edit these in the Sheet itself.'
      "
    />

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5" data-testid="data-source-card">
        <h2 class="text-sm font-medium text-highlighted">Data source</h2>
        <template v-if="source === 'excel'">
          <p class="text-base text-highlighted">{{ workbookName }}</p>
          <p class="text-sm text-muted">Kept in this browser. Your exported files are its only other copies.</p>
          <p class="figure text-xs text-muted">
            <span v-if="changedAt">Last changed {{ changedAt }}. </span>{{ exportedAt ? `Last exported ${exportedAt}.` : 'Not exported yet.' }}
          </p>
          <UAlert
            v-if="reminderDue"
            icon="i-lucide-clock-alert"
            color="warning"
            variant="subtle"
            title="Some changes are in no exported file yet"
            description="They live only in this browser, which can lose them if its site data is cleared. Export to keep a copy."
          />
        </template>
        <template v-else-if="source === 'google'">
          <p class="text-base text-highlighted">{{ workbookName }}</p>
          <p class="text-sm text-muted">
            A Google Sheet, read with your Google sign-in. A copy is kept in this browser, and so is the sign-in until it expires, about an hour
            later.
          </p>
          <p v-if="changedAt" class="figure text-xs text-muted">Last synced {{ changedAt }}</p>
        </template>
        <div class="flex flex-wrap gap-2">
          <UButton
            icon="i-lucide-download"
            label="Export to Excel"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="exporting"
            :disabled="exporting || state.workbook === null"
            @click="exportNow"
          />
          <UButton
            v-if="source === 'excel'"
            icon="i-lucide-file-input"
            label="Import a file"
            color="neutral"
            variant="outline"
            size="sm"
            @click="fileInput?.click()"
          />
          <UButton icon="i-lucide-arrow-left-right" label="Switch data source" color="neutral" variant="outline" size="sm" @click="switching = true" />
          <UButton
            v-if="source === 'google'"
            icon="i-lucide-log-out"
            label="Sign out of Google"
            color="neutral"
            variant="outline"
            size="sm"
            :loading="signingOut"
            @click="signOut"
          />
          <UButton
            v-if="sheetLink"
            :to="sheetLink"
            target="_blank"
            icon="i-lucide-external-link"
            label="Open the Sheet"
            color="neutral"
            variant="ghost"
            size="sm"
          />
        </div>
        <input ref="fileInput" type="file" :accept="`.xlsx,${XLSX_MIME_TYPE}`" class="sr-only" tabindex="-1" aria-hidden="true" @change="takeFile" />
      </section>

      <section class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
        <h2 class="text-sm font-medium text-highlighted">Appearance and privacy</h2>
        <USwitch v-model="darkTheme" label="Dark theme" description="Remembered on this device." />
        <p class="text-sm text-muted">
          There is no server. Nothing leaves this browser except calls to Google's APIs for a Sheet you picked.
          <a :href="privacyPage" class="settings-link inline-target">Read the privacy notes</a>
        </p>
      </section>
    </div>

    <UAlert
      v-if="source === 'google'"
      icon="i-lucide-sheet"
      color="neutral"
      variant="subtle"
      title="These live in the Sheet's settings, categories and accounts tabs"
      description="Change them in the Sheet and sync. A missing settings tab means the defaults below."
      :actions="sheetLink ? [{ label: 'Open the Sheet', icon: 'i-lucide-external-link', color: 'neutral', variant: 'outline', to: sheetLink, target: '_blank' }] : []"
    />

    <section v-if="state.workbook" class="rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
      <header class="mb-4">
        <h2 class="text-sm font-medium text-highlighted">Workbook settings</h2>
        <p class="mt-0.5 text-xs text-muted">From the settings tab. Theme is the only choice kept per device.</p>
      </header>
      <GeneralSettingsForm :settings="settings" :editable="editable" :saving="savingSection === 'settings'" @save="saveSettings" />
    </section>

    <section v-if="state.workbook" class="rounded-card border border-default bg-raised shadow-raised">
      <header class="px-4 pt-4 sm:px-5">
        <h2 class="text-sm font-medium text-highlighted">Categories</h2>
        <p class="mt-0.5 text-xs text-muted">
          The bucket decides where a row counts. Each category once, with category, family and bucket filled. A category ledger rows use keeps its
          name.
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

    <section v-if="state.workbook" class="rounded-card border border-default bg-raised shadow-raised">
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

    <section v-if="state.workbook?.problems.length" class="flex flex-col gap-3 rounded-card border border-default bg-raised p-4 shadow-raised sm:p-5">
      <header>
        <h2 class="text-sm font-medium text-highlighted">Rows the app could not use as written</h2>
        <p class="mt-0.5 text-xs text-muted">Each is left out, or read with its default, until it is fixed in the workbook.</p>
      </header>
      <ProblemList :problems="state.workbook.problems" />
    </section>

    <SwitchSourceDialog v-model:open="switching" />
    <ImportDialog v-model:file="pickedFile" />
  </section>
</template>

<style scoped>
.settings-link {
  color: var(--ink-secondary);
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.settings-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
