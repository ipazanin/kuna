<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'

import { withGoogleAccess } from '../../../../shared/google/withGoogleAccess'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import type { DriveFilePlace } from '../../../../shared/storage/application/workbookPorts'
import { useWorkbook } from '../../workbook/application/workbookStore'
import StepCard from './StepCard.vue'
import { useOnboarding } from './useOnboarding'

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
const phone = usePhoneLayout()

const held = computed(() => {
  const transactions = store.state.workbook?.transactions.length ?? 0
  const records = Object.values(store.state.snapshot?.document.records ?? {}).reduce((sum, kind) => sum + kind.length, 0)
  return `They hold ${transactions} ${transactions === 1 ? 'transaction' : 'transactions'} and ${records} ${records === 1 ? 'record' : 'records'} in all.`
})

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
  <StepCard title="Your books are made" subtitle="Continue goes on with them and makes nothing new.">
    <div v-if="books" class="flex flex-col gap-2 rounded-control border border-default bg-elevated/40 px-3 py-3" data-testid="onboarding-made">
      <template v-if="onDrive">
        <p class="text-sm text-muted">Your books are saved in</p>
        <p v-if="where" class="identifier text-sm font-medium break-words text-highlighted" data-testid="onboarding-made-folder">{{ where.folderName }}</p>
        <p v-else class="text-sm text-toned">a folder on Google Drive</p>
      </template>
      <p v-else class="text-sm text-muted">Your books are kept in this browser</p>
      <p class="flex items-center gap-2 text-sm text-toned">
        <UIcon :name="onDrive ? 'i-lucide-file-json' : 'i-lucide-monitor-smartphone'" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="min-w-0 break-words" :class="{ identifier: onDrive }">{{ books.name }}</span>
      </p>
      <a v-if="folderLink" :href="folderLink" target="_blank" rel="noopener" class="inline-target folder-link text-sm">
        Open this folder in Drive
        <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
      </a>
    </div>
    <p class="text-sm text-toned">
      {{
        onDrive
          ? 'Start over trashes this file in Drive, where the bin keeps it for 30 days, so you can choose again.'
          : 'Start over removes these books from this browser, so you can choose again.'
      }}
    </p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" title="Start over did not work" :description="failure" />

    <template #actions>
      <UButton label="Start over" icon="i-lucide-rotate-ccw" color="neutral" variant="outline" :loading="dropping" data-testid="onboarding-start-over" @click="confirming = true" />
      <UButton label="Continue" trailing-icon="i-lucide-arrow-right" :disabled="dropping" data-testid="onboarding-continue" @click="onboarding.next()" />
    </template>
  </StepCard>

  <UModal
    v-model:open="confirming"
    :title="onDrive ? `Trash ${books?.name ?? 'the file'}` : 'Delete the books in this browser'"
    :description="onDrive ? 'The file moves to the Drive bin, where you can restore it for 30 days.' : 'The books are deleted from this browser and cannot be recovered.'"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <UAlert icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="held" data-testid="onboarding-start-over-holds" />
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton label="Keep them" color="neutral" variant="ghost" :disabled="dropping" data-testid="onboarding-keep-books" @click="confirming = false" />
        <UButton
          :label="onDrive ? 'Trash the file' : 'Delete the books'"
          icon="i-lucide-trash-2"
          color="error"
          :loading="dropping"
          data-testid="onboarding-confirm-start-over"
          @click="startOver"
        />
      </div>
    </template>
  </UModal>
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
