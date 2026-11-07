<script setup lang="ts">
import { computed } from 'vue'

import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import { needsThePerson } from '../../prices/presentation/failureLines'
import MailReportCard from '../../mail/presentation/MailReportCard.vue'
import ImportClosesCard from '../../prices/presentation/ImportClosesCard.vue'
import LastFetchCard from '../../prices/presentation/LastFetchCard.vue'
import PriceVendorsCard from '../../prices/presentation/PriceVendorsCard.vue'
import { usePrices } from '../../prices/presentation/usePrices'
import AccountsCard from './AccountsCard.vue'
import BenchmarkCard from './BenchmarkCard.vue'
import ChecksCard from './ChecksCard.vue'
import HistoryCard from './HistoryCard.vue'
import InvestmentsBooksCard from './InvestmentsBooksCard.vue'
import { words } from './words'

/** The Investments settings: the file, accounts and benchmark, then on tabs of their own where the prices come from and the portfolio checks' thresholds. */
const prices = usePrices()
const waiting = computed(() => (prices.state.copy?.file.failures ?? []).filter(needsThePerson).length)
const tabs = computed(() => [
  { value: 'general', label: words.tabs.general, icon: 'i-lucide-settings' },
  { value: 'prices', label: words.tabs.prices, icon: 'i-lucide-chart-candlestick', count: waiting.value },
  { value: 'checks', label: words.tabs.checks, icon: 'i-lucide-list-checks' },
])
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="words.description" />
    <PageTabs :tabs="tabs" :label="words.tabs.label">
      <template #general>
        <div class="flex flex-col gap-6">
          <InvestmentsBooksCard />
          <AccountsCard />
          <MailReportCard />
          <BenchmarkCard />
          <HistoryCard />
        </div>
      </template>
      <template #prices>
        <div class="flex flex-col gap-6">
          <LastFetchCard />
          <PriceVendorsCard />
          <ImportClosesCard />
        </div>
      </template>
      <template #checks>
        <ChecksCard />
      </template>
    </PageTabs>
  </section>
</template>
