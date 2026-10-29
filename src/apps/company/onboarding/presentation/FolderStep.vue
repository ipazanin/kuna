<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { today } from '../../../../shared/calendar/civilDate'
import { folderTrail } from '../../../../shared/text/folderPath'
import { BooksAlreadyOnDrive } from '../../../../shared/storage/application/booksAlreadyOnDrive'
import type { PickedFolder } from '../../../../shared/storage/application/workbookPorts'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useKeepOnDrive } from '../../workbook/presentation/useKeepOnDrive'
import { newBooksDocument } from '../../workbook/presentation/workbookFiles'
import { MAIL_STATEMENTS_FOLDER, statementSettingsOf } from '../domain/statementsChoice'
import { onboardingStart, useOnboarding } from './useOnboarding'
import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import StepCard from '../../../../shared/ui/StepCard.vue'
/**
 * The folder the books are saved in: the Picker opens at My Drive, and nothing is made until the
 * person confirms the folder, by its path from My Drive when the app may read the whole Drive, and by
 * its name and a link to it in Drive when it may not. "Create the file here" is the only action that writes.
 * When Drive already holds the books, it offers to open them instead.
 */
const onboarding = useOnboarding()
const store = useWorkbook()
const router = useRouter()
const { keeping, keepOnDrive } = useKeepOnDrive()

const picked = ref<PickedFolder | null>(null)
const picking = ref(false)
const failure = ref<string | null>(null)
const alreadyOnDrive = ref<BooksAlreadyOnDrive | null>(null)

const path = computed(() => onboarding.place.value.path)

/** What the new file holds: new books, the file brought along, or the books this browser keeps. Null when the page no longer holds it. */
const contents = computed(() => {
  if (path.value === 'new') return 'new'
  if (path.value === 'bring') return onboarding.heldFile.value?.document ?? null
  return store.state.choice?.source === 'browser' ? (store.state.snapshot?.document ?? null) : null
})

const folderLink = computed(() => (picked.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(picked.value.id)}`))

/** Opening the books on Drive deletes the ones kept in this browser, as any switch to Drive does. */
const dropsBrowserBooks = computed(() => store.state.choice?.source === 'browser')

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

/** Statements from mail go into a folder the app makes beside the new books, which `drive.file` can read. */
const fromMail = computed(() => onboarding.place.value.statements === 'mail')

async function create(): Promise<void> {
  const folder = picked.value
  const held = contents.value
  if (folder === null || held === null) return
  const { statements, mail } = onboarding.place.value
  const document = held === 'new' ? newBooksDocument(statementSettingsOf(statements, mail, today()), new Date().toISOString()) : held
  failure.value = null
  alreadyOnDrive.value = null
  let kept = false
  try {
    kept = await withGoogleAccess(['drive.file'], () => keepOnDrive(folder, document, path.value === 'new' ? 'created' : 'moved', fromMail.value ? [MAIL_STATEMENTS_FOLDER] : []))
  } catch (refused) {
    failed(refused)
  }
  if (kept) {
    await (path.value === 'move' ? onboarding.finish() : onboarding.made())
  }
}
</script>

<template>
  <StepCard title="Where the books are saved" subtitle="The Picker opens at My Drive. Nothing is made until you confirm the folder.">
    <UAlert
      v-if="contents === null"
      icon="i-lucide-file-question"
      color="warning"
      variant="subtle"
      :title="path === 'bring' ? 'Open the file again' : 'There are no books in this browser to move'"
      :description="path === 'bring' ? 'The page let go of the file on the way to Google. Go back and open it again.' : 'Choose your books on Settings, Books file.'"
    />
    <template v-else-if="picked">
      <div class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="onboarding-folder-confirm">
        <p class="text-sm text-muted">Your books will be saved in</p>
        <p v-if="picked.path" class="identifier text-sm font-medium break-words text-highlighted" data-testid="onboarding-folder-path">{{ folderTrail(picked.path) }}</p>
        <p v-else class="text-sm text-toned" data-testid="onboarding-folder-name">
          <span class="identifier font-medium text-highlighted">{{ picked.name }}</span
          >, inside folders the app cannot see. Open it in Drive to check where it is.
        </p>
        <p class="flex items-center gap-2 text-sm text-toned">
          <UIcon name="i-lucide-file-json" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span class="min-w-0"><span class="identifier">kuna-company.json</span>, with a backups folder beside it</span>
        </p>
        <p v-if="fromMail" class="flex items-center gap-2 text-sm text-toned" data-testid="onboarding-folder-statements">
          <UIcon name="i-lucide-folder-input" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span class="min-w-0"
            >A <span class="identifier">{{ MAIL_STATEMENTS_FOLDER }}</span> folder beside it, which each sync files the bank's mail into</span
          >
        </p>
        <a v-if="folderLink" :href="folderLink" target="_blank" rel="noopener" class="inline-target folder-link text-sm" data-testid="onboarding-folder-link">
          Open this folder in Drive
          <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </template>
    <p v-else class="text-sm text-toned">Choose the folder the books go in. The app writes only its file there, the backups folder beside it{{ fromMail ? ' and the statements folder' : '' }}.</p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="That did not work" :description="failure" data-testid="onboarding-folder-failure" />
    <UAlert
      v-if="alreadyOnDrive"
      icon="i-lucide-hard-drive"
      color="warning"
      variant="subtle"
      title="Your books are on Drive already"
      :description="
        dropsBrowserBooks
          ? `${alreadyOnDrive.message} Opening that file deletes the books in this browser, which exist only here and in the files you exported. Export them first if you want to keep them.`
          : alreadyOnDrive.message
      "
      data-testid="onboarding-folder-on-drive"
    />

    <template #actions>
      <template v-if="alreadyOnDrive">
        <UButton label="Choose a folder again" color="neutral" variant="outline" :loading="picking" @click="choose" />
        <UButton label="Open the books on Drive" icon="i-lucide-folder-open" data-testid="onboarding-open-on-drive" @click="router.push(onboardingStart('open', 'find'))" />
      </template>
      <template v-else-if="picked && contents !== null">
        <UButton label="Choose another" color="neutral" variant="outline" :loading="picking" :disabled="keeping" data-testid="onboarding-folder-another" @click="choose" />
        <UButton label="Create the file here" icon="i-lucide-hard-drive-upload" :loading="keeping" data-testid="onboarding-create" @click="create" />
      </template>
      <UButton v-else label="Choose a folder in Google Drive" icon="i-lucide-folder-search" :loading="picking" :disabled="contents === null" data-testid="onboarding-choose-folder" @click="choose" />
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
