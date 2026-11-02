<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import type { PortfolioFigures } from '../domain/portfolioFigures'
import { holdingLink } from './holdingLinks'
import { treemapChart } from './treemapChart'
import { words } from './words'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatPercent, formatShare } from '../../../../shared/money/moneyFormat'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import type { ChartPointSelection } from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** Every holding held as a tile sized by its value and tinted by its gain, a tile opening its page, with a table of the same. */
const props = defineProps<{
  figures: PortfolioFigures
}>()

const router = useRouter()
const phone = usePhoneLayout()
const map = computed(() => treemapChart(props.figures, chartTokens()))

const steps = words.map.steps
const legend = (
  [
    [steps.lossLarge, 'loss-3'],
    [steps.lossMedium, 'loss-2'],
    [steps.lossSmall, 'loss-1'],
    [steps.gainSmall, 'gain-1'],
    [steps.gainMedium, 'gain-2'],
    [steps.gainLarge, 'gain-3'],
  ] as const
).map(([label, step]) => ({ label, colour: `var(--${step})`, mark: 'tile' as const }))

function open(selection: ChartPointSelection): void {
  const tile = map.value.tiles.find((entry) => entry.holding.instrument.id === selection.category)
  if (tile !== undefined) void router.push(holdingLink(tile.holding.instrument))
}
</script>

<template>
  <ChartCard
    :title="words.map.title"
    :subtitle="words.map.subtitle"
    :description="map.description"
    :option="map.option"
    :height="320"
    :phone-height="260"
    collapse-id="holdings.map"
    :start-collapsed="phone"
    data-testid="holdings-map"
    @select="open"
  >
    <template #legend><ChartLegend :entries="legend" /></template>
    <template #table>
      <caption class="sr-only">
        {{
          words.map.title
        }}
      </caption>
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.columns.holding }}</th>
          <th scope="col" class="text-end">{{ words.columns.value }}</th>
          <th scope="col" class="text-end">{{ words.columns.weight }}</th>
          <th scope="col" class="text-end">{{ words.columns.gain }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="tile in map.tiles" :key="tile.holding.instrument.id">
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink :to="holdingLink(tile.holding.instrument)" class="text-highlighted">{{ tile.holding.instrument.name }}</DrillLink>
          </th>
          <td class="text-end"><MoneyText :cents="tile.value" /></td>
          <td class="figure text-end">{{ tile.holding.weight === null ? '–' : formatShare(tile.holding.weight) }}</td>
          <td class="figure text-end">{{ tile.gain === null ? '–' : formatPercent(tile.gain, 'always') }}</td>
        </tr>
      </tbody>
    </template>
  </ChartCard>
</template>
