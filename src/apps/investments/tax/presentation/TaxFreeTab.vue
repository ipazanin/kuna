<script setup lang="ts">
import { computed, ref } from 'vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { isAtALoss, taxFreeCalendar } from '../domain/taxFreeCalendar'
import type { PortfolioFigures } from '../../holdings/domain/portfolioFigures'
import { holdingLink } from '../../holdings/presentation/holdingLinks'
import { QUANTITY_PLACES } from '../../holdings/presentation/holdingText'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { formatMoney, formatQuantity } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'

/** The lots that turn tax-free in the next 24 months, by month, each with its value now and its gain, the ones at a loss marked. */
const props = defineProps<{
  figures: PortfolioFigures
  today: CivilDate
}>()

const text = words.taxFree
const months = computed(() => taxFreeCalendar(props.figures, props.today))
const total = computed(() => months.value.reduce((count, month) => count + month.lots.length, 0))
const atALoss = computed(() => months.value.reduce((count, month) => count + month.lots.filter(isAtALoss).length, 0))
const summary = computed(() => (atALoss.value > 0 ? plural(text.lotsAtALoss(atALoss.value), atALoss.value) : plural(text.noneAtALoss(total.value), total.value)))

const showAll = ref(false)
/** The first ten lots in their months, or every lot. */
const shown = computed(() => {
  let left = showAll.value ? total.value : FIRST_SHOWN
  return months.value.flatMap((month) => {
    const lots = month.lots.slice(0, left)
    left -= lots.length
    return lots.length === 0 ? [] : [{ ...month, lots }]
  })
})
</script>

<template>
  <EmptyState v-if="total === 0" icon="i-lucide-calendar-check" :title="text.emptyTitle" :description="text.emptyDescription" data-testid="tax-free-empty" />
  <AppCard v-else :title="text.title" :subtitle="text.subtitle" collapse-id="investments.tax.tax-free" :summary="summary" class="max-w-measure" data-testid="tax-free-lots">
    <FigureTable class="mt-2 mb-2 px-1 sm:px-2" :label="text.title">
      <thead>
        <tr>
          <th scope="col" class="text-start">{{ text.holding }}</th>
          <th scope="col" class="hidden text-end @lg:table-cell">{{ text.units }}</th>
          <th scope="col" class="hidden text-start @lg:table-cell">{{ text.bought }}</th>
          <th scope="col" class="hidden text-end @lg:table-cell">{{ text.cost }}</th>
          <th scope="col" class="text-end">{{ text.value }}</th>
          <th scope="col" class="text-end">{{ text.gain }}</th>
        </tr>
      </thead>
      <tbody v-for="month in shown" :key="month.month" data-testid="tax-free-month">
        <tr class="group-row">
          <th scope="rowgroup" colspan="6" class="text-start">{{ monthLabel(month.month) }}</th>
        </tr>
        <tr v-for="entry in month.lots" :key="`${entry.holding.instrument.id}|${entry.place}`" data-testid="tax-free-lot">
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink :to="holdingLink(entry.holding.instrument)">{{ entry.holding.instrument.name }}</DrillLink>
            <span class="block type-caption">{{ text.from(dayLabel(entry.lot.taxFreeFrom)) }}</span>
            <span class="block type-caption @lg:hidden">{{ text.lot(dayLabel(entry.lot.opened), formatQuantity(entry.lot.quantity, QUANTITY_PLACES)) }}</span>
          </th>
          <td class="figure hidden text-end @lg:table-cell">{{ formatQuantity(entry.lot.quantity, QUANTITY_PLACES) }}</td>
          <td class="hidden text-start text-toned @lg:table-cell">{{ dayLabel(entry.lot.opened) }}</td>
          <td class="hidden text-end @lg:table-cell"><MoneyText :cents="entry.lot.cost" /></td>
          <td class="cell-wraps text-end">
            <MoneyText v-if="entry.value !== null" :cents="entry.value" />
            <span v-else class="type-caption">{{ text.noPrice }}</span>
            <span class="block type-caption @lg:hidden">{{ text.costOf(formatMoney(entry.lot.cost)) }}</span>
          </td>
          <td class="cell-wraps text-end">
            <MoneyText v-if="entry.gain !== null" :cents="entry.gain" sign="always" tone="outcome" />
            <span v-if="isAtALoss(entry)" class="flex items-center justify-end gap-1 type-caption text-error" data-testid="tax-free-at-a-loss">
              <UIcon name="i-lucide-trending-down" class="size-3.5 shrink-0" aria-hidden="true" />
              {{ text.atALoss }}
            </span>
          </td>
        </tr>
      </tbody>
    </FigureTable>
    <div v-if="total > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
      <ShowAllButton v-model:expanded="showAll" :total="total" />
    </div>
  </AppCard>
</template>
