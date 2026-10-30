<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import type { ImportPreview } from '../../workbook/presentation/workbookFiles'
import ProblemList from './ProblemList.vue'

/** What a file opened as books holds, its record counts by tab and the rows the app could not use, or why it was refused. */
const props = defineProps<{
  /** Null while the file is read. */
  preview: ImportPreview | null
  failure: string | null
  failureDetail: string
}>()

/** "settings, rules or clients". */
function inWords(tabs: readonly string[]): string {
  return tabs.length <= 1 ? (tabs[0] ?? '') : `${tabs.slice(0, -1).join(', ')} or ${tabs[tabs.length - 1]}`
}

const facts = computed(() => {
  const summary = props.preview?.summary
  if (summary === undefined) return []
  const range = summary.dateRange
  return [
    { label: 'Transactions', value: String(summary.transactionCount) },
    { label: 'Dates', value: range === null ? 'None yet' : `${dayLabel(range.from)} to ${dayLabel(range.to)}` },
    { label: summary.accounts.length === 1 ? 'Account' : 'Accounts', value: summary.accounts.length === 0 ? 'None yet' : summary.accounts.join(', ') },
    { label: 'Categories', value: String(summary.categoryCount) },
  ]
})
</script>

<template>
  <div data-testid="import-summary" class="flex flex-col gap-4">
    <p v-if="!preview && !failure" class="flex items-center gap-2 text-sm text-muted">
      <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin" aria-hidden="true" />
      Reading the file
    </p>

    <UAlert
      v-if="failure"
      data-testid="import-failure"
      icon="i-lucide-triangle-alert"
      color="error"
      variant="subtle"
      :title="failure"
      :description="failureDetail"
      :ui="{ description: 'figure break-words text-xs' }"
    />

    <template v-if="preview">
      <UAlert
        v-if="preview.summary.refusal"
        icon="i-lucide-file-x"
        color="error"
        variant="subtle"
        :title="preview.summary.refusal"
        description="Open an Excel download of the Google Sheet, a file the app exported, or a Kuna file from the backups folder."
      />
      <template v-else>
        <dl class="grid gap-px sm:grid-cols-2 overflow-hidden rounded-control border border-default bg-border">
          <div v-for="fact in facts" :key="fact.label" class="min-w-0 bg-raised px-3 py-2.5">
            <dt class="text-xs text-muted">{{ fact.label }}</dt>
            <dd class="figure mt-0.5 truncate text-sm font-medium text-highlighted" :title="fact.value">{{ fact.value }}</dd>
          </div>
        </dl>

        <section class="flex flex-col gap-2" data-testid="record-counts">
          <h3 class="text-sm font-medium text-highlighted">{{ preview.recordCount }} {{ preview.recordCount === 1 ? 'record' : 'records' }}, by tab</h3>
          <dl class="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-x-6 gap-y-1 text-sm">
            <div v-for="kind in preview.counts" :key="kind.name" class="flex min-w-0 items-baseline justify-between gap-3">
              <dt class="truncate text-toned">{{ kind.name }}</dt>
              <dd class="figure text-highlighted">{{ kind.count }}</dd>
            </div>
          </dl>
        </section>

        <p v-if="preview.summary.defaultedTabs.length" class="text-sm text-muted">
          No {{ inWords(preview.summary.defaultedTabs) }} tab, so {{ preview.summary.defaultedTabs.length === 1 ? 'it reads' : 'they read' }} as empty and the defaults apply.
        </p>

        <section v-if="preview.summary.problems.length" class="flex flex-col gap-2">
          <h3 class="text-sm font-medium text-highlighted">{{ preview.summary.problems.length }} {{ preview.summary.problems.length === 1 ? 'row' : 'rows' }} the app could not use as written</h3>
          <ProblemList :problems="preview.summary.problems" />
        </section>
        <p v-else class="flex items-center gap-2 text-sm text-toned">
          <UIcon name="i-lucide-check" class="size-4 text-success" aria-hidden="true" />
          Every row reads cleanly.
        </p>
        <slot />
      </template>
    </template>
  </div>
</template>
