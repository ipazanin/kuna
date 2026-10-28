<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { REDIRECT_SIGN_IN_QUERY } from '../../../../shared/google/googleRedirect'
import { useMediaQuery } from '../../../../shared/layout/viewport'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ImportDialog from '../../workbook-files/presentation/ImportDialog.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { DriveFileLookup } from '../../../../shared/storage/application/workbookPorts'
import type { WorkbookSource } from '../../../../shared/storage/domain/recordsRead'
import { useFindDriveFile } from '../../workbook/presentation/useFindDriveFile'
import { WORKBOOK_FILE_TYPES } from '../../workbook/presentation/workbookFiles'
import { onboardingStart } from '../../onboarding/presentation/useOnboarding'

/** Where a workbook can come from: the file on Drive, a file to open, or new books, which onboarding sets up. Each action changes the workbook on screen. */
defineProps<{
  /** The source in use, which changes how the Drive choice is worded. Null while nothing is chosen. */
  current: WorkbookSource | null
}>()

const emit = defineEmits<{
  /** A new workbook is on screen. */
  chosen: []
}>()

const store = useWorkbook()
const router = useRouter()
const { findDriveFile } = useFindDriveFile()

const signInByRedirect = useMediaQuery(REDIRECT_SIGN_IN_QUERY)

const pickedFile = ref<File | null>(null)
const lookingUp = ref<DriveFileLookup | null>(null)

async function openFromDrive(lookup: DriveFileLookup): Promise<void> {
  lookingUp.value = lookup
  const opened = await findDriveFile(lookup)
  lookingUp.value = null
  if (opened) {
    emit('chosen')
  }
}

async function startNewBooks(): Promise<void> {
  emit('chosen')
  await router.push(onboardingStart('new', 'home'))
}
</script>

<template>
  <AppCard as="ul" class="choices" data-testid="data-source-choices">
    <li class="choice">
      <UIcon name="i-lucide-hard-drive" class="choice-icon" aria-hidden="true" />
      <div class="choice-body">
        <h3 class="text-sm font-medium text-highlighted">{{ current === 'drive' ? 'Open your books on Google Drive again' : 'Open your books on Google Drive' }}</h3>
        <p class="mt-1 text-sm text-muted">
          For books another device keeps on Drive. Sign in with Google, then Find the file opens the file the app marked as its books, or
          asks you to pick it when there is none. Pick another file lets you choose the .json file yourself. The app keeps a copy in this
          browser, and writes only that file and the backups folder beside it.
        </p>
      </div>
      <div class="choice-action">
        <div class="flex flex-col items-start gap-2 sm:items-stretch">
          <UButton
            label="Find the file"
            icon="i-lucide-log-in"
            color="neutral"
            variant="outline"
            :loading="lookingUp === 'find'"
            :disabled="store.state.status === 'syncing'"
            @click="openFromDrive('find')"
          />
          <UButton
            label="Pick another file"
            icon="i-lucide-file-search"
            color="neutral"
            variant="outline"
            :loading="lookingUp === 'pick'"
            :disabled="store.state.status === 'syncing'"
            @click="openFromDrive('pick')"
          />
        </div>
        <p v-if="signInByRedirect" class="mt-2 max-w-56 text-xs text-muted" data-testid="redirect-sign-in-note">
          Google may ask about cookies first, then brings you back here.
        </p>
      </div>
    </li>

    <li class="choice">
      <UIcon name="i-lucide-file-spreadsheet" class="choice-icon" aria-hidden="true" />
      <div class="choice-body">
        <h3 class="text-sm font-medium text-highlighted">Open a file</h3>
        <p class="mt-1 text-sm text-muted">
          An Excel workbook, such as a download of your Google Sheet, or a Kuna file from the backups folder. Check what it holds,
          then keep it on Google Drive or in this browser.
        </p>
        <UFileUpload
          v-model="pickedFile"
          :accept="WORKBOOK_FILE_TYPES"
          :preview="false"
          reset
          icon="i-lucide-file-up"
          label="Drop an .xlsx or .json file here"
          description="or click to choose one"
          color="neutral"
          class="mt-3 w-full"
          :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
        />
      </div>
    </li>

    <li class="choice">
      <UIcon name="i-lucide-file-plus" class="choice-icon" aria-hidden="true" />
      <div class="choice-body">
        <h3 class="text-sm font-medium text-highlighted">Start new books</h3>
        <p class="mt-1 text-sm text-muted">The default categories and no rows yet. A few questions set them up, then you import a bank statement.</p>
      </div>
      <div class="choice-action">
        <UButton label="Start new books" icon="i-lucide-file-plus" color="neutral" variant="outline" data-testid="start-new-books" @click="startNewBooks" />
      </div>
    </li>
  </AppCard>

  <ImportDialog v-model:file="pickedFile" @imported="emit('chosen')" />
</template>

<style scoped>
.choice {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.75rem 1rem;
  padding: 1.125rem 1rem;
}

@media (min-width: 640px) {
  .choice {
    flex-wrap: nowrap;
    padding: 1.25rem 1.25rem;
  }
}

.choice-body {
  min-width: 0;
  /* Full width beside the icon on a phone, so the button wraps below the text. */
  flex: 1 1 calc(100% - 2.25rem);
}

@media (min-width: 640px) {
  .choice-body {
    flex-basis: 0;
  }
}

.choice + .choice {
  border-top: 1px solid var(--border-default);
}

.choice-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  margin-top: 0.0625rem;
  color: var(--accent);
}

.choice-action {
  flex-shrink: 0;
  margin-inline-start: 2.25rem;
}

@media (min-width: 640px) {
  .choice-action {
    margin-inline-start: 0;
  }
}
</style>
