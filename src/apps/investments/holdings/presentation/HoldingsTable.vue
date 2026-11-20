<script setup lang="ts">
import type { HoldingFigures } from '../domain/holding'
import type { HoldingsColumn, HoldingsList, HoldingsSort } from '../domain/holdingsList'
import { holdingLink } from './holdingLinks'
import { listingLine, QUANTITY_PLACES } from './holdingText'
import { useNoPriceWord } from './useNoPriceWord'
import HoldingRow from './HoldingRow.vue'
import HoldingsGroupName from './HoldingsGroupName.vue'
import LastDayChange from './LastDayChange.vue'
import PriceMarkNote from './PriceMarkNote.vue'
import { words } from './words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { roomAtLeast } from '../../../../shared/layout/pageRoom'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatCurrencyAmount, formatPercent, formatQuantity, formatShare, formatUnitPrice, percentAsShown } from '../../../../shared/money/moneyFormat'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import RecordRow from '../../../../shared/ui/RecordRow.vue'
import { moneyToneClass } from '../../../../shared/ui/moneyTone'
import SortableHeader from '../../../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../../../shared/ui/SortableHeader.vue'

/**
 * The holdings as a table where the card has room, with the day's change first: a row per holding and per balance, a row
 * per group with its subtotals, and the total at the foot. Narrower, a row per line under each group's name.
 */
const props = withDefaults(
  defineProps<{
    list: HoldingsList
    /** The day Fetch today's quotes are of, which names the first column Today and marks a holding still at an earlier close. */
    quotedDay?: CivilDate | null
    /** The list leaves the cash out, so its total says so and shows no weight, which would read as a share missing. */
    withoutCash?: boolean
  }>(),
  { quotedDay: null, withoutCash: false },
)

const noPriceWord = useNoPriceWord()
const wide = roomAtLeast(45)

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
  <FigureTable v-if="wide" class="px-1 pb-2 sm:px-2" :label="words.table" data-testid="holdings-table">
    <thead>
      <tr>
        <SortableHeader
          :label="props.quotedDay === null ? words.columns.lastDay : words.columns.today"
          align="end"
          :model-value="directionOf('last-day')"
          @update:model-value="sortBy('last-day', $event)"
        />
        <SortableHeader :label="words.columns.holding" :model-value="directionOf('name')" @update:model-value="sortBy('name', $event)" />
        <th scope="col" class="hidden text-end @4xl:table-cell">{{ words.columns.units }}</th>
        <th scope="col" class="hidden text-end @4xl:table-cell">{{ words.columns.price }}</th>
        <SortableHeader :label="words.columns.cost" align="end" :model-value="directionOf('cost')" @update:model-value="sortBy('cost', $event)" />
        <SortableHeader :label="words.columns.value" align="end" :model-value="directionOf('value')" @update:model-value="sortBy('value', $event)" />
        <SortableHeader :label="words.columns.gain" align="end" :model-value="directionOf('gain')" @update:model-value="sortBy('gain', $event)" />
        <SortableHeader :label="words.columns.weight" align="end" :model-value="directionOf('weight')" @update:model-value="sortBy('weight', $event)" />
      </tr>
    </thead>
    <tbody v-for="group in list.groups" :key="group.key" :data-group="group.key">
      <tr v-if="group.key !== 'all'" class="group-row" data-testid="holdings-group">
        <td class="text-end"><LastDayChange v-if="group.lastDay !== null" :change="group.lastDay" /></td>
        <th scope="rowgroup" class="cell-wraps text-start">
          <HoldingsGroupName :group="group" />
        </th>
        <td class="hidden @4xl:table-cell" />
        <td class="hidden @4xl:table-cell" />
        <td class="text-end"><MoneyText v-if="group.cost !== 0" :cents="group.cost" /></td>
        <td class="text-end"><MoneyText :cents="group.value" /></td>
        <td class="text-end">
          <MoneyText v-if="group.gain !== null" :cents="group.gain" tone="outcome" />
          <span v-if="group.gainShare !== null" class="block type-caption font-normal" :class="moneyToneClass(percentAsShown(group.gainShare), 'outcome')">{{
            formatPercent(group.gainShare, 'always')
          }}</span>
        </td>
        <td class="figure text-end">{{ group.weight === null ? '' : formatShare(group.weight) }}</td>
      </tr>
      <RecordRow
        v-for="line in group.lines"
        :key="line.kind === 'cash' ? `${line.balance.account}|${line.balance.currency}` : line.holding.instrument.id"
        :to="line.kind === 'cash' ? null : holdingLink(line.holding.instrument)"
        data-testid="holding-line"
      >
        <template v-if="line.kind === 'cash'">
          <td class="text-end"><LastDayChange v-if="line.balance.lastDay !== null && line.balance.currency !== EURO" :change="line.balance.lastDay" /></td>
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
        </template>
        <template v-else>
          <td class="text-end"><LastDayChange v-if="line.holding.lastDay !== null" :change="line.holding.lastDay" /></td>
          <th scope="row" class="cell-wraps text-start font-normal">
            <DrillLink :to="holdingLink(line.holding.instrument)" class="text-highlighted" data-testid="holding-link">{{ line.holding.instrument.name }}</DrillLink>
            <span class="block type-caption">{{ listingLine(line.holding.instrument) }}</span>
            <span class="block type-caption @4xl:hidden">{{ heldLine(line.holding) }}</span>
            <PriceMarkNote :holding="line.holding" :quoted-day="quotedDay" class="type-caption" />
          </th>
          <td class="figure hidden text-end @4xl:table-cell">{{ formatQuantity(line.holding.quantity, QUANTITY_PLACES) }}</td>
          <td class="figure hidden text-end @4xl:table-cell">
            {{ line.holding.valuation === null ? '' : formatUnitPrice(line.holding.valuation.price, line.holding.instrument.currency) }}
          </td>
          <td class="text-end"><MoneyText :cents="line.holding.cost" /></td>
          <td class="text-end">
            <MoneyText v-if="line.holding.valuation !== null" :cents="line.holding.valuation.value" />
            <span v-else class="type-caption">{{ noPriceWord(line.holding.instrument) }}</span>
            <span v-if="line.holding.valuation !== null && line.holding.instrument.currency !== EURO" class="block type-caption">
              {{ formatCurrencyAmount(line.holding.valuation.foreignValue, line.holding.instrument.currency) }}
            </span>
          </td>
          <td class="text-end">
            <template v-if="line.holding.unrealised !== null">
              <MoneyText :cents="line.holding.unrealised" tone="outcome" />
              <span v-if="line.gainShare !== null" class="block type-caption" :class="moneyToneClass(percentAsShown(line.gainShare), 'outcome')">{{ formatPercent(line.gainShare, 'always') }}</span>
            </template>
          </td>
          <td class="figure text-end">{{ line.holding.weight === null ? '' : formatShare(line.holding.weight) }}</td>
        </template>
      </RecordRow>
    </tbody>
    <tfoot>
      <tr>
        <td class="text-end"><LastDayChange v-if="list.total.lastDay !== null" :change="list.total.lastDay" /></td>
        <th scope="row" class="text-start">{{ withoutCash ? words.totalWithoutCash : words.total }}</th>
        <td class="hidden @4xl:table-cell" />
        <td class="hidden @4xl:table-cell" />
        <td class="text-end"><MoneyText :cents="list.total.cost" /></td>
        <td class="text-end"><MoneyText :cents="list.total.value" /></td>
        <td class="text-end">
          <MoneyText v-if="list.total.gain !== null" :cents="list.total.gain" tone="outcome" />
          <span v-if="list.total.gainShare !== null" class="block type-caption font-normal" :class="moneyToneClass(percentAsShown(list.total.gainShare), 'outcome')">{{
            formatPercent(list.total.gainShare, 'always')
          }}</span>
        </td>
        <td class="figure text-end">{{ withoutCash || list.total.weight === null ? '' : formatShare(list.total.weight) }}</td>
      </tr>
    </tfoot>
  </FigureTable>
  <div v-else class="row-list pb-2" data-testid="holdings-rows">
    <section v-for="group in list.groups" :key="group.key">
      <h2 v-if="group.key !== 'all'" class="group-row px-4 py-2.5 type-body sm:px-5">
        <span class="row-list-edge flex items-start justify-between gap-3">
          <span class="min-w-0">
            <HoldingsGroupName :group="group">
              · <MoneyText :cents="group.value" /><template v-if="group.weight !== null"> · {{ words.ofValue(formatShare(group.weight)) }}</template>
            </HoldingsGroupName>
          </span>
          <span v-if="group.lastDay !== null" class="shrink-0 text-end"><LastDayChange :change="group.lastDay" /></span>
        </span>
      </h2>
      <ul>
        <li v-for="line in group.lines" :key="line.kind === 'cash' ? `${line.balance.account}|${line.balance.currency}` : line.holding.instrument.id" class="border-t border-default first:border-t-0">
          <HoldingRow :line="line" :quoted-day="quotedDay" />
        </li>
      </ul>
    </section>
    <div class="border-t border-accented px-4 pt-2.5 sm:px-5" data-testid="holdings-total">
      <span class="row-list-edge flex items-start justify-between gap-3 type-body">
        <span class="min-w-0">
          <span class="font-medium text-highlighted">{{ withoutCash ? words.totalWithoutCash : words.total }}</span>
          <span class="block type-caption font-normal">
            <MoneyText :cents="list.total.value" /> · {{ words.columns.cost }} <MoneyText :cents="list.total.cost" /><template v-if="list.total.gain !== null">
              · <MoneyText :cents="list.total.gain" tone="outcome" /><template v-if="list.total.gainShare !== null">
                · <span class="figure" :class="moneyToneClass(percentAsShown(list.total.gainShare), 'outcome')">{{ formatPercent(list.total.gainShare, 'always') }}</span></template
              ></template
            >
          </span>
        </span>
        <span v-if="list.total.lastDay !== null" class="shrink-0 text-end"><LastDayChange :change="list.total.lastDay" /></span>
      </span>
    </div>
  </div>
</template>
