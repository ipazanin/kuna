<script setup lang="ts">
import { computed } from 'vue'

import type { PeriodGains } from '../domain/periodGains'
import { words } from './words'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'

/** Each holding's gain on what it holds at the end, split into its price and its currency, then the cash's currency effect and the portfolio's. */
const props = defineProps<{
  gains: PeriodGains
}>()

const text = words.currencyEffect
const DASH = '–'

const rows = computed(() => [
  ...props.gains.holdings
    .filter((holding) => holding.price !== 0 || holding.currency !== 0)
    .map((holding) => ({ key: holding.instrument.id, label: holding.instrument.name, price: formatMoney(holding.price, 'always'), currency: formatMoney(holding.currency, 'always') })),
  ...(props.gains.currencyOnCash === 0 ? [] : [{ key: 'cash', label: text.cash, price: DASH, currency: formatMoney(props.gains.currencyOnCash, 'always') }]),
])
const moved = computed(() => props.gains.currencyOnCash !== 0 || props.gains.holdings.some((holding) => holding.currency !== 0))
</script>

<template>
  <AppCard :title="text.title" :subtitle="text.subtitle" data-testid="performance-currency">
    <EmptyState v-if="!moved" class="mx-4 mb-4 sm:mx-5" icon="i-lucide-arrow-left-right" :title="text.noneTitle" :description="text.noneDescription" />
    <FigureTable v-else class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.holding }}</th>
          <th scope="col" class="text-end">{{ text.price }}</th>
          <th scope="col" class="text-end">{{ text.currency }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" data-testid="performance-currency-row">
          <th scope="row" class="cell-wraps text-start font-normal text-toned">{{ row.label }}</th>
          <td class="figure text-end">{{ row.price }}</td>
          <td class="figure text-end">{{ row.currency }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" class="text-start">{{ text.portfolio }}</th>
          <td class="figure text-end">{{ formatMoney(gains.price, 'always') }}</td>
          <td class="figure text-end">{{ formatMoney(gains.currency, 'always') }}</td>
        </tr>
      </tfoot>
    </FigureTable>
  </AppCard>
</template>
