<script setup lang="ts">
import { computed } from 'vue'

import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { words } from './words'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { plural } from '../../../../shared/text/translation'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import PricesStatus from '../../prices/presentation/PricesStatus.vue'

/** What the Investments file holds: for now how its prices stand, whether it holds any transaction, and the records it leaves out or doubts. */
const { state } = useInvestmentsBooks()

const loading = computed(() => state.workbook === null && state.status !== 'error')
const fileNote = computed(() => (state.choice?.source === 'drive' ? words.empty.onDrive(state.choice.name) : words.empty.inBrowser))
const problems = computed(() => state.workbook?.problems ?? [])
const problemLines = computed(() => problems.value.map((problem) => words.problems.line(problem.noun, problem.label, problem.reason)))
const noTransactions = computed(() => {
  const book = state.workbook?.book
  return book !== undefined && [book.trades, book.income, book.cashMovements, book.exchanges, book.transfers, book.splits, book.spinOffs].every((records) => records.length === 0)
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="investments-loading" />
    <template v-else-if="state.workbook !== null">
      <PricesStatus />
      <RecordProblemsAlert v-if="problems.length > 0" :title="plural(words.problems.title(problems.length), problems.length)" :lines="problemLines" data-testid="investments-problems" />
      <EmptyState v-if="noTransactions" icon="i-lucide-trending-up" :title="words.empty.title" data-testid="investments-empty">
        <template #description>
          <span class="block">{{ words.empty.description }}</span>
        </template>
        <template #actions>
          <span class="type-caption">{{ fileNote }}</span>
        </template>
      </EmptyState>
    </template>
  </section>
</template>
