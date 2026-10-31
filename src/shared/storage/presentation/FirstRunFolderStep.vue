<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../google/withGoogleAccess'
import { folderTrail } from '../../text/folderPath'
import { plural } from '../../text/translation'
import StepCard from '../../ui/StepCard.vue'
import { BooksAlreadyOnDrive } from '../application/booksAlreadyOnDrive'
import type { PickedFolder } from '../application/workbookPorts'
import type { WorkbookDocument } from '../infrastructure/documentFormat'
import type { DriveFirstRun } from './fileFirstRun'
import type { FirstRunMoves } from './useFirstRun'
import { words } from './words'

/**
 * The folder the app's file is saved in: the Picker opens at My Drive, and nothing is made until the
 * person confirms the folder. "Create the file here" is the only action that writes. Each tap asks
 * Google first when the page holds no token, and on a phone the route brings the person back here.
 * When Drive already holds the app's file, it offers to find it instead.
 */
const props = withDefaults(
  defineProps<{
    firstRun: DriveFirstRun
    steps: FirstRunMoves
    /**
     * Records the app already holds, from a file brought along or from this browser, which the new file keeps in place
     * of new contents and the toast counts as moved. Null once the page no longer holds them, which the `missing` slot explains.
     */
    moving?: WorkbookDocument | null | undefined
    /** Folders the app makes beside the file, which the `beside` slot names in the confirm. */
    besideFolders?: readonly string[]
  }>(),
  { besideFolders: () => [] },
)
const store = props.firstRun.store
const appWords = computed(() => props.firstRun.words.folder)
const toast = useToast()

const picked = ref<PickedFolder | null>(null)
const picking = ref(false)
const keeping = ref(false)
const failure = ref<string | null>(null)
const alreadyOnDrive = ref<BooksAlreadyOnDrive | null>(null)

const folderLink = computed(() => (picked.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(picked.value.id)}`))

/** Opening the file on Drive deletes the one kept in this browser. */
const dropsBrowserFile = computed(() => store.state.choice?.source === 'browser')

function failed(refused: unknown): void {
  if (refused instanceof BooksAlreadyOnDrive) {
    alreadyOnDrive.value = refused
  } else {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  }
}

async function choose(): Promise<void> {
  picking.value = true
  failure.value = null
  alreadyOnDrive.value = null
  try {
    picked.value = (await withGoogleAccess(['drive.file'], () => store.pickBooksFolder())) ?? picked.value
  } catch (refused) {
    failed(refused)
  } finally {
    picking.value = false
  }
}

function keptToast(name: string, folder: PickedFolder, document: WorkbookDocument, moved: boolean): { title: string; description: string } {
  const where = folder.path === null ? folder.name : folderTrail(folder.path)
  if (!moved) {
    return { title: words.firstRun.folder.created(name, where), description: words.firstRun.folder.createdNote }
  }
  const records = Object.values(document.records).reduce((sum, kind) => sum + kind.length, 0)
  return { title: plural(words.firstRun.folder.moved(records), records), description: words.firstRun.folder.movedNote(name, where) }
}

async function create(): Promise<void> {
  const folder = picked.value
  // Read before the keep, since the page stops holding the moved records once the file is on Drive.
  const moved = props.moving !== undefined
  const document = moved ? props.moving : props.firstRun.newContents()
  if (folder === null || document === null) return
  const before = store.state.choice
  keeping.value = true
  failure.value = null
  alreadyOnDrive.value = null
  try {
    await withGoogleAccess(['drive.file'], () => store.keepOnDrive(folder.id, document, props.besideFolders))
  } catch (refused) {
    failed(refused)
  } finally {
    keeping.value = false
  }
  const chosen = store.state.choice
  if (chosen !== before && chosen?.source === 'drive') {
    toast.add({ ...keptToast(chosen.name, folder, document, moved), icon: 'i-lucide-check', color: 'success' })
    await props.steps.finish()
  } else if (store.state.status === 'error') {
    failure.value = store.state.error
  }
}
</script>

<template>
  <StepCard :title="appWords.title" :subtitle="words.firstRun.folder.subtitle">
    <slot v-if="moving === null" name="missing" />
    <div v-else-if="picked" class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" :data-testid="`${firstRun.testId}-folder-confirm`">
      <p class="text-sm text-muted">{{ appWords.savedIn }}</p>
      <p v-if="picked.path" class="identifier text-sm font-medium break-words text-highlighted">{{ folderTrail(picked.path) }}</p>
      <p v-else class="text-sm text-toned">
        <span class="identifier font-medium text-highlighted">{{ picked.name }}</span
        >{{ words.firstRun.folder.unseen }}
      </p>
      <p class="flex items-center gap-2 text-sm text-toned">
        <UIcon name="i-lucide-file-json" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0"
          ><span class="identifier">{{ firstRun.fileName }}</span
          >{{ words.firstRun.folder.withBackups }}</span
        >
      </p>
      <slot name="beside" />
      <a v-if="folderLink" :href="folderLink" target="_blank" rel="noopener" class="inline-target quiet-link text-sm" :data-testid="`${firstRun.testId}-folder-link`">
        {{ words.firstRun.folder.openFolder }}
        <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
      </a>
    </div>
    <p v-else class="text-sm text-toned">{{ appWords.choose }}</p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.firstRun.folder.failed" :description="failure" :data-testid="`${firstRun.testId}-failure`" />
    <UAlert
      v-if="alreadyOnDrive"
      icon="i-lucide-hard-drive"
      color="warning"
      variant="subtle"
      :title="appWords.onDriveTitle"
      :description="dropsBrowserFile ? appWords.onDriveDrops(alreadyOnDrive.message) : alreadyOnDrive.message"
      :data-testid="`${firstRun.testId}-on-drive`"
    />

    <template #actions>
      <template v-if="alreadyOnDrive">
        <UButton :label="words.firstRun.folder.chooseAgain" color="neutral" variant="outline" :loading="picking" @click="choose" />
        <UButton :label="appWords.openOnDrive" icon="i-lucide-folder-open" :data-testid="`${firstRun.testId}-open-on-drive`" @click="steps.go('find')" />
      </template>
      <template v-else-if="picked && moving !== null">
        <UButton :label="words.firstRun.folder.chooseAnother" color="neutral" variant="outline" :loading="picking" :disabled="keeping" @click="choose" />
        <UButton :label="words.firstRun.folder.create" icon="i-lucide-hard-drive-upload" :loading="keeping" :data-testid="`${firstRun.testId}-create`" @click="create" />
      </template>
      <UButton
        v-else
        :label="words.firstRun.folder.chooseFirst"
        icon="i-lucide-folder-search"
        :loading="picking"
        :disabled="moving === null"
        :data-testid="`${firstRun.testId}-choose-folder`"
        @click="choose"
      />
    </template>
  </StepCard>
</template>
