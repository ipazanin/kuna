<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import type { WorkbookImport } from './useWorkbookImport'
import { words } from './words'
import { PORTFOLIO_TEMPLATE_FILE_NAME, portfolioTemplateFile } from '../infrastructure/portfolioTemplate'
import PricesProgress from '../../prices/presentation/PricesProgress.vue'
import { downloadFile } from '../../../../shared/files/downloadFile'
import { XLSX_MIME_TYPE } from '../../../../shared/xlsx/sheetGrids'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plural } from '../../../../shared/text/translation'
import FileDrop from '../../../../shared/ui/FileDrop.vue'

/** The workbook picked or dropped, read at once, with what was read or why it cannot be imported, and the ECB rates its rows need fetched before the next step. */
const props = defineProps<{
  workbookImport: WorkbookImport
}>()

const { fileName, loading, failure, reading, ratesFetch, fetching, settled, ready } = props.workbookImport

/** The splits a vendor lists for the workbook's split rows, which answer their questions. */
const listedSplits = computed(() => (ready.value ? (settled.value?.splits ?? []).flatMap((step) => (step.listed === null ? [] : [{ step, listed: step.listed }])) : []))
const picked = ref<File | null>(null)

/** The fake build offers its made-up workbook. The check is written inline, so a production build drops the sample. */
const offersSample = import.meta.env.VITE_FAKE_WORKBOOK === 'true'

watch(picked, (file) => {
  if (file !== null) void props.workbookImport.load(file.name, () => file.arrayBuffer())
})

const toast = useToast()
const downloading = ref(false)

async function downloadTemplate(): Promise<void> {
  if (downloading.value) return
  downloading.value = true
  try {
    downloadFile(await portfolioTemplateFile(words.template), PORTFOLIO_TEMPLATE_FILE_NAME, XLSX_MIME_TYPE)
  } catch (failure) {
    toast.add({ title: words.file.templateFailed, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error' })
  } finally {
    downloading.value = false
  }
}

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
      :label="words.file.template"
      icon="i-lucide-file-down"
      color="neutral"
      variant="link"
      class="self-start"
      :loading="downloading"
      data-testid="import-template-download"
      @click="downloadTemplate"
    />
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
    <div v-if="ratesFetch?.kind === 'fetching'" class="flex flex-col gap-2" data-testid="import-rates-fetching">
      <p class="type-body">{{ words.file.fetchingRates }}</p>
      <PricesProgress v-if="fetching" :fetching="fetching" />
    </div>
    <UAlert
      v-if="ratesFetch?.kind === 'failed'"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="subtle"
      :title="words.file.ratesFailed(ratesFetch.currencies.join(', '), dayLabel(ratesFetch.from))"
      data-testid="import-rates-failed"
    />
    <UButton
      v-if="ratesFetch?.kind === 'failed'"
      :label="words.file.tryAgain"
      icon="i-lucide-refresh-cw"
      color="neutral"
      variant="outline"
      class="self-start"
      data-testid="import-rates-retry"
      @click="workbookImport.fetchRates()"
    />
    <section v-if="listedSplits.length > 0" class="flex flex-col gap-1" data-testid="import-listed-splits">
      <h3 class="type-label">{{ words.questions.listedSplits }}</h3>
      <ul class="flex flex-col gap-1">
        <li v-for="{ step, listed } in listedSplits" :key="step.question.key" class="type-body">
          {{ words.questions.listedSplit(step.symbol ?? step.question.identity, dayLabel(step.question.date), listed.newUnits, listed.oldUnits, workbookImport.splitVendor) }}
        </li>
      </ul>
    </section>
  </div>
</template>
