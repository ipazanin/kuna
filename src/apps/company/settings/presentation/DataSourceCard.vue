<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import BooksFileCard from '../../../../shared/storage/presentation/BooksFileCard.vue'
import SwitchSourceDialog from '../../data-source/presentation/SwitchSourceDialog.vue'
import { onboardingStart } from '../../onboarding/presentation/useOnboarding'
import ImportDialog from '../../workbook-files/presentation/ImportDialog.vue'
import { useExport } from '../../workbook-files/presentation/useExport'
import { useWorkbook } from '../../workbook/application/workbookStore'
import NewerFileNotice from '../../workbook/presentation/NewerFileNotice.vue'
import { WORKBOOK_FILE_TYPES } from '../../workbook/presentation/workbookFiles'

/** Settings, Books file: where the company's books are, with the export, the import and the switch to another source. */
const store = useWorkbook()
const { state } = store
const { exporting, exportNow } = useExport()

const source = computed(() => state.choice?.source ?? state.snapshot?.meta.source ?? null)

const router = useRouter()

/** Onboarding's Google access and folder steps keep the books in a new file on Drive. */
function moveToDrive(): void {
  void router.push(onboardingStart('move'))
}

const switching = ref(false)

const pickedFile = ref<File | null>(null)
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

function takeFile(event: Event): void {
  const input = event.target as HTMLInputElement
  pickedFile.value = input.files?.[0] ?? null
  input.value = ''
}
</script>

<template>
  <BooksFileCard title="Company books" :store="store" data-testid="data-source-card">
    <NewerFileNotice />
    <input ref="fileInput" type="file" :accept="WORKBOOK_FILE_TYPES" class="sr-only" tabindex="-1" aria-hidden="true" @change="takeFile" />
    <template #actions>
      <UButton icon="i-lucide-download" label="Export to Excel" color="neutral" variant="outline" size="sm" :loading="exporting" :disabled="exporting || state.workbook === null" @click="exportNow" />
      <UButton v-if="source === 'browser'" icon="i-lucide-file-input" label="Import a file" color="neutral" variant="outline" size="sm" @click="fileInput?.click()" />
      <UButton icon="i-lucide-arrow-left-right" label="Switch data source" color="neutral" variant="outline" size="sm" @click="switching = true" />
      <UButton
        v-if="source === 'browser'"
        icon="i-lucide-hard-drive-upload"
        label="Keep on Google Drive"
        color="neutral"
        variant="outline"
        size="sm"
        :disabled="state.workbook === null || state.writing"
        data-testid="keep-on-drive"
        @click="moveToDrive"
      />
    </template>
  </BooksFileCard>

  <SwitchSourceDialog v-model:open="switching" />
  <ImportDialog v-model:file="pickedFile" />
</template>
