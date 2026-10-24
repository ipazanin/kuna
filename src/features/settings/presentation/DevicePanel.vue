<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
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
import type { DriveFilePlace } from '../../workbook/application/workbookPorts'
import { useWorkbook } from '../../workbook/application/workbookStore'
import NewerFileNotice from '../../workbook/presentation/NewerFileNotice.vue'
import { useKeepOnDrive } from '../../workbook/presentation/useKeepOnDrive'
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
const savedAt = computed(() => {
  const saved = state.snapshot?.document.savedAt ?? ''
  return saved === '' ? null : stamp.format(new Date(saved))
})
const fileLink = computed(() => (source.value === 'drive' && meta.value !== null ? `https://drive.google.com/file/d/${encodeURIComponent(meta.value.id)}/view` : null))

/** Where the Drive file sits and its newest backup, read again after each save or sync while a token is kept, since asking for one needs a click. */
const place = ref<{ readonly fileId: string; readonly found: DriveFilePlace } | null>(null)
const shownPlace = computed(() => (place.value !== null && place.value.fileId === meta.value?.id ? place.value.found : null))
watch(
  () => (source.value === 'drive' ? (state.snapshot?.revision ?? null) : null),
  async (revision) => {
    const fileId = meta.value?.id
    if (revision === null || fileId === undefined) return
    try {
      const found = await store.driveFilePlace()
      if (state.snapshot?.revision === revision) place.value = found === null ? null : { fileId, found }
    } catch {
      // The folder and the backup are extras. The file itself still syncs and saves.
    }
  },
  { immediate: true },
)
const folderLink = computed(() => (shownPlace.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(shownPlace.value.folderId)}`))
const lastBackup = computed(() => (shownPlace.value?.lastBackup ? day.format(new Date(`${shownPlace.value.lastBackup}T12:00:00`)) : null))

const { keeping, keepOnDrive } = useKeepOnDrive()

function moveToDrive(): void {
  const document = state.snapshot?.document
  if (document !== undefined) void keepOnDrive(document)
}

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
          <template v-if="source === 'browser'">
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
          <template v-else-if="source === 'drive'">
            <p class="text-base text-highlighted">{{ workbookName }}</p>
            <p class="text-sm text-muted">
              On Google Drive. A copy is kept in this browser, and so is the Google sign-in until it expires, about an hour later.
            </p>
            <dl class="drive-facts text-xs" data-testid="drive-file-place">
              <template v-if="shownPlace">
                <dt>Folder</dt>
                <dd>
                  <a :href="folderLink ?? undefined" target="_blank" rel="noopener" class="settings-link inline-target">{{ shownPlace.folderName }}</a>
                </dd>
              </template>
              <template v-if="savedAt">
                <dt>Last saved</dt>
                <dd class="figure">{{ savedAt }}</dd>
              </template>
              <template v-if="shownPlace">
                <dt>Last backup</dt>
                <dd class="figure">{{ lastBackup ?? 'None yet. The first save of a day makes one.' }}</dd>
              </template>
              <template v-if="changedAt">
                <dt>Last synced</dt>
                <dd class="figure">{{ changedAt }}</dd>
              </template>
            </dl>
          </template>
          <NewerFileNotice />
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
              v-if="source === 'browser'"
              icon="i-lucide-file-input"
              label="Import a file"
              color="neutral"
              variant="outline"
              size="sm"
              @click="fileInput?.click()"
            />
            <UButton icon="i-lucide-arrow-left-right" label="Switch data source" color="neutral" variant="outline" size="sm" @click="switching = true" />
            <UButton
              v-if="source === 'browser'"
              icon="i-lucide-hard-drive-upload"
              label="Keep on Google Drive"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="keeping"
              :disabled="keeping || state.workbook === null || state.writing"
              data-testid="keep-on-drive"
              @click="moveToDrive"
            />
            <UButton
              v-if="source === 'drive'"
              icon="i-lucide-log-out"
              label="Sign out of Google"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="signingOut"
              @click="signOut"
            />
            <UButton
              v-if="fileLink"
              :to="fileLink"
              target="_blank"
              icon="i-lucide-external-link"
              label="Open in Drive"
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
            There is no server. Nothing leaves this browser except calls to Google's APIs for the books on Drive, your statements and your invoices.
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
.drive-facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.25rem 1rem;
}

.drive-facts dt {
  color: var(--ink-muted);
}

.drive-facts dd {
  min-width: 0;
  color: var(--ink-secondary);
}

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
