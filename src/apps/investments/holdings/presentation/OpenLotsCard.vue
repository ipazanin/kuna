<script setup lang="ts">
import { computed, ref } from 'vue'

import type { HoldingFigures } from '../domain/holding'
import { lotIsTaxFree } from '../domain/lots'
import { priceOfWorth } from '../domain/quoting'
import { QUANTITY_PLACES, WORKED_OUT_PRICE_PLACES } from './holdingText'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatQuantity, formatUnitPrice } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** The lots a holding still has, oldest first, with the day each turns tax-free and what it cost a unit. */
const props = defineProps<{
  holding: HoldingFigures
  today: CivilDate
}>()

const rows = computed(() =>
  props.holding.lots.map((lot, place) => ({
    key: `${lot.opened}|${place}`,
    lot,
    perUnit: formatUnitPrice(priceOfWorth(props.holding.instrument.quoted, lot.costInCurrency, lot.quantity), props.holding.instrument.currency, WORKED_OUT_PRICE_PLACES),
    taxFree: lotIsTaxFree(lot, props.today),
  })),
)
const showAll = ref(false)
const shown = computed(() => (showAll.value ? rows.value : rows.value.slice(0, FIRST_SHOWN)))
</script>

<template>
  <AppCard :title="words.lots.title" :subtitle="words.lots.subtitle" data-testid="holding-lots">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="words.lots.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ words.lots.bought }}</th>
          <th scope="col" class="text-end">{{ words.lots.units }}</th>
          <th scope="col" class="text-end">{{ words.lots.cost }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in shown" :key="row.key" data-testid="holding-lot">
          <th scope="row" class="cell-wraps text-start font-normal">
            <span class="text-toned">{{ dayLabel(row.lot.opened) }}</span>
            <span class="block type-caption">{{ row.taxFree ? words.lots.taxFreeSince(dayLabel(row.lot.taxFreeFrom)) : words.lots.taxFreeFrom(dayLabel(row.lot.taxFreeFrom)) }}</span>
          </th>
          <td class="figure text-end">{{ formatQuantity(row.lot.quantity, QUANTITY_PLACES) }}</td>
          <td class="cell-wraps text-end">
            <MoneyText :cents="row.lot.cost" />
            <span class="block type-caption">{{ words.lots.perUnit(row.perUnit) }}</span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <div v-if="rows.length > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
      <ShowAllButton v-model:expanded="showAll" :total="rows.length" />
    </div>
  </AppCard>
</template>
