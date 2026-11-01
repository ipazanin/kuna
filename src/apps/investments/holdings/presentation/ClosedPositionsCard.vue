<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { sortedPositions } from '../domain/closedPositions'
import type { ClosedColumn, ClosedPosition, ClosedSort } from '../domain/closedPositions'
import { holdingLink } from './holdingLinks'
import { QUANTITY_PLACES, listingLine } from './holdingText'
import { words } from './words'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useMediaQuery } from '../../../../shared/layout/viewport'
import { sumMoney } from '../../../../shared/money/money'
import { formatMoney, formatPercent, formatQuantity } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import SortableHeader from '../../../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../../../shared/ui/SortableHeader.vue'

/** What was sold in full, a table from 768 px and two-line rows below it, each opening the holding's page. */
const props = defineProps<{
  positions: readonly ClosedPosition[]
}>()

const wide = useMediaQuery('(min-width: 768px)')
const sort = ref<ClosedSort | null>(null)
const expanded = ref(false)

const sorted = computed(() => sortedPositions(props.positions, sort.value))
const shown = computed(() => (expanded.value ? sorted.value : sorted.value.slice(0, FIRST_SHOWN)))
const summary = computed(() => plural(words.closed.summary(props.positions.length, formatMoney(sumMoney(props.positions.map((position) => position.realised)), 'always')), props.positions.length))

function directionOf(column: ClosedColumn): SortDirection | null {
  return sort.value?.column !== column ? null : sort.value.descending ? 'descending' : 'ascending'
}

function sortBy(column: ClosedColumn, direction: SortDirection | null): void {
  sort.value = direction === null ? null : { column, descending: direction === 'descending' }
}

function days(position: ClosedPosition): string {
  return plural(words.closed.days(position.daysHeld), position.daysHeld)
}

function span(position: ClosedPosition): string {
  return words.closed.span(dayLabel(position.firstBought), dayLabel(position.lastSold))
}
</script>

<template>
  <AppCard :title="words.closed.title" collapse-id="holdings.closed" :summary="summary" data-testid="closed-positions">
    <FigureTable v-if="wide" class="px-1 pb-2 sm:px-2" :label="words.closed.title" data-testid="closed-table">
      <thead>
        <tr>
          <SortableHeader :label="words.closed.columns.holding" :model-value="directionOf('name')" @update:model-value="sortBy('name', $event)" />
          <th scope="col" class="text-end">{{ words.closed.columns.sold }}</th>
          <SortableHeader :label="words.closed.columns.cost" align="end" :model-value="directionOf('cost')" @update:model-value="sortBy('cost', $event)" />
          <SortableHeader :label="words.closed.columns.proceeds" align="end" :model-value="directionOf('proceeds')" @update:model-value="sortBy('proceeds', $event)" />
          <SortableHeader :label="words.closed.columns.realised" align="end" :model-value="directionOf('realised')" @update:model-value="sortBy('realised', $event)" />
          <SortableHeader :label="words.closed.columns.income" align="end" :model-value="directionOf('income')" @update:model-value="sortBy('income', $event)" />
          <SortableHeader :label="words.closed.columns.held" align="end" :model-value="directionOf('held')" @update:model-value="sortBy('held', $event)" />
          <th scope="col" class="hidden text-end @4xl:table-cell">{{ words.closed.columns.firstBought }}</th>
          <SortableHeader :label="words.closed.columns.lastSold" align="end" class="hidden @4xl:table-cell" :model-value="directionOf('last-sold')" @update:model-value="sortBy('last-sold', $event)" />
        </tr>
      </thead>
      <tbody>
        <tr v-for="position in shown" :key="position.instrument.id" data-testid="closed-line">
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink :to="holdingLink(position.instrument)" class="text-highlighted" data-testid="closed-link">{{ position.instrument.name }}</DrillLink>
            <span class="block type-caption">{{ listingLine(position.instrument) }}</span>
            <span class="block type-caption @4xl:hidden">{{ span(position) }}</span>
          </th>
          <td class="figure text-end">{{ formatQuantity(position.units, QUANTITY_PLACES) }}</td>
          <td class="text-end"><MoneyText :cents="position.cost" /></td>
          <td class="text-end"><MoneyText :cents="position.proceeds" /></td>
          <td class="text-end">
            <MoneyText :cents="position.realised" sign="always" tone="outcome" />
            <span v-if="position.realisedShare !== null" class="block type-caption">{{ formatPercent(position.realisedShare, 'always') }}</span>
          </td>
          <td class="text-end"><MoneyText :cents="position.income" /></td>
          <td class="figure text-end">{{ days(position) }}</td>
          <td class="figure hidden text-end @4xl:table-cell">{{ dayLabel(position.firstBought) }}</td>
          <td class="figure hidden text-end @4xl:table-cell">{{ dayLabel(position.lastSold) }}</td>
        </tr>
      </tbody>
    </FigureTable>
    <ul v-else class="pb-2" data-testid="closed-rows">
      <li v-for="position in shown" :key="position.instrument.id" class="border-t border-default first:border-t-0">
        <RouterLink :to="holdingLink(position.instrument)" class="flex flex-col gap-0.5 px-4 py-2.5 hover:bg-elevated/40" data-testid="closed-row">
          <span class="flex items-baseline justify-between gap-3 type-body">
            <span class="min-w-0 truncate text-highlighted">{{ position.instrument.name }}</span>
            <MoneyText :cents="position.realised" sign="always" tone="outcome" class="shrink-0 font-medium" />
          </span>
          <span class="flex items-baseline justify-between gap-3 type-caption">
            <span class="min-w-0 truncate">{{ words.units(formatQuantity(position.units, QUANTITY_PLACES)) }} · {{ days(position) }}</span>
            <span v-if="position.realisedShare !== null" class="figure shrink-0">{{ formatPercent(position.realisedShare, 'always') }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
    <ShowAllButton v-if="positions.length > FIRST_SHOWN" v-model:expanded="expanded" :total="positions.length" class="px-4 pb-4 sm:px-5" />
  </AppCard>
</template>
