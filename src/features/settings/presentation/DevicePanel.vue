<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { chooseTheme, themeChoice } from '../../../shared/theme/theme'
import type { ThemeChoice } from '../../../shared/theme/theme'
import AppCard from '../../../shared/ui/AppCard.vue'
import SwitchSourceDialog from '../../data-source/presentation/SwitchSourceDialog.vue'
import { exportReminderDue } from '../../excel/domain/exportReminder'
import ImportDialog from '../../excel/presentation/ImportDialog.vue'
import { useExport } from '../../excel/presentation/useExport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useSheetLink } from '../../workbook/presentation/useSheetLink'
import { WORKBOOK_FILE_TYPES } from '../../workbook/presentation/workbookFiles'

/** Where the ledger comes from, and how the app looks on this device. */
const store = useWorkbook()
const { state } = store
const toast = useToast()
const { exporting, exportNow } = useExport()

const stamp = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
const day = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const privacyPage = `${import.meta.env.BASE_URL}privacy.html`

const source = computed(() => state.choice?.source ?? state.workbook?.source ?? null)
const meta = computed(() => state.snapshot?.meta ?? null)

const workbookName = computed(() => state.choice?.name ?? state.workbook?.title ?? null)
const changedAt = computed(() => (state.syncedAt === null ? null : stamp.format(new Date(state.syncedAt))))
const exportedAt = computed(() => (meta.value?.lastExportedAt ? day.format(new Date(meta.value.lastExportedAt)) : null))
const reminderDue = computed(() => exportReminderDue(meta.value?.unexportedSince ?? null, new Date()))
const sheetLink = useSheetLink()

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

const THEME_CHOICES: { label: string; value: ThemeChoice }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid gap-4 lg:grid-cols-2">
      <AppCard title="Data source" data-testid="data-source-card">
        <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
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
          <input ref="fileInput" type="file" :accept="WORKBOOK_FILE_TYPES" class="sr-only" tabindex="-1" aria-hidden="true" @change="takeFile" />
        </div>
      </AppCard>

      <AppCard title="Appearance and privacy">
        <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
          <URadioGroup
            :model-value="themeChoice"
            :items="THEME_CHOICES"
            legend="Theme"
            orientation="horizontal"
            variant="table"
            :ui="{ item: 'flex-1' }"
            data-testid="theme-choice"
            @update:model-value="chooseTheme($event as ThemeChoice)"
          />
          <p class="text-xs text-muted">System follows this device's setting as it changes. Light or Dark is remembered on this device.</p>
          <p class="text-sm text-muted">
            There is no server. Nothing leaves this browser except calls to Google's APIs for a Sheet you picked.
            <a :href="privacyPage" class="settings-link inline-target">Read the privacy notes</a>
          </p>
        </div>
      </AppCard>
    </div>

    <SwitchSourceDialog v-model:open="switching" />
    <ImportDialog v-model:file="pickedFile" />
  </div>
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
