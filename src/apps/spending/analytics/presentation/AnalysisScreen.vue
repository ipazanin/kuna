<script setup lang="ts">
import { computed } from 'vue'

import BreakdownPanel from './BreakdownPanel.vue'
import OverTimePanel from './OverTimePanel.vue'
import SavingsPanel from './SavingsPanel.vue'
import YearAgainstYearPanel from './YearAgainstYearPanel.vue'
import { words } from './words'
import { spendingFigures } from '../domain/spendingFigures'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import ItemsMoveNotice from '../../workbook/presentation/ItemsMoveNotice.vue'
import { today } from '../../../../shared/calendar/civilDate'
import { anchorWindow } from '../../../../shared/calendar/ledgerWindow'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Spending's money over any span by any grouping, one category over time and against last year, and how much of the money in stays. */
const { state } = useSpendingBooks()
const rates = useRates()
const day = today()

const TABS: readonly PageTab[] = [
  { value: 'breakdown', label: words.analysis.tabs.breakdown, icon: 'i-lucide-chart-bar' },
  { value: 'over-time', label: words.analysis.tabs.overTime, icon: 'i-lucide-trending-up' },
  { value: 'year', label: words.analysis.tabs.year, icon: 'i-lucide-calendar-range' },
  { value: 'savings', label: words.analysis.tabs.savings, icon: 'i-lucide-piggy-bank' },
]

const loading = computed(() => state.workbook === null && state.status !== 'error')
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const figures = computed(() => (state.workbook === null ? null : spendingFigures(state.workbook, everydayRates(rates.value))))
/** From the book's first row, which it keeps oldest first, to today, whose month is the one still filling. */
const ledger = computed(() => {
  const first = state.workbook?.transactions[0]
  return first === undefined ? null : anchorWindow(first.date < day ? first.date : day, day)
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="screenWords.analysis" :description="words.analysis.description" />
    <ItemsMoveNotice />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="2" data-testid="spending-analysis-loading" />
    <template v-else-if="state.workbook !== null && figures !== null">
      <EmptyState v-if="ledger === null" icon="i-lucide-chart-bar" :title="words.analysis.empty.title" :description="words.analysis.empty.description" data-testid="spending-analysis-empty" />
      <PageTabs v-else :tabs="TABS" :label="words.analysis.tabs.label">
        <template #breakdown>
          <BreakdownPanel :book="state.workbook" :figures="figures" :window="ledger" :waiting="waiting" />
        </template>
        <template #over-time>
          <OverTimePanel :book="state.workbook" :figures="figures" :window="ledger" :waiting="waiting" :day="day" />
        </template>
        <template #year>
          <YearAgainstYearPanel :book="state.workbook" :figures="figures" :window="ledger" :waiting="waiting" :day="day" />
        </template>
        <template #savings>
          <SavingsPanel :figures="figures" :window="ledger" :waiting="waiting" :day="day" />
        </template>
      </PageTabs>
    </template>
  </section>
</template>
