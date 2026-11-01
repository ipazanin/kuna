<script setup lang="ts">
import { computed } from 'vue'

import { withheldByCountry } from '../domain/withheldByCountry'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { words } from './words'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { formatMoney, formatShare } from '../../../../shared/money/moneyFormat'
import { countryName } from '../../../../shared/text/countryName'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The tax withheld at source each year, by the country the payer's ISIN starts with. */
const props = defineProps<{
  sources: PortfolioSources
}>()

const text = words.withheld
const years = computed(() => withheldByCountry(props.sources.book, props.sources.today))
const thisYear = computed(() => yearOf(props.sources.today))
</script>

<template>
  <EmptyState v-if="years.length === 0" icon="i-lucide-landmark" :title="words.noIncome.title" :description="words.noIncome.description" data-testid="withheld-empty" />
  <AppCard
    v-else
    :title="text.title"
    :subtitle="text.subtitle"
    collapse-id="investments.performance.withheld"
    :summary="plural(words.byYear.summary(years.length), years.length)"
    class="max-w-measure"
    data-testid="withheld-countries"
  >
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.country }}</th>
          <th scope="col" class="hidden text-end @md:table-cell">{{ words.amounts.gross }}</th>
          <th scope="col" class="text-end">{{ words.amounts.withheld }}</th>
          <th scope="col" class="hidden text-end @md:table-cell">{{ words.amounts.received }}</th>
          <th scope="col" class="text-end">{{ text.share }}</th>
        </tr>
      </thead>
      <tbody v-for="year in years" :key="year.year" data-testid="withheld-year">
        <tr>
          <th scope="rowgroup" colspan="5" class="pt-4 text-start font-medium text-highlighted">
            {{ year.year }}
            <span v-if="year.year === thisYear" class="type-caption font-normal">{{ words.soFar }}</span>
          </th>
        </tr>
        <tr v-for="row in year.countries" :key="row.country ?? ''" data-testid="withheld-country">
          <th scope="row" class="cell-wraps text-start font-normal text-toned">{{ row.country === null ? text.noIsin : countryName(row.country) }}</th>
          <td class="hidden text-end @md:table-cell"><MoneyText :cents="row.gross" /></td>
          <td class="cell-wraps text-end">
            <MoneyText :cents="row.withheld" />
            <span class="block type-caption @md:hidden">{{ text.ofGross(formatMoney(row.gross)) }}</span>
          </td>
          <td class="hidden text-end @md:table-cell"><MoneyText :cents="row.received" /></td>
          <td class="figure text-end">{{ row.share === null ? '–' : formatShare(row.share) }}</td>
        </tr>
      </tbody>
    </FigureTable>
  </AppCard>
</template>
