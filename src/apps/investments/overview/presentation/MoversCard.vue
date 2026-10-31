<script setup lang="ts">
import { computed } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { lastDayMovers } from '../domain/overviewFigures'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { formatPercentChange } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'

/** The three holdings that rose most on the last day and the three that fell most, by share, each with its change in euros. */
const props = defineProps<{
  figures: PortfolioFigures
}>()

const MOVERS_EACH_WAY = 3

const movers = computed(() => lastDayMovers(props.figures, MOVERS_EACH_WAY))
const rows = computed(() => [...movers.value.up.map((holding) => ({ holding, rose: true })), ...movers.value.down.map((holding) => ({ holding, rose: false }))])
const lastDay = computed(() => props.figures.lastDay)
</script>

<template>
  <AppCard :title="words.movers.title" :subtitle="lastDay === null ? undefined : words.movers.subtitle(shortDayLabel(lastDay.to), shortDayLabel(lastDay.from))" data-testid="investments-movers">
    <p v-if="lastDay === null || rows.length === 0" class="px-4 pt-3 pb-4 type-body sm:px-5">{{ lastDay === null ? words.movers.noDay : words.movers.none }}</p>
    <FigureTable v-else class="mt-2 mb-2 px-1 sm:px-2" :label="words.movers.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.movers.holding }}</th>
          <th scope="col" class="text-end">{{ words.movers.share }}</th>
          <th scope="col" class="text-end">{{ words.movers.euros }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.holding.instrument.id" data-testid="investments-mover">
          <th scope="row" class="cell-wraps text-start font-normal text-highlighted">
            {{ row.holding.instrument.name }} <span class="text-muted">{{ row.holding.instrument.symbol }}</span>
          </th>
          <td class="text-end">
            <span class="inline-flex items-center gap-0.5 font-medium" :class="row.rose ? 'text-success' : 'text-error'">
              <UIcon :name="row.rose ? 'i-lucide-arrow-up-right' : 'i-lucide-arrow-down-right'" class="size-3.5" aria-hidden="true" />
              <span class="figure">{{ formatPercentChange(row.holding.lastDay?.share ?? 0) }}</span>
              <span class="sr-only">{{ row.rose ? words.movers.up : words.movers.down }}</span>
            </span>
          </td>
          <td class="text-end"><MoneyText :cents="row.holding.lastDay?.change ?? 0" sign="always" tone="outcome" /></td>
        </tr>
      </tbody>
    </FigureTable>
  </AppCard>
</template>
