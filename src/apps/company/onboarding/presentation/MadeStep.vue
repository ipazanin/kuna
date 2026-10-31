<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import StepCard from '../../../../shared/ui/StepCard.vue'
import type { DriveFilePlace } from '../../../../shared/storage/application/workbookPorts'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { NEW_BOOKS_TITLE } from '../../workbook/presentation/workbookFiles'
import { words as settingsWords } from '../../settings/presentation/words'
import { words as storageWords } from '../../../../shared/storage/presentation/words'
import { useOnboarding } from './useOnboarding'
import { words } from './words'

/**
 * The step that made the books of this run, gone back to once they exist: where they are, Continue
 * on with them, or Start over, which trashes the file on Drive or removes the books from this
 * browser, so the step can make them again. Start over asks first and counts what the books hold,
 * since the browser's back button can reach this step after real work went into them.
 */
const onboarding = useOnboarding()
const store = useWorkbook()

const books = onboarding.madeBooks
const onDrive = computed(() => books.value?.source === 'drive')
const where = ref<DriveFilePlace | null>(null)
const folderLink = computed(() => (where.value === null ? null : `https://drive.google.com/drive/folders/${encodeURIComponent(where.value.folderId)}`))
const dropping = ref(false)
const failure = ref<string | null>(null)
const confirming = ref(false)

const held = computed(() => {
  const transactions = store.state.workbook?.transactions.length ?? 0
  const records = Object.values(store.state.snapshot?.document.records ?? {}).reduce((sum, kind) => sum + kind.length, 0)
  return words.made.holds(transactions, records)
})

/** New books kept in this browser carry the title Kuna stores for them, which shows in the language on screen. */
const shownName = computed(() => (books.value?.name === NEW_BOOKS_TITLE ? settingsWords.books.newBooks : (books.value?.name ?? '')))

onMounted(async () => {
  where.value = await store.driveFilePlace().catch(() => null)
})

async function startOver(): Promise<void> {
  const made = books.value
  if (made === null) return
  dropping.value = true
  failure.value = null
  try {
    await withGoogleAccess(made.source === 'drive' ? ['drive.file'] : [], () => store.dropWorkbook(made.id))
  } catch (refused) {
    failure.value = refused instanceof Error ? refused.message : String(refused)
  } finally {
    dropping.value = false
    confirming.value = false
  }
  if (store.state.status === 'error') {
    failure.value = store.state.error
  } else if (store.state.choice === null) {
    await onboarding.choose({ made: null })
  }
}
</script>

<template>
  <StepCard :title="words.made.title" :subtitle="words.made.subtitle">
    <div v-if="books" class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="onboarding-made">
      <template v-if="onDrive">
        <p class="text-sm text-muted">{{ words.made.savedIn }}</p>
        <p v-if="where" class="identifier text-sm font-medium break-words text-highlighted" data-testid="onboarding-made-folder">{{ where.folderName }}</p>
        <p v-else class="text-sm text-toned">{{ words.made.aDriveFolder }}</p>
      </template>
      <p v-else class="text-sm text-muted">{{ words.made.inBrowser }}</p>
      <p class="flex items-center gap-2 text-sm text-toned">
        <UIcon :name="onDrive ? 'i-lucide-file-json' : 'i-lucide-monitor-smartphone'" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0 break-words" :class="{ identifier: onDrive }">{{ shownName }}</span>
      </p>
      <a v-if="folderLink" :href="folderLink" target="_blank" rel="noopener" class="inline-target quiet-link text-sm">
        {{ storageWords.firstRun.folder.openFolder }}
        <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
      </a>
    </div>
    <p class="text-sm text-toned">{{ onDrive ? words.made.startOverDrive : words.made.startOverBrowser }}</p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="words.made.startOverFailed" :description="failure" />

    <template #actions>
      <UButton :label="words.made.startOver" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" :loading="dropping" data-testid="onboarding-start-over" @click="confirming = true" />
      <UButton :label="words.continue" trailing-icon="i-lucide-arrow-right" :disabled="dropping" data-testid="onboarding-continue" @click="onboarding.next()" />
    </template>
  </StepCard>

  <AppDialog v-model:open="confirming" :title="onDrive ? words.made.trash(books?.name ?? null) : words.made.deleteHere" :description="onDrive ? words.made.trashNote : words.made.deleteNote">
    <UAlert icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="held" data-testid="onboarding-start-over-holds" />
    <template #end>
      <UButton :label="words.made.keep" color="neutral" variant="ghost" :disabled="dropping" data-testid="onboarding-keep-books" @click="confirming = false" />
      <UButton
        :label="onDrive ? words.made.trashFile : words.made.deleteBooks"
        icon="i-lucide-trash-2"
        color="error"
        :loading="dropping"
        data-testid="onboarding-confirm-start-over"
        @click="startOver"
      />
    </template>
  </AppDialog>
</template>
