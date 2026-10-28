<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import type { PeriodPreset } from '../../filters/domain/periodPresets'
import { reviewPeriodOf } from '../../period-review/domain/periodReview'
import ComparePanel from '../../period-review/presentation/ComparePanel.vue'
import BreakdownPanel from '../../spending/presentation/BreakdownPanel.vue'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import OverTimePanel from '../../trends/presentation/OverTimePanel.vue'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'

const TABS: readonly PageTab[] = [
  { label: 'Breakdown', value: 'breakdown', icon: 'i-lucide-chart-bar' },
  { label: 'Over time', value: 'over-time', icon: 'i-lucide-trending-up' },
  { label: 'Compare', value: 'compare', icon: 'i-lucide-calendar-range' },
]

/** Compare sets a year, quarter or custom range against the one before it, so its bar offers only those. */
const COMPARE_PRESETS: readonly PeriodPreset[] = ['year', 'quarter', 'custom']

const ledger = useFilteredLedger()
const route = useRoute()

/** Every tab follows the one filter bar above them. Compare reads a rolling period as the last complete quarter, and the bar says so. */
const compareBar = computed(() => {
  const current = ledger.value
  return route.query.tab !== 'compare' || current === null ? null : { presets: COMPARE_PRESETS, shownPeriod: reviewPeriodOf(current.filters.period, current.window) }
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Analysis" description="Where the money goes, and whether it is getting better or worse." />
    <LedgerGate>
      <PageTabs v-if="ledger" :tabs="TABS" label="Breakdown, over time and compare">
        <template #above>
          <FilterBar :workbook="ledger.workbook" :window="ledger.window" v-bind="compareBar ?? {}" />
        </template>
        <template #breakdown>
          <BreakdownPanel />
        </template>
        <template #over-time>
          <OverTimePanel />
        </template>
        <template #compare>
          <ComparePanel />
        </template>
      </PageTabs>
    </LedgerGate>
  </section>
</template>
