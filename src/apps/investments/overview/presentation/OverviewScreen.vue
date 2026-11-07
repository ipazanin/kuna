<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { figuresClose } from '../../holdings/domain/portfolioFigures'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import WorkbookImportDialog from '../../imports/presentation/WorkbookImportDialog.vue'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import GainSourcesCard from './GainSourcesCard.vue'
import LatestTransactionsCard from './LatestTransactionsCard.vue'
import MoversCard from './MoversCard.vue'
import OverviewTiles from './OverviewTiles.vue'
import PortfolioChecksCard from './PortfolioChecksCard.vue'
import PricesNotice from './PricesNotice.vue'
import ValueOverTimeCard from './ValueOverTimeCard.vue'
import WhereTheMoneyIsCard from './WhereTheMoneyIsCard.vue'
import { words as importWords } from '../../imports/presentation/words'
import { words as transactionWords } from '../../transactions/presentation/words'
import { useTaxShown } from '../../tax/presentation/useTaxShown'
import { investmentsSetUp } from './investmentsSetUp'
import { words } from './words'
import { weekdayDayLabel } from '../../../../shared/calendar/dayLabel'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { fileKeptNote } from '../../../../shared/storage/presentation/fileKeptNote'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import GettingSetUpCard from '../../../../shared/ui/GettingSetUpCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import { usePricesFetchingLine } from '../../prices/presentation/fetchingLine'
import PricesStatus from '../../prices/presentation/PricesStatus.vue'

/** What the investments are worth and what they earned, at the last close, with how the prices stand, where the portfolio leans past a check and what needs a look. */
const { state } = useInvestmentsBooks()
const { sources, figures, facts } = usePortfolio()

const fileNote = computed(() => fileKeptNote(state.choice, words.empty))
const problems = computed(() => state.workbook?.problems ?? [])
const noTransactions = computed(() => state.workbook !== null && !hasTransactions(state.workbook.book))
/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && !noTransactions.value && figures.value === null))
const close = computed(() => (figures.value === null || noTransactions.value ? null : figuresClose(figures.value)))
const fetchingLine = usePricesFetchingLine()
const description = computed(() => fetchingLine.value ?? (close.value === null ? words.description : words.closeLine(weekdayDayLabel(close.value))))
const taxShown = useTaxShown()
const setUpLines = computed(() => (state.workbook === null ? [] : investmentsSetUp(state.workbook.book, figures.value, taxShown.value)))

const adding = ref(false)
const addingHeld = ref(false)
const importing = ref(false)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="description">
      <template v-if="state.workbook !== null && !noTransactions" #actions>
        <UButton v-if="!taxShown" :label="words.empty.addHoldings" icon="i-lucide-layers-plus" color="neutral" variant="outline" data-testid="investments-add-held" @click="addingHeld = true" />
        <UButton :label="importWords.open" icon="i-lucide-file-input" color="neutral" variant="outline" data-testid="investments-import" @click="importing = true" />
        <UButton :label="transactionWords.add" icon="i-lucide-plus" data-testid="investments-add-transaction" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="investments-loading" />
    <template v-else-if="state.workbook !== null">
      <PricesStatus />
      <RecordProblemsAlert v-if="problems.length > 0" :title="plural(words.problems.title(problems.length), problems.length)" :problems="problems" data-testid="investments-problems" />
      <EmptyState v-if="noTransactions" icon="i-lucide-trending-up" :title="words.empty.title" data-testid="investments-empty">
        <template #description>
          <span class="block">{{ words.empty.description }}</span>
          <span class="block">{{ words.empty.byHand }}</span>
          <span class="block">{{ words.empty.fullHistory }}</span>
        </template>
        <template #actions>
          <div class="flex flex-col items-center gap-4">
            <div class="flex flex-wrap justify-center gap-2">
              <UButton :label="words.empty.addHoldings" icon="i-lucide-plus" data-testid="investments-add-held" @click="addingHeld = true" />
              <UButton :label="words.empty.importHistory" icon="i-lucide-file-input" color="neutral" variant="outline" data-testid="investments-import" @click="importing = true" />
            </div>
            <span class="type-caption">{{ fileNote }}</span>
          </div>
        </template>
      </EmptyState>
      <template v-else-if="sources !== null && figures !== null">
        <GettingSetUpCard :lines="setUpLines" />
        <PricesNotice :book="sources.book" :figures="figures" />
        <OverviewTiles :sources="sources" :figures="figures" />
        <PortfolioChecksCard :sources="sources" :figures="figures" :facts="facts" />
        <DashboardGrid data-testid="investments-cards">
          <ValueOverTimeCard :sources="sources" class="@4xl:col-span-2" />
          <WhereTheMoneyIsCard :figures="figures" :book="sources.book" />
          <GainSourcesCard :figures="figures" />
          <MoversCard :figures="figures" />
          <LatestTransactionsCard :sources="sources" />
        </DashboardGrid>
      </template>
      <TransactionDialog v-model:open="adding" :book="state.workbook.book" :editing="null" />
      <TransactionDialog v-model:open="addingHeld" :book="state.workbook.book" :editing="null" already-held />
      <WorkbookImportDialog v-model:open="importing" />
    </template>
  </section>
</template>
