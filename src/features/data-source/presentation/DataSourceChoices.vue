<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFileUpload from '@nuxt/ui/components/FileUpload.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import AppCard from '../../../shared/ui/AppCard.vue'
import { downloadTemplate, emptyLocalWorkbook } from '../../excel/application/workbookFiles'
import ImportDialog from '../../excel/presentation/ImportDialog.vue'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { WorkbookSource } from '../../workbook/domain/workbook'
import { XLSX_MIME_TYPE } from '../../workbook/infrastructure/workbookFile'

/** The three places a workbook can come from. Each action changes the workbook on screen. */
defineProps<{
  /** The source in use, which changes how the Google choice is worded. Null on a first run. */
  current: WorkbookSource | null
}>()

const emit = defineEmits<{
  /** A new workbook is on screen. */
  chosen: []
}>()

const store = useWorkbook()
const toast = useToast()

const pickedFile = ref<File | null>(null)
const startingEmpty = ref(false)
const downloading = ref(false)

async function connectGoogle(): Promise<void> {
  const before = store.state.choice
  await store.chooseGoogleSheet()
  if (store.state.choice !== before && store.state.choice?.source === 'google') {
    emit('chosen')
  }
}

async function startEmpty(): Promise<void> {
  startingEmpty.value = true
  const { tabs, title } = emptyLocalWorkbook()
  await store.replaceLocalWorkbook(tabs, title)
  startingEmpty.value = false
  if (store.state.status !== 'error') {
    emit('chosen')
  }
}

async function getTemplate(): Promise<void> {
  downloading.value = true
  try {
    await downloadTemplate()
  } catch (failure) {
    toast.add({ title: 'The template could not be made', description: failure instanceof Error ? failure.message : String(failure), color: 'error' })
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <AppCard as="ul" class="choices" data-testid="data-source-choices">
    <li class="choice">
      <UIcon name="i-lucide-sheet" class="choice-icon" aria-hidden="true" />
      <div class="choice-body">
        <h3 class="text-sm font-medium text-highlighted">{{ current === 'google' ? 'Choose another Google Sheet' : 'Connect a Google Sheet' }}</h3>
        <p class="mt-1 text-sm text-muted">
          Sign in with Google and pick the Sheet. The app reads its ledger, categories, accounts, settings and rules tabs and keeps a copy in
          this browser. It writes only what you save: category and flagged_by on ledger rows you act on, rows on the rules tab, and rows on the
          settings tab, and only in the Sheet you pick.
        </p>
      </div>
      <UButton
        :label="current === 'google' ? 'Choose a Sheet' : 'Connect'"
        icon="i-lucide-log-in"
        color="neutral"
        variant="outline"
        :loading="store.state.status === 'syncing'"
        :disabled="store.state.status === 'syncing'"
        class="choice-action"
        @click="connectGoogle"
      />
    </li>

    <li class="choice">
      <UIcon name="i-lucide-file-spreadsheet" class="choice-icon" aria-hidden="true" />
      <div class="choice-body">
        <h3 class="text-sm font-medium text-highlighted">Open an Excel file</h3>
        <p class="mt-1 text-sm text-muted">
          Import a filled-in template. The workbook then lives in this browser, and you export it back to a file whenever you like.
        </p>
        <UFileUpload
          v-model="pickedFile"
          :accept="`.xlsx,${XLSX_MIME_TYPE}`"
          :preview="false"
          reset
          icon="i-lucide-file-up"
          label="Drop an .xlsx file here"
          description="or click to choose one"
          color="neutral"
          class="mt-3 w-full"
          :ui="{ base: 'min-h-28 border-dashed bg-elevated/40' }"
        />
        <UButton
          label="Download the empty template"
          icon="i-lucide-download"
          color="neutral"
          variant="link"
          size="sm"
          class="mt-2 -ms-2"
          :loading="downloading"
          @click="getTemplate"
        />
      </div>
    </li>

    <li class="choice">
      <UIcon name="i-lucide-file-plus" class="choice-icon" aria-hidden="true" />
      <div class="choice-body">
        <h3 class="text-sm font-medium text-highlighted">Start from the empty template</h3>
        <p class="mt-1 text-sm text-muted">
          An empty workbook in this browser with the default categories and settings. Set it up here, export it, fill the ledger in Excel, and
          import it again.
        </p>
      </div>
      <UButton label="Start empty" icon="i-lucide-plus" color="neutral" variant="outline" :loading="startingEmpty" class="choice-action" @click="startEmpty" />
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
