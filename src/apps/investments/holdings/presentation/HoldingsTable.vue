<script setup lang="ts">
import type { HoldingFigures } from '../domain/holding'
import type { HoldingsColumn, HoldingsList, HoldingsSort } from '../domain/holdingsList'
import { holdingLink } from './holdingLinks'
import { listingLine, QUANTITY_PLACES } from './holdingText'
import HoldingsGroupName from './HoldingsGroupName.vue'
import LastDayChange from './LastDayChange.vue'
import PriceMarkNote from './PriceMarkNote.vue'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatCurrencyAmount, formatPercent, formatQuantity, formatShare, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import SortableHeader from '../../../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../../../shared/ui/SortableHeader.vue'

/** The holdings as a table from 768 px: a row per holding and per balance, a row per group with its subtotals, and the total at the foot. */
defineProps<{
  list: HoldingsList
}>()

const sort = defineModel<HoldingsSort | null>('sort', { required: true })

function directionOf(column: HoldingsColumn): SortDirection | null {
  return sort.value?.column !== column ? null : sort.value.descending ? 'descending' : 'ascending'
}

function sortBy(column: HoldingsColumn, direction: SortDirection | null): void {
  sort.value = direction === null ? null : { column, descending: direction === 'descending' }
}

/** The units and the price, which narrow tables write under the name instead of in their own columns. */
function heldLine(holding: HoldingFigures): string {
  const units = words.units(formatQuantity(holding.quantity, QUANTITY_PLACES))
  return holding.valuation === null ? units : words.unitsAtPrice(units, formatUnitPrice(holding.valuation.price, holding.instrument.currency))
}
</script>

<template>
  <FigureTable class="px-1 pb-2 sm:px-2" :label="words.table" data-testid="holdings-table">
    <thead>
      <tr>
        <SortableHeader :label="words.columns.holding" :model-value="directionOf('name')" @update:model-value="sortBy('name', $event)" />
        <th scope="col" class="hidden text-end @4xl:table-cell">{{ words.columns.units }}</th>
        <th scope="col" class="hidden text-end @4xl:table-cell">{{ words.columns.price }}</th>
        <SortableHeader :label="words.columns.cost" align="end" :model-value="directionOf('cost')" @update:model-value="sortBy('cost', $event)" />
        <SortableHeader :label="words.columns.value" align="end" :model-value="directionOf('value')" @update:model-value="sortBy('value', $event)" />
        <SortableHeader :label="words.columns.gain" align="end" :model-value="directionOf('gain')" @update:model-value="sortBy('gain', $event)" />
        <SortableHeader :label="words.columns.weight" align="end" :model-value="directionOf('weight')" @update:model-value="sortBy('weight', $event)" />
        <SortableHeader :label="words.columns.lastDay" align="end" :model-value="directionOf('last-day')" @update:model-value="sortBy('last-day', $event)" />
      </tr>
    </thead>
    <tbody v-for="group in list.groups" :key="group.key" :data-group="group.key">
      <tr v-if="group.key !== 'all'" data-testid="holdings-group">
        <th scope="rowgroup" class="pt-4 text-start font-medium text-highlighted">
          <HoldingsGroupName :group="group" />
        </th>
        <td class="hidden @4xl:table-cell" />
        <td class="hidden @4xl:table-cell" />
        <td class="pt-4 text-end"><MoneyText v-if="group.cost !== 0" :cents="group.cost" class="font-medium text-highlighted" /></td>
        <td class="pt-4 text-end"><MoneyText v-if="group.key !== 'sold'" :cents="group.value" class="font-medium text-highlighted" /></td>
        <td class="pt-4 text-end">
          <MoneyText v-if="group.gain !== null" :cents="group.gain" sign="always" tone="outcome" class="font-medium" />
          <span v-if="group.gainShare !== null" class="block type-caption">{{ formatPercent(group.gainShare, 'always') }}</span>
        </td>
        <td class="figure pt-4 text-end font-medium text-highlighted">{{ group.weight === null ? '' : formatShare(group.weight) }}</td>
        <td class="pt-4 text-end"><LastDayChange v-if="group.lastDay !== null" :change="group.lastDay" /></td>
      </tr>
      <tr v-for="line in group.lines" :key="line.kind === 'cash' ? `${line.balance.account}|${line.balance.currency}` : line.holding.instrument.id" data-testid="holding-line">
        <template v-if="line.kind === 'cash'">
          <th scope="row" class="cell-wraps text-start font-normal">
            <span class="text-highlighted">{{ line.account }}</span>
            <span class="block type-caption">{{ words.cashIn(line.balance.currency) }}</span>
          </th>
          <td class="hidden @4xl:table-cell" />
          <td class="hidden @4xl:table-cell" />
          <td />
          <td class="text-end">
            <MoneyText v-if="line.balance.value !== null" :cents="line.balance.value" />
            <span v-if="line.balance.currency !== EURO" class="block type-caption">{{ formatCurrencyAmount(line.balance.balance, line.balance.currency) }}</span>
          </td>
          <td />
          <td class="figure text-end">{{ line.weight === null ? '' : formatShare(line.weight) }}</td>
          <td class="text-end"><LastDayChange v-if="line.balance.lastDay !== null && line.balance.currency !== EURO" :change="line.balance.lastDay" /></td>
        </template>
        <template v-else>
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink :to="holdingLink(line.holding.instrument)" class="text-highlighted" data-testid="holding-link">{{ line.holding.instrument.name }}</DrillLink>
            <span class="block type-caption">{{ listingLine(line.holding.instrument) }}</span>
            <span v-if="line.kind === 'holding'" class="block type-caption @4xl:hidden">{{ heldLine(line.holding) }}</span>
            <PriceMarkNote :holding="line.holding" class="type-caption" />
          </th>
          <td class="figure hidden text-end @4xl:table-cell">{{ line.kind === 'sold' ? '' : formatQuantity(line.holding.quantity, QUANTITY_PLACES) }}</td>
          <td class="figure hidden text-end @4xl:table-cell">
            {{ line.holding.valuation === null ? '' : formatUnitPrice(line.holding.valuation.price, line.holding.instrument.currency) }}
          </td>
          <td class="text-end"><MoneyText v-if="line.kind === 'holding'" :cents="line.holding.cost" /></td>
          <td class="text-end">
            <template v-if="line.kind === 'holding'">
              <MoneyText v-if="line.holding.valuation !== null" :cents="line.holding.valuation.value" />
              <span v-else class="type-caption">{{ words.noPrice }}</span>
              <span v-if="line.holding.valuation !== null && line.holding.instrument.currency !== EURO" class="block type-caption">
                {{ formatCurrencyAmount(line.holding.valuation.foreignValue, line.holding.instrument.currency) }}
              </span>
            </template>
          </td>
          <td class="text-end">
            <template v-if="line.kind === 'sold'">
              <MoneyText :cents="line.holding.realised" sign="always" tone="outcome" />
              <span class="block type-caption">{{ words.realised }}</span>
            </template>
            <template v-else-if="line.holding.unrealised !== null">
              <MoneyText :cents="line.holding.unrealised" sign="always" tone="outcome" />
              <span v-if="line.gainShare !== null" class="block type-caption">{{ formatPercent(line.gainShare, 'always') }}</span>
            </template>
          </td>
          <td class="figure text-end">{{ line.holding.weight === null || line.kind === 'sold' ? '' : formatShare(line.holding.weight) }}</td>
          <td class="text-end"><LastDayChange v-if="line.holding.lastDay !== null" :change="line.holding.lastDay" /></td>
        </template>
      </tr>
    </tbody>
    <tfoot>
      <tr>
        <th scope="row" class="text-start">{{ words.total }}</th>
        <td class="hidden @4xl:table-cell" />
        <td class="hidden @4xl:table-cell" />
        <td class="text-end"><MoneyText :cents="list.total.cost" /></td>
        <td class="text-end"><MoneyText :cents="list.total.value" /></td>
        <td class="text-end">
          <MoneyText v-if="list.total.gain !== null" :cents="list.total.gain" sign="always" tone="outcome" />
          <span v-if="list.total.gainShare !== null" class="block type-caption font-normal">{{ formatPercent(list.total.gainShare, 'always') }}</span>
        </td>
        <td class="figure text-end">{{ list.total.weight === null ? '' : formatShare(list.total.weight) }}</td>
        <td class="text-end"><LastDayChange v-if="list.total.lastDay !== null" :change="list.total.lastDay" /></td>
      </tr>
    </tfoot>
  </FigureTable>
</template>
