<script setup lang="ts">
import { computed } from 'vue'

import { yearlyCosts } from '../domain/yearlyCosts'
import type { FundTer } from '../../holdings/domain/fundTer'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import type { DayValuer } from '../../performance/domain/portfolioPerformance'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { words } from './words'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { shareOfDecimalPercent } from '../../../../shared/money/percent'
import { formatCostShare, formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Each year's trading, exchange and account fees, the funds' costs estimated from their TER, and the total's share of the year's average value. */
const props = defineProps<{
  sources: PortfolioSources
  valuedOn: DayValuer
}>()

const text = words.costs
const { facts } = usePortfolio()
const years = computed(() => yearlyCosts(props.sources, props.valuedOn, facts.value))
const thisYear = computed(() => yearOf(props.sources.today))
/** A TER is in percent, so 0.2 is 0.20%. A fetched one names the vendor that gave it. */
function terOf(ter: FundTer): string {
  const rate = formatCostShare(shareOfDecimalPercent(ter.percent))
  return ter.vendor === null ? text.ter(rate) : text.fetchedTer(rate, PRICE_VENDORS.find((vendor) => vendor.id === ter.vendor)?.name ?? ter.vendor)
}
</script>

<template>
  <AppCard
    :title="text.title"
    :subtitle="text.subtitle"
    collapse-id="investments.performance.costs"
    :summary="plural(words.byYear.summary(years.length), years.length)"
    class="max-w-measure"
    data-testid="costs-years"
  >
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.cost }}</th>
          <th scope="col" class="text-end">{{ text.amount }}</th>
        </tr>
      </thead>
      <tbody v-for="year in years" :key="year.year" data-testid="costs-year">
        <tr class="group-row">
          <th scope="rowgroup" class="cell-wraps text-start">
            {{ year.year }}
            <span v-if="year.year === thisYear" class="type-caption font-normal">{{ words.soFar }}</span>
            <span v-if="year.share !== null" class="block type-caption font-normal">{{ text.ofAverage(formatCostShare(year.share), formatMoney(year.averageValue)) }}</span>
          </th>
          <td class="text-end align-top"><MoneyText :cents="year.total" /></td>
        </tr>
        <tr>
          <th scope="row" class="text-start font-normal text-toned">{{ text.trading }}</th>
          <td class="text-end"><MoneyText :cents="year.trading" /></td>
        </tr>
        <tr>
          <th scope="row" class="cell-wraps text-start font-normal text-toned">
            {{ text.exchange }}
            <span v-if="year.unratedExchanges > 0" class="block type-caption text-warning" data-testid="costs-unrated">{{
              plural(text.unratedExchanges(year.unratedExchanges), year.unratedExchanges)
            }}</span>
          </th>
          <td class="text-end align-top"><MoneyText :cents="year.exchange" /></td>
        </tr>
        <tr>
          <th scope="row" class="text-start font-normal text-toned">{{ text.account }}</th>
          <td class="text-end"><MoneyText :cents="year.account" /></td>
        </tr>
        <tr>
          <th scope="row" class="cell-wraps text-start font-normal text-toned">
            {{ text.funds }}
            <span v-for="fund in year.unpricedFunds" :key="fund.id" class="block type-caption text-warning" data-testid="costs-unpriced">{{ text.unpricedFund(fund.name) }}</span>
          </th>
          <td class="text-end align-top"><MoneyText :cents="year.fundCosts" /></td>
        </tr>
        <tr v-for="fund in year.funds" :key="fund.instrument.id" class="type-caption" data-testid="costs-fund">
          <th scope="row" class="cell-wraps text-start font-normal">
            <span class="block ps-4">
              {{ fund.instrument.name }}
              <span class="block">{{ terOf(fund.ter) }}</span>
            </span>
          </th>
          <td class="text-end align-top"><MoneyText :cents="fund.cost" /></td>
        </tr>
      </tbody>
    </FigureTable>
    <p class="px-4 pb-4 type-caption sm:px-5" data-testid="costs-inside-price">{{ text.insidePrice }}</p>
  </AppCard>
</template>
