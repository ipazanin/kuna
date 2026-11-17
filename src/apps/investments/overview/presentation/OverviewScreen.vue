<script setup lang="ts">
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { askChat } from '../../../../shared/ai/presentation/chatDock'
import { words as chatWords } from '../../../../shared/ai/presentation/words'
import { stillNew } from '../../../../shared/app/setUpLines'
import { words as assistantWords } from '../../assistant/words'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { figuresClose } from '../../holdings/domain/portfolioFigures'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import WorkbookImportDialog from '../../imports/presentation/WorkbookImportDialog.vue'
import MailReportReview from '../../mail/presentation/MailReportReview.vue'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import LatestTransactionsCard from './LatestTransactionsCard.vue'
import OverviewTiles from './OverviewTiles.vue'
import ValueOverTimeCard from './ValueOverTimeCard.vue'
import { holdingsList } from '../../holdings/domain/holdingsList'
import type { HoldingsSort } from '../../holdings/domain/holdingsList'
import { HOLDINGS_ROUTE } from '../../holdings/presentation/holdingLinks'
import HoldingsTable from '../../holdings/presentation/HoldingsTable.vue'
import PricesNotice from '../../holdings/presentation/PricesNotice.vue'
import { todayLine } from '../../holdings/presentation/holdingText'
import { useFetchToday } from '../../prices/presentation/useFetchToday'
import { words as pricesWords } from '../../prices/presentation/words'
import { words as importWords } from '../../imports/presentation/words'
import { words as transactionWords } from '../../transactions/presentation/words'
import { useTaxShown } from '../../tax/presentation/useTaxShown'
import { INVESTMENTS_PRICES_ROUTE } from './investmentLinks'
import { investmentsSetUp } from './investmentsSetUp'
import { words } from './words'
import { weekdayDayLabel } from '../../../../shared/calendar/dayLabel'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { fileKeptNote } from '../../../../shared/storage/presentation/fileKeptNote'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import GettingSetUpCard from '../../../../shared/ui/GettingSetUpCard.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import { usePricesFetchingLine } from '../../prices/presentation/fetchingLine'
import PricesStatus from '../../prices/presentation/PricesStatus.vue'

/** The day first: its change and what the investments are worth and earned, then each holding held with its day's change, the value over time and the latest transactions. */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()

const fileNote = computed(() => fileKeptNote(state.choice, words.empty))
const problems = computed(() => state.workbook?.problems ?? [])
const noTransactions = computed(() => state.workbook !== null && !hasTransactions(state.workbook.book))
/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && !noTransactions.value && figures.value === null))
const close = computed(() => (figures.value === null || noTransactions.value ? null : figuresClose(figures.value)))
const fetchingLine = usePricesFetchingLine()
const live = computed(() => (figures.value === null || noTransactions.value ? null : todayLine(figures.value.lastDay)))
const description = computed(() => fetchingLine.value ?? live.value ?? (close.value === null ? words.description : words.closeLine(weekdayDayLabel(close.value))))
const fetchToday = useFetchToday()
const taxShown = useTaxShown()
const setUpLines = computed(() => (state.workbook === null ? [] : investmentsSetUp(state.workbook.book, figures.value, taxShown.value)))

const heldSort = ref<HoldingsSort | null>(null)
const held = computed(() =>
  sources.value === null || figures.value === null ? null : holdingsList(figures.value, sources.value.book, { grouping: 'none', withCash: false, find: '', sort: heldSort.value }),
)

/** A collapsed list still says how many holdings it holds and what they are worth. */
const heldSummary = computed(() => {
  const count = held.value?.groups[0]?.lines.length ?? 0
  return held.value === null ? '' : plural(words.held.summary(count, formatMoney(held.value.total.value)), count)
})

const adding = ref(false)
const addingHeld = ref(false)
const importing = ref(false)
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="description">
      <template v-if="state.workbook !== null && !noTransactions" #actions>
        <UButton v-if="!taxShown" :label="words.empty.addHoldings" icon="i-lucide-layers-plus" color="neutral" variant="outline" data-testid="investments-add-held" @click="addingHeld = true" />
        <UButton
          :label="pricesWords.today.fetch"
          icon="i-lucide-refresh-cw"
          color="neutral"
          variant="outline"
          :loading="fetchToday.busy.value"
          :disabled="fetchToday.blocked.value !== null"
          :title="fetchToday.blocked.value?.line"
          data-testid="investments-fetch-today"
          @click="fetchToday.run()"
        />
        <UButton :label="importWords.open" icon="i-lucide-file-input" color="neutral" variant="outline" data-testid="investments-import" @click="importing = true" />
        <UButton :label="transactionWords.add" icon="i-lucide-plus" data-testid="investments-add-transaction" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="investments-loading" />
    <template v-else-if="state.workbook !== null">
      <PricesStatus />
      <MailReportReview />
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
              <AskChatButton :text="chatWords.ask.setUp" size="md" data-testid="set-up-chat" @ask="askChat(assistantWords.guides.setUp.title)" />
            </div>
            <span class="type-caption">{{ fileNote }}</span>
          </div>
        </template>
      </EmptyState>
      <template v-else-if="sources !== null && figures !== null">
        <GettingSetUpCard :lines="setUpLines">
          <template v-if="stillNew(setUpLines)" #actions>
            <AskChatButton :text="chatWords.ask.setUp" data-testid="set-up-chat" @ask="askChat(assistantWords.guides.setUp.title)" />
          </template>
        </GettingSetUpCard>
        <PricesNotice :book="sources.book" :figures="figures" />
        <NoteLine v-if="fetchToday.outcome.value !== null" tone="warning" role="status" data-testid="investments-fetch-today-note">{{ fetchToday.outcome.value }}</NoteLine>
        <NoteLine v-else-if="fetchToday.blocked.value !== null" :tone="fetchToday.blocked.value.opensPrices ? 'info' : 'muted'" data-testid="investments-fetch-today-note">
          {{ fetchToday.blocked.value.line }}
          <RouterLink v-if="fetchToday.blocked.value.opensPrices" :to="INVESTMENTS_PRICES_ROUTE" class="quiet-link inline-target" data-testid="investments-fetch-today-prices">{{
            pricesWords.advice.toSettings
          }}</RouterLink>
        </NoteLine>
        <OverviewTiles :sources="sources" :figures="figures" />
        <AppCard
          v-if="held !== null && held.groups.length > 0"
          :title="words.held.title"
          :subtitle="words.held.subtitle"
          collapse-id="overview.held"
          :summary="heldSummary"
          data-testid="investments-held"
        >
          <HoldingsTable v-model:sort="heldSort" :list="held" :quoted-day="figures.lastDay?.quoted === undefined ? null : figures.lastDay.to" without-cash />
          <div class="px-4 pb-4 sm:px-5">
            <UButton :to="HOLDINGS_ROUTE" :label="words.held.all" color="neutral" variant="link" trailing-icon="i-lucide-arrow-right" class="px-0" data-testid="investments-held-all" />
          </div>
        </AppCard>
        <DashboardGrid data-testid="investments-cards">
          <ValueOverTimeCard :sources="sources" />
          <LatestTransactionsCard :sources="sources" />
        </DashboardGrid>
      </template>
      <TransactionDialog v-model:open="adding" :book="state.workbook.book" :editing="null" />
      <TransactionDialog v-model:open="addingHeld" :book="state.workbook.book" :editing="null" already-held />
      <WorkbookImportDialog v-model:open="importing" />
    </template>
  </section>
</template>
