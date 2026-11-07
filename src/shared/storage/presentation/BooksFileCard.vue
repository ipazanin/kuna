<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dateFormat } from '../../calendar/dateFormat'
import { googleAccess } from '../../google/googleAuth'
import AppCard from '../../ui/AppCard.vue'
import type { BooksRead, WorkbookStore } from '../application/createWorkbookStore'
import type { DriveFileBeside } from '../application/workbookPorts'
import { exportReminderDue } from '../domain/exportReminder'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DocumentCopy } from '../infrastructure/documentRecordStorage'
import MoveIntoKunaDialog from './MoveIntoKunaDialog.vue'
import { useDriveFilePlace } from './useDriveFilePlace'
import { words } from './words'

/** A file with nothing of Kuna's beside it but its backups. */
const NOTHING_BESIDE: DriveFileBeside = { files: [], folders: [], stays: [], blockedBy: [] }

/**
 * An app's Settings: where its file is kept, when it was saved, synced and exported, a link to it on Drive, and while it sits
 * elsewhere the move into the Kuna folder. The app's own buttons go in `actions`, and its notices in the default slot.
 */
const props = defineProps<{
  title: string
  /** The app's id, which names its subfolder of the Kuna folder. */
  appId: string
  store: Pick<WorkbookStore<BooksRead, DocumentCopy, WorkbookDocument>, 'state' | 'driveFilePlace' | 'hasKunaFolder' | 'pickDriveFolder' | 'planMoveIntoKuna' | 'moveIntoKuna'>
  /** What goes along when the file moves, read as the move opens, for a file that has more beside it than its backups. */
  beside?: (() => DriveFileBeside) | undefined
  /** What the move changes in the app's settings, for a file with such a setting. */
  afterMove?: (() => Promise<void>) | undefined
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

const { place: shownPlace, read: readPlace } = useDriveFilePlace(props.store, () => googleAccess().scopes !== null)
const moving = ref(false)
const movable = computed(() => shownPlace.value !== null && (!shownPlace.value.inKunaFolder || shownPlace.value.moveUnfinished) && !state.value.missing)
const beside = (): DriveFileBeside => props.beside?.() ?? NOTHING_BESIDE
const folderLink = computed(() => (shownPlace.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(shownPlace.value.folderId)}`))
const lastBackup = computed(() => (shownPlace.value?.lastBackup ? day(new Date(`${shownPlace.value.lastBackup}T12:00:00`)) : null))
</script>

<template>
  <AppCard :title="title">
    <div class="flex flex-col gap-3 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
      <template v-if="source === 'browser'">
        <p class="text-base text-highlighted" data-testid="books-file-name">{{ fileName }}</p>
        <p class="text-sm text-muted">{{ words.booksFile.inBrowser }}</p>
        <p class="figure text-xs text-muted">
          <span v-if="changedAt">{{ words.booksFile.lastChanged(changedAt) }}</span
          >{{ exportedAt ? words.booksFile.lastExported(exportedAt) : words.booksFile.notExported }}
        </p>
        <UAlert v-if="reminderDue" icon="i-lucide-clock-alert" color="warning" variant="subtle" :title="words.booksFile.reminderTitle" :description="words.booksFile.reminder" />
      </template>
      <template v-else-if="source === 'drive'">
        <p class="text-base text-highlighted" data-testid="books-file-name">{{ fileName }}</p>
        <p class="text-sm text-muted">{{ words.booksFile.onDrive }}</p>
        <dl class="drive-facts text-xs" data-testid="drive-file-place">
          <template v-if="shownPlace">
            <dt>{{ words.booksFile.folder }}</dt>
            <dd>
              <a :href="folderLink ?? undefined" target="_blank" rel="noopener" class="settings-link inline-target">{{ shownPlace.folderName ?? words.booksFile.unnamedFolder }}</a>
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
        <UAlert v-if="state.missing" icon="i-lucide-file-x" color="warning" variant="subtle" :title="words.booksFile.missingTitle" :description="state.error ?? ''" data-testid="books-file-missing" />
      </template>
      <slot />
      <div class="flex flex-wrap gap-2">
        <slot name="actions" />
        <UButton
          v-if="movable"
          icon="i-lucide-folder-input"
          :label="shownPlace?.moveUnfinished ? words.moveIntoKuna.finish : words.moveIntoKuna.action"
          color="neutral"
          variant="outline"
          size="sm"
          data-testid="move-into-kuna-open"
          @click="moving = true"
        />
        <UButton v-if="fileLink" :to="fileLink" target="_blank" :label="words.booksFile.openInDrive" icon="i-lucide-external-link" color="neutral" variant="ghost" size="sm" />
      </div>
    </div>
    <MoveIntoKunaDialog v-model:open="moving" :app-id="appId" :file-name="fileName ?? ''" :store="store" :beside="beside" :after-move="afterMove" @ended="readPlace" />
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
