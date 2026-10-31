<script setup lang="ts">
import { ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import FileDrop from '../../../../shared/ui/FileDrop.vue'

/** The workbook picked or dropped, read at once, with what was read or why it cannot be imported. */
const props = defineProps<{
  workbookImport: WorkbookImport
}>()

const { fileName, loading, failure, reading } = props.workbookImport
const picked = ref<File | null>(null)

/** The fake build offers its made-up workbook. The check is written inline, so a production build drops the sample. */
const offersSample = import.meta.env.VITE_FAKE_WORKBOOK === 'true'

watch(picked, (file) => {
  if (file !== null) void props.workbookImport.load(file.name, () => file.arrayBuffer())
})

async function loadSample(): Promise<void> {
  if (import.meta.env.VITE_FAKE_WORKBOOK !== 'true') return
  const sample = await import('../infrastructure/fake/sampleWorkbook')
  await props.workbookImport.load(sample.SAMPLE_WORKBOOK_FILE_NAME, () => sample.sampleWorkbookFile())
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="import-file">
    <p class="type-body">{{ words.file.intro }}</p>
    <FileDrop v-model="picked" accept=".xlsx,.xls,.ods" icon="i-lucide-file-spreadsheet" :label="words.file.drop" :description="words.file.orChoose" />
    <UButton
      v-if="offersSample"
      :label="words.file.sample"
      icon="i-lucide-file-spreadsheet"
      color="neutral"
      variant="link"
      class="self-start"
      data-testid="import-sample-workbook"
      @click="loadSample"
    />
    <p v-if="loading" class="flex items-center gap-2 type-body">
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
      {{ words.file.reading }}
    </p>
    <UAlert v-if="failure" icon="i-lucide-triangle-alert" color="error" variant="subtle" :title="failure" data-testid="import-failure" />
    <p v-if="reading" class="flex items-center gap-2 type-body" data-testid="import-loaded">
      <UIcon name="i-lucide-file-check" class="size-4 shrink-0 text-success" aria-hidden="true" />
      <span class="min-w-0 break-words">{{ plural(words.file.read(reading.rows.length + reading.skipped.length, fileName), reading.rows.length + reading.skipped.length) }}</span>
    </p>
  </div>
</template>
