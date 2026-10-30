<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { BooksAlreadyOnDrive } from '../../../../shared/storage/application/booksAlreadyOnDrive'
import type { PickedFolder } from '../../../../shared/storage/application/workbookPorts'
import { folderTrail } from '../../../../shared/text/folderPath'
import StepCard from '../../../../shared/ui/StepCard.vue'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { LOANS_FILE_NAME, newLoansFileContents } from '../../workbook/presentation/loansFile'
import { useLoansStart } from './useLoansStart'
import { words } from './words'

/**
 * The folder the Loans file is saved in: the Picker opens at My Drive, and nothing is made until the
 * person confirms the folder. "Create the file here" is the only action that writes. Each tap asks
 * Google first when the page holds no token, and on a phone the route brings the person back here.
 * When Drive already holds the Loans file, it offers to find it instead.
 */
const start = useLoansStart()
const store = useLoansBooks()
const toast = useToast()

const picked = ref<PickedFolder | null>(null)
const picking = ref(false)
const keeping = ref(false)
const failure = ref<string | null>(null)
const alreadyOnDrive = ref<BooksAlreadyOnDrive | null>(null)

const folderLink = computed(() => (picked.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(picked.value.id)}`))

/** Opening the Loans file on Drive deletes the one kept in this browser, as the home step warns. */
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

async function create(): Promise<void> {
  const folder = picked.value
  if (folder === null) return
  const before = store.state.choice
  keeping.value = true
  failure.value = null
  alreadyOnDrive.value = null
  try {
    await withGoogleAccess(['drive.file'], () => store.keepOnDrive(folder.id, newLoansFileContents(store), []))
  } catch (refused) {
    failed(refused)
  } finally {
    keeping.value = false
  }
  const chosen = store.state.choice
  if (chosen !== before && chosen?.source === 'drive') {
    toast.add({
      title: words.folder.created(chosen.name, folder.path === null ? folder.name : folderTrail(folder.path)),
      description: words.folder.createdNote,
      icon: 'i-lucide-check',
      color: 'success',
    })
    await start.finish()
  } else if (store.state.status === 'error') {
    failure.value = store.state.error
  }
}
</script>

<template>
  <StepCard :title="words.folder.title" :subtitle="words.folder.subtitle">
    <div v-if="picked" class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="loans-start-folder-confirm">
      <p class="text-sm text-muted">{{ words.folder.savedIn }}</p>
      <p v-if="picked.path" class="identifier text-sm font-medium break-words text-highlighted">{{ folderTrail(picked.path) }}</p>
      <p v-else class="text-sm text-toned">
        <span class="identifier font-medium text-highlighted">{{ picked.name }}</span
        >{{ words.folder.unseen }}
      </p>
      <p class="flex items-center gap-2 text-sm text-toned">
        <UIcon name="i-lucide-file-json" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0"
          ><span class="identifier">{{ LOANS_FILE_NAME }}</span
          >{{ words.folder.withBackups }}</span
        >
      </p>
      <a v-if="folderLink" :href="folderLink" target="_blank" rel="noopener" class="inline-target folder-link text-sm">
        {{ words.folder.openFolder }}
        <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
      </a>
    </div>
    <p v-else class="text-sm text-toned">{{ words.folder.choose }}</p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.folder.failed" :description="failure" data-testid="loans-start-failure" />
    <UAlert
      v-if="alreadyOnDrive"
      icon="i-lucide-hard-drive"
      color="warning"
      variant="subtle"
      :title="words.folder.onDriveTitle"
      :description="dropsBrowserFile ? words.folder.onDriveDrops(alreadyOnDrive.message) : alreadyOnDrive.message"
      data-testid="loans-start-on-drive"
    />

    <template #actions>
      <template v-if="alreadyOnDrive">
        <UButton :label="words.folder.chooseAgain" color="neutral" variant="outline" :loading="picking" @click="choose" />
        <UButton :label="words.folder.openOnDrive" icon="i-lucide-folder-open" data-testid="loans-start-open-on-drive" @click="start.go('find')" />
      </template>
      <template v-else-if="picked">
        <UButton :label="words.folder.chooseAnother" color="neutral" variant="outline" :loading="picking" :disabled="keeping" @click="choose" />
        <UButton :label="words.folder.create" icon="i-lucide-hard-drive-upload" :loading="keeping" data-testid="loans-start-create" @click="create" />
      </template>
      <UButton v-else :label="words.folder.chooseFirst" icon="i-lucide-folder-search" :loading="picking" data-testid="loans-start-choose-folder" @click="choose" />
    </template>
  </StepCard>
</template>

<style scoped>
.folder-link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  width: fit-content;
  color: var(--ink-secondary);
  text-decoration: underline;
  text-decoration-color: var(--border-strong);
  text-underline-offset: 3px;
}

.folder-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
