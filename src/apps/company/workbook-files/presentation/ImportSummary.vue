<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { ImportPreview } from '../../workbook/presentation/workbookFiles'
import { plural } from '../../../../shared/text/translation'
import CutText from '../../../../shared/ui/CutText.vue'
import ProblemList from './ProblemList.vue'
import { words } from './words'
import { words as toSortWords } from '../../categories/presentation/words'
import { TONE_ICONS } from '../../../../shared/ui/toneText'

/** What a file opened as books holds, its record counts by tab and the rows the app could not use, or why it was refused. */
const props = defineProps<{
  /** Null while the file is read. */
  preview: ImportPreview | null
  failure: string | null
  failureDetail: string
}>()

const facts = computed(() => {
  const summary = props.preview?.summary
  if (summary === undefined) return []
  const range = summary.dateRange
  return [
    { label: words.summary.transactions, value: String(summary.transactionCount) },
    { label: words.summary.dates, value: range === null ? words.summary.noneYet : words.summary.range(dayLabel(range.from), dayLabel(range.to)) },
    { label: summary.accounts.length === 1 ? words.summary.account : words.summary.accounts, value: summary.accounts.length === 0 ? words.summary.noneYet : summary.accounts.join(', ') },
    { label: words.summary.categories, value: String(summary.categoryCount) },
  ]
})
</script>

<template>
  <div data-testid="import-summary" class="flex flex-col gap-4">
    <p v-if="!preview && !failure" class="flex items-center gap-2 type-aside">
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
      {{ words.summary.reading }}
    </p>

    <UAlert
      v-if="failure"
      data-testid="import-failure"
      :icon="TONE_ICONS.error"
      color="error"
      variant="subtle"
      :title="failure"
      :description="failureDetail"
      :ui="{ description: 'figure break-words type-caption text-error' }"
    />

    <template v-if="preview">
      <UAlert v-if="preview.summary.refusal" icon="i-lucide-file-x" color="error" variant="subtle" :title="preview.summary.refusal" :description="words.summary.refusedHelp" />
      <template v-else>
        <dl class="grid gap-px sm:grid-cols-2 overflow-hidden rounded-control border border-default bg-border">
          <div v-for="fact in facts" :key="fact.label" class="min-w-0 bg-raised px-3 py-2.5">
            <dt class="type-caption">{{ fact.label }}</dt>
            <CutText as="dd" class="figure mt-0.5 type-card-title">{{ fact.value }}</CutText>
          </div>
        </dl>

        <section class="flex flex-col gap-2" data-testid="record-counts">
          <h3 class="type-card-title">{{ plural(words.summary.records(preview.recordCount), preview.recordCount) }}</h3>
          <dl class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-1 type-body">
            <div v-for="kind in preview.counts" :key="kind.name" class="flex min-w-0 items-baseline justify-between gap-3">
              <CutText as="dt" class="identifier text-toned">{{ kind.name }}</CutText>
              <dd class="figure text-highlighted">{{ kind.count }}</dd>
            </div>
          </dl>
        </section>

        <p v-if="preview.summary.defaultedTabs.length" class="type-aside">
          {{ words.summary.defaulted(preview.summary.defaultedTabs) }}
        </p>

        <section v-if="preview.summary.problems.length" class="flex flex-col gap-2">
          <h3 class="type-card-title">{{ plural(words.summary.problems(preview.summary.problems.length), preview.summary.problems.length) }}</h3>
          <ProblemList :problems="preview.summary.problems" />
        </section>
        <p v-else class="flex items-center gap-2 type-body">
          <UIcon name="i-lucide-check" class="size-4 text-success" aria-hidden="true" />
          {{ words.summary.clean }}
        </p>
        <section v-if="preview.summary.categoriesToSort.length" class="flex flex-col gap-2" data-testid="import-categories-to-sort">
          <h3 class="type-card-title">{{ toSortWords.categoriesToSort.title }}</h3>
          <p class="type-aside">{{ toSortWords.categoriesToSort.help }}</p>
          <ProblemList :problems="preview.summary.categoriesToSort" />
        </section>
        <slot />
      </template>
    </template>
  </div>
</template>
