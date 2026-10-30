<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dateFormat } from '../../calendar/dateFormat'
import AppCard from '../../ui/AppCard.vue'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { DriveFilePlace } from '../application/workbookPorts'
import { exportReminderDue } from '../domain/exportReminder'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'
import { words } from './words'

/**
 * An app's Settings: where its file is kept, when it was saved, synced and exported, and a
 * link to it on Drive. The app's own buttons go in `actions`, and its notices in the default slot.
 */
const props = defineProps<{
  title: string
  store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'driveFilePlace'>
  /** The title the app stores on a file it makes, and the words shown for it in the language on screen. */
  seededTitle?: { readonly stored: string; readonly shown: string }
}>()

const state = computed(() => props.store.state)

const stamp = dateFormat({ dateStyle: 'medium', timeStyle: 'short' })
const day = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })

const meta = computed(() => state.value.snapshot?.meta ?? null)
const source = computed(() => state.value.choice?.source ?? meta.value?.source ?? null)
const fileName = computed(() => {
  const name = state.value.choice?.name ?? meta.value?.title ?? null
  return props.seededTitle !== undefined && name === props.seededTitle.stored ? props.seededTitle.shown : name
})
const changedAt = computed(() => (state.value.syncedAt === null ? null : stamp(new Date(state.value.syncedAt))))
const exportedAt = computed(() => (meta.value?.lastExportedAt ? day(new Date(meta.value.lastExportedAt)) : null))
const reminderDue = computed(() => exportReminderDue(meta.value?.unexportedSince ?? null, new Date()))
const savedAt = computed(() => {
  const saved = state.value.snapshot?.document.savedAt ?? ''
  return saved === '' ? null : stamp(new Date(saved))
})
const fileLink = computed(() => (source.value === 'drive' && meta.value !== null ? `https://drive.google.com/file/d/${encodeURIComponent(meta.value.id)}/view` : null))

/** Where the Drive file sits and its newest backup, read again after each save or sync while the page holds a token, since asking for one needs a click. */
const place = ref<{ readonly fileId: string; readonly found: DriveFilePlace } | null>(null)
const shownPlace = computed(() => (place.value !== null && place.value.fileId === meta.value?.id ? place.value.found : null))
watch(
  () => (source.value === 'drive' ? (state.value.snapshot?.revision ?? null) : null),
  async (revision) => {
    const fileId = meta.value?.id
    if (revision === null || fileId === undefined) return
    try {
      const found = await props.store.driveFilePlace()
      if (state.value.snapshot?.revision === revision) place.value = found === null ? null : { fileId, found }
    } catch {
      // The folder and the backup are extras. The file itself still syncs and saves.
    }
  },
  { immediate: true },
)
const folderLink = computed(() => (shownPlace.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(shownPlace.value.folderId)}`))
const lastBackup = computed(() => (shownPlace.value?.lastBackup ? day(new Date(`${shownPlace.value.lastBackup}T12:00:00`)) : null))
</script>

<template>
  <AppCard :title="title">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <template v-if="source === 'browser'">
        <p class="text-base text-highlighted">{{ fileName }}</p>
        <p class="text-sm text-muted">{{ words.booksFile.inBrowser }}</p>
        <p class="figure text-xs text-muted">
          <span v-if="changedAt">{{ words.booksFile.lastChanged(changedAt) }}</span
          >{{ exportedAt ? words.booksFile.lastExported(exportedAt) : words.booksFile.notExported }}
        </p>
        <UAlert v-if="reminderDue" icon="i-lucide-clock-alert" color="warning" variant="subtle" :title="words.booksFile.reminderTitle" :description="words.booksFile.reminder" />
      </template>
      <template v-else-if="source === 'drive'">
        <p class="text-base text-highlighted">{{ fileName }}</p>
        <p class="text-sm text-muted">{{ words.booksFile.onDrive }}</p>
        <dl class="drive-facts text-xs" data-testid="drive-file-place">
          <template v-if="shownPlace">
            <dt>{{ words.booksFile.folder }}</dt>
            <dd>
              <a :href="folderLink ?? undefined" target="_blank" rel="noopener" class="settings-link inline-target">{{ shownPlace.folderName }}</a>
            </dd>
          </template>
          <template v-if="savedAt">
            <dt>{{ words.booksFile.lastSaved }}</dt>
            <dd class="figure">{{ savedAt }}</dd>
          </template>
          <template v-if="shownPlace">
            <dt>{{ words.booksFile.lastBackup }}</dt>
            <dd class="figure">{{ lastBackup ?? words.booksFile.noBackup }}</dd>
          </template>
          <template v-if="changedAt">
            <dt>{{ words.booksFile.lastSynced }}</dt>
            <dd class="figure">{{ changedAt }}</dd>
          </template>
        </dl>
      </template>
      <slot />
      <div class="flex flex-wrap gap-2">
        <slot name="actions" />
        <UButton v-if="fileLink" :to="fileLink" target="_blank" :label="words.booksFile.openInDrive" icon="i-lucide-external-link" color="neutral" variant="ghost" size="sm" />
      </div>
    </div>
  </AppCard>
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
