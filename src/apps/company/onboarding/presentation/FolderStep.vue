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
import { words } from './words'
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
  <StepCard :title="words.folder.title" :subtitle="words.folder.subtitle">
    <UAlert
      v-if="contents === null"
      icon="i-lucide-file-question"
      color="warning"
      variant="subtle"
      :title="path === 'bring' ? words.folder.reopen : words.folder.nothingToMove"
      :description="path === 'bring' ? words.folder.reopenNote : words.folder.nothingToMoveNote"
    />
    <template v-else-if="picked">
      <div class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="onboarding-folder-confirm">
        <p class="text-sm text-muted">{{ words.folder.savedIn }}</p>
        <p v-if="picked.path" class="identifier text-sm font-medium break-words text-highlighted" data-testid="onboarding-folder-path">{{ folderTrail(picked.path) }}</p>
        <p v-else class="text-sm text-toned" data-testid="onboarding-folder-name">
          <span class="identifier font-medium text-highlighted">{{ picked.name }}</span
          >{{ words.folder.unseen }}
        </p>
        <p class="flex items-center gap-2 text-sm text-toned">
          <UIcon name="i-lucide-file-json" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span class="min-w-0"><span class="identifier">kuna-company.json</span>{{ words.folder.withBackups }}</span>
        </p>
        <p v-if="fromMail" class="flex items-center gap-2 text-sm text-toned" data-testid="onboarding-folder-statements">
          <UIcon name="i-lucide-folder-input" class="size-4 shrink-0 text-muted" aria-hidden="true" />
          <span class="min-w-0"
            >{{ words.folder.statementsBefore }}<span class="identifier">{{ MAIL_STATEMENTS_FOLDER }}</span
            >{{ words.folder.statementsAfter }}</span
          >
        </p>
        <a v-if="folderLink" :href="folderLink" target="_blank" rel="noopener" class="inline-target folder-link text-sm" data-testid="onboarding-folder-link">
          {{ words.folder.openFolder }}
          <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
        </a>
      </div>
    </template>
    <p v-else class="text-sm text-toned">{{ words.folder.choose(fromMail) }}</p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.failed" :description="failure" data-testid="onboarding-folder-failure" />
    <UAlert
      v-if="alreadyOnDrive"
      icon="i-lucide-hard-drive"
      color="warning"
      variant="subtle"
      :title="words.folder.onDrive"
      :description="dropsBrowserBooks ? words.folder.onDriveDrops(alreadyOnDrive.message) : alreadyOnDrive.message"
      data-testid="onboarding-folder-on-drive"
    />

    <template #actions>
      <template v-if="alreadyOnDrive">
        <UButton :label="words.folder.chooseAgain" color="neutral" variant="outline" :loading="picking" @click="choose" />
        <UButton :label="words.folder.openOnDrive" icon="i-lucide-folder-open" data-testid="onboarding-open-on-drive" @click="router.push(onboardingStart('open', 'find'))" />
      </template>
      <template v-else-if="picked && contents !== null">
        <UButton :label="words.folder.chooseAnother" color="neutral" variant="outline" :loading="picking" :disabled="keeping" data-testid="onboarding-folder-another" @click="choose" />
        <UButton :label="words.folder.create" icon="i-lucide-hard-drive-upload" :loading="keeping" data-testid="onboarding-create" @click="create" />
      </template>
      <UButton v-else :label="words.folder.chooseFirst" icon="i-lucide-folder-search" :loading="picking" :disabled="contents === null" data-testid="onboarding-choose-folder" @click="choose" />
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
