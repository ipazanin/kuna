<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { MAIL_READER_WRITES } from '../application/mailReaderWrites'
import { useMailReports } from './useMailReports'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import WorkbookImportDialog from '../../imports/presentation/WorkbookImportDialog.vue'
import type { ReportReview } from '../../imports/presentation/WorkbookImportDialog.vue'

/** What the last sync's report holds for the person, with the way into its review. Nothing shows while it holds nothing. */
const { reading, news, reader } = useMailReports()
const reviewing = ref(false)

const line = computed(() => {
  const counts = news.value
  if (counts === null) return ''
  const parts = [
    [counts.fresh, words.review.fresh],
    [counts.changed, words.review.changed],
    [counts.asked, words.review.asked],
  ] as const
  return parts.flatMap(([count, forms]) => (count === 0 ? [] : [plural(forms(count), count)])).join(' ')
})

const report = computed((): ReportReview | null => {
  const rows = reading.value
  const current = reader.value
  if (rows === null || current === null) return null
  return {
    words: { title: words.review.title, description: words.review.description, accept: words.review.accept, accepted: words.review.accepted, notAccepted: words.review.notAccepted },
    fileName: words.card.title,
    reading: rows,
    writeLeftOut: (unit, keys) => unit.of(MAIL_READER_WRITES).change(current, { ...current, leftOut: [...current.leftOut, ...keys] }),
  }
})
</script>

<template>
  <UAlert v-if="line !== ''" icon="i-lucide-mail-check" color="info" variant="subtle" :title="line" data-testid="mail-report-review">
    <template #actions>
      <UButton :label="words.review.open" color="neutral" variant="outline" data-testid="mail-report-open" @click="reviewing = true" />
    </template>
  </UAlert>
  <WorkbookImportDialog v-if="report" v-model:open="reviewing" :report="report" />
</template>
