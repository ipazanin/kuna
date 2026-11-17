<script setup lang="ts">
import { computed } from 'vue'

import { gainSources } from '../domain/gainSources'
import type { PortfolioFigures } from '../domain/portfolioFigures'
import { words } from './words'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The total gain in its five parts, with the trading fees that are already inside them. The table keeps a short measure, so an amount stays near its label across a wide screen. */
const props = defineProps<{
  figures: PortfolioFigures
}>()

const sources = computed(() => gainSources(props.figures))
</script>

<template>
  <AppCard :title="words.gain.title" :subtitle="words.gain.subtitle" data-testid="investments-gain-sources">
    <FigureTable class="mt-2 max-w-2xl px-1 sm:px-2" :label="words.gain.title">
      <tbody>
        <tr v-for="part in sources.parts" :key="part.source" :data-source="part.source">
          <th scope="row" class="cell-wraps text-start font-normal text-highlighted">{{ words.gain.sources[part.source] }}</th>
          <td class="text-end"><MoneyText :cents="part.amount" tone="outcome" /></td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <th scope="row" class="text-start">{{ words.gain.total }}</th>
          <td class="text-end"><MoneyText :cents="sources.total" tone="outcome" /></td>
        </tr>
      </tfoot>
    </FigureTable>
    <div class="mt-auto flex flex-col gap-1 px-4 pt-2 pb-4 type-caption sm:px-5">
      <p>{{ words.gain.tradingFees(formatMoney(sources.tradingFees)) }}</p>
      <p v-if="!sources.addsUp" class="text-warning">{{ words.gain.notAddingUp }}</p>
    </div>
  </AppCard>
</template>
