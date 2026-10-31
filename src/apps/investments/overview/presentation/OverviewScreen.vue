<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { figuresClose } from '../../holdings/domain/portfolioFigures'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import { words as transactionWords } from '../../transactions/presentation/words'
import GainSourcesCard from './GainSourcesCard.vue'
import LatestTransactionsCard from './LatestTransactionsCard.vue'
import MoversCard from './MoversCard.vue'
import OverviewTiles from './OverviewTiles.vue'
import PricesNotice from './PricesNotice.vue'
import ValueOverTimeCard from './ValueOverTimeCard.vue'
import WhereTheMoneyIsCard from './WhereTheMoneyIsCard.vue'
import { words } from './words'
import { weekdayDayLabel } from '../../../../shared/calendar/dayLabel'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import PricesStatus from '../../prices/presentation/PricesStatus.vue'

/** What the investments are worth and what they earned, at the last close, with how the prices stand and what needs a look. */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()

const fileNote = computed(() => (state.choice?.source === 'drive' ? words.empty.onDrive(state.choice.name) : words.empty.inBrowser))
const problems = computed(() => state.workbook?.problems ?? [])
const problemLines = computed(() => problems.value.map((problem) => words.problems.line(problem.noun, problem.label, problem.reason)))
const noTransactions = computed(() => state.workbook !== null && !hasTransactions(state.workbook.book))
/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && !noTransactions.value && figures.value === null))
const close = computed(() => (figures.value === null || noTransactions.value ? null : figuresClose(figures.value)))
const adding = ref(false)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="close === null ? words.description : words.closeLine(weekdayDayLabel(close))">
      <template v-if="state.workbook !== null && !noTransactions" #actions>
        <UButton :label="transactionWords.add" icon="i-lucide-plus" data-testid="investments-add-transaction" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="investments-loading" />
    <template v-else-if="state.workbook !== null">
      <PricesStatus />
      <RecordProblemsAlert v-if="problems.length > 0" :title="plural(words.problems.title(problems.length), problems.length)" :lines="problemLines" data-testid="investments-problems" />
      <EmptyState v-if="noTransactions" icon="i-lucide-trending-up" :title="words.empty.title" data-testid="investments-empty">
        <template #description>
          <span class="block">{{ words.empty.description }}</span>
        </template>
        <template #actions>
          <div class="flex flex-col items-center gap-4">
            <UButton :label="transactionWords.add" icon="i-lucide-plus" data-testid="investments-add-transaction" @click="adding = true" />
            <span class="type-caption">{{ fileNote }}</span>
          </div>
        </template>
      </EmptyState>
      <template v-else-if="sources !== null && figures !== null">
        <PricesNotice :book="sources.book" :figures="figures" />
        <OverviewTiles :sources="sources" :figures="figures" />
        <DashboardGrid data-testid="investments-cards">
          <ValueOverTimeCard :sources="sources" class="xl:col-span-2" />
          <WhereTheMoneyIsCard :figures="figures" />
          <GainSourcesCard :figures="figures" />
          <MoversCard :figures="figures" />
          <LatestTransactionsCard :sources="sources" />
        </DashboardGrid>
      </template>
      <TransactionDialog v-model:open="adding" :book="state.workbook.book" :editing="null" />
    </template>
  </section>
</template>
