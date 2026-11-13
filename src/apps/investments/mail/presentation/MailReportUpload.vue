<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'

import { writeUploadLeftOut } from '../application/mailReaderWrites'
import { pickedReport } from '../application/mailReports'
import { IBKR_FLEX_RECIPE } from '../domain/ibkrFlexRecipe'
import { uploadedReportRows } from '../domain/reportRows'
import type { ReportFile } from '../domain/reportRows'
import { misfitLine, useMailReports } from './useMailReports'
import { words } from './words'
import WorkbookImportDialog from '../../imports/presentation/WorkbookImportDialog.vue'
import type { ReportReview } from '../../imports/presentation/WorkbookImportDialog.vue'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { readRecipeFile } from '../../../../shared/recipes/infrastructure/recipeFile'
import FileDrop from '../../../../shared/ui/FileDrop.vue'

/** A Flex report the person saved, read by the mail's recipe and accepted through the same review as a mailed one. */
const { reader } = useMailReports()
const store = useInvestmentsBooks()
const picked = ref<File | null>(null)
const uploaded = shallowRef<ReportFile | null>(null)
const failure = ref<string | null>(null)
const reviewing = ref(false)

watch(picked, async (file) => {
  if (file === null) return
  const read = pickedReport(IBKR_FLEX_RECIPE, file.name, readRecipeFile(IBKR_FLEX_RECIPE, await file.arrayBuffer()))
  failure.value = read.kind === 'misfit' ? misfitLine(file.name, read.misfit) : null
  if (read.kind === 'misfit') return
  uploaded.value = read.file
  await nextTick()
  reviewing.value = true
})

const report = computed((): ReportReview | null => {
  const file = uploaded.value
  if (file === null) return null
  const held = reader.value
  const book = store.state.workbook?.book ?? null
  if (book === null) return null
  return {
    words: { title: words.review.title, description: words.review.description, accept: words.review.accept, accepted: words.review.accepted, notAccepted: words.review.notAccepted },
    fileName: file.fileName,
    reading: uploadedReportRows(IBKR_FLEX_RECIPE, file, held),
    writeLeftOut: (unit, keys) => writeUploadLeftOut(unit, book, held, keys),
  }
})
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="mail-report-upload">
    <h3 class="type-card-title">{{ words.upload.title }}</h3>
    <p class="type-body text-muted">{{ words.upload.intro }}</p>
    <FileDrop v-model="picked" accept=".xml" icon="i-lucide-file-code" :label="words.upload.drop" :description="words.upload.orChoose" />
    <UAlert v-if="failure !== null" icon="i-lucide-file-x" color="error" variant="subtle" :title="failure" data-testid="mail-report-upload-failed" />
    <WorkbookImportDialog v-if="report" v-model:open="reviewing" :report="report" />
  </div>
</template>
