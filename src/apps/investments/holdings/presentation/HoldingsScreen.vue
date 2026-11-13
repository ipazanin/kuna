<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { closedPositions } from '../domain/closedPositions'
import { holdingMixes } from '../domain/holdingMix'
import { HOLDINGS_GROUPINGS, heldHoldings, holdingsList } from '../domain/holdingsList'
import type { HoldingsGrouping, HoldingsSort } from '../domain/holdingsList'
import { figuresClose } from '../domain/portfolioFigures'
import { dayValuer } from '../../performance/domain/portfolioPerformance'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import { MIXES } from '../../workbook/domain/mixGroup'
import type { Mix } from '../../workbook/domain/mixGroup'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import { words as transactionWords } from '../../transactions/presentation/words'
import ClosedPositionsCard from './ClosedPositionsCard.vue'
import HoldingRow from './HoldingRow.vue'
import HoldingsMapCard from './HoldingsMapCard.vue'
import HoldingsGroupName from './HoldingsGroupName.vue'
import HoldingsTable from './HoldingsTable.vue'
import MixMissingLine from './MixMissingLine.vue'
import { mixDonut } from './mixDonut'
import TargetMixCard from './TargetMixCard.vue'
import { usePortfolio } from './usePortfolio'
import { fetchingAnnouncement, usePricesFetchingLine } from '../../prices/presentation/fetchingLine'
import { usePrices } from '../../prices/presentation/usePrices'
import { words } from './words'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel, shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { roomAtLeast } from '../../../../shared/layout/pageRoom'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { formatMoney, formatPercent, formatShare } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import DonutCard from '../../../../shared/ui/DonutCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/**
 * One mix of the value, picked from five, with the target mix, a map of the holdings, every holding with its value, cost, gain, weight and last day, and the
 * cash of each account, grouped, found and sorted, then what was sold in full. `?on=` shows them at an earlier day's close.
 */
const { state } = useInvestmentsBooks()
const { sources, figures: today, facts } = usePortfolio()
const route = useRoute()
const router = useRouter()
const wide = roomAtLeast(45)
const phone = usePhoneLayout()

const find = ref('')
const sort = ref<HoldingsSort | null>(null)
const adding = ref(false)
const groupings = HOLDINGS_GROUPINGS.map((value) => ({ value, label: words.groupings[value] }))
const splits = MIXES.map((value) => ({ value, label: words.mixes.titles[value] }))

/** Kept in `?group=`, so a part of the class or currency ring opens the list grouped that way. Class stays out of the address. */
const grouping = computed<HoldingsGrouping>({
  get: () => HOLDINGS_GROUPINGS.find((value) => value === route.query.group) ?? 'class',
  set: (value) => replaceQuery('group', value === 'class' ? null : value),
})

/** Kept in `?split=`, so a part of the class or currency ring keeps that ring while it opens the list grouped. Sector stays out of the address. */
const split = computed<Mix>({
  get: () => MIXES.find((value) => value === route.query.split) ?? 'sector',
  set: (value) => replaceQuery('split', value === 'sector' ? null : value),
})

/** A day before today, else null for today. */
function pastDay(text: unknown): CivilDate | null {
  const day = typeof text === 'string' ? parseCivilDate(text) : null
  return day === null || sources.value === null || day >= sources.value.today ? null : day
}

/** The day `?on=` names, or null for today, which stays out of the address. */
const on = computed(() => pastDay(route.query.on))
const picked = computed({
  get: () => on.value ?? sources.value?.today ?? '',
  set: (text: string) => replaceQuery('on', pastDay(text)),
})

function replaceQuery(key: string, value: string | null): void {
  const { [key]: _left, ...others } = route.query
  void router.replace({ query: value === null ? others : { ...others, [key]: value } })
}

const figures = computed(() => (on.value === null || sources.value === null ? today.value : dayValuer(sources.value)(on.value)))
const noTransactions = computed(() => state.workbook !== null && !hasTransactions(state.workbook.book))
/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && !noTransactions.value && figures.value === null))
const list = computed(() =>
  figures.value === null || sources.value === null ? null : holdingsList(figures.value, sources.value.book, { grouping: grouping.value, find: find.value, sort: sort.value }),
)
const closed = computed(() => (figures.value === null ? [] : closedPositions(figures.value)))
const held = computed(() => (figures.value === null ? 0 : heldHoldings(figures.value).length))
const nothingOnDay = computed(
  () => on.value !== null && figures.value !== null && held.value === 0 && closed.value.length === 0 && figures.value.cash.every((balance) => balance.balance === DECIMAL_ZERO),
)

const mixes = computed(() => (figures.value === null || sources.value === null ? null : holdingMixes(figures.value, sources.value.book, facts.value)))
const shownMix = computed(() => (mixes.value === null ? null : mixes.value[split.value]))
const donut = computed(() => (shownMix.value === null || sources.value === null ? null : mixDonut(shownMix.value, sources.value.book, on.value)))

const prices = usePrices()
const fetchingLine = usePricesFetchingLine()
const description = computed(() => {
  if (fetchingLine.value !== null) return fetchingLine.value
  if (on.value !== null) return words.onDay.description(dayLabel(on.value))
  const close = figures.value === null ? null : figuresClose(figures.value)
  if (figures.value === null || close === null) return words.description
  const worth = figures.value.cash.some((balance) => balance.balance !== DECIMAL_ZERO) ? words.worth : words.worthWithoutCash
  return plural(worth(held.value, formatMoney(figures.value.value), shortDayLabel(close)), held.value)
})
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="words.title" :description="description">
      <template v-if="state.workbook !== null" #actions>
        <template v-if="!noTransactions && sources !== null">
          <div class="flex items-center gap-2 type-label">
            <span aria-hidden="true">{{ words.onDay.label }}</span>
            <DayField v-model="picked" :max="sources.today" :aria-label="words.onDay.label" data-testid="holdings-on" />
          </div>
          <UButton v-if="on !== null" :label="words.onDay.today" color="neutral" variant="outline" data-testid="holdings-today" @click="picked = sources.today" />
        </template>
        <UButton :label="transactionWords.add" icon="i-lucide-plus" data-testid="holdings-add-transaction" @click="adding = true" />
      </template>
    </PageHeader>
    <p class="sr-only" role="status">{{ fetchingAnnouncement(prices.state.fetching) }}</p>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="1" data-testid="holdings-loading" />
    <EmptyState v-else-if="noTransactions" icon="i-lucide-layers" :title="words.nothingHeld" :description="words.nothingHeldDescription" data-testid="holdings-empty" />
    <EmptyState
      v-else-if="nothingOnDay && on !== null"
      icon="i-lucide-calendar"
      :title="words.onDay.nothingHeld(dayLabel(on))"
      :description="words.onDay.nothingHeldDescription"
      data-testid="holdings-empty-on-day"
    />
    <template v-else-if="list !== null">
      <DashboardGrid data-testid="holdings-mixes">
        <DonutCard
          v-if="donut !== null && shownMix !== null"
          :title="words.mixes.title"
          :description="donut.description"
          :parts="donut.parts"
          :total="donut.total"
          :total-label="donut.totalLabel"
          v-bind="donut.opens === undefined ? {} : { opens: donut.opens }"
          collapse-id="holdings.mix"
          :summary="donut.summary"
          :data-mix="split"
        >
          <template #actions>
            <USelect v-model="split" :items="splits" size="sm" :aria-label="words.mixes.pick" class="w-48" data-testid="holdings-split" />
          </template>
          <template v-if="shownMix.missing.length > 0 && (split === 'sector' || split === 'country')" #below>
            <MixMissingLine :mix="split" :missing="shownMix.missing" class="mt-2 border-t border-default pt-2" />
          </template>
        </DonutCard>
        <TargetMixCard v-if="mixes !== null && sources !== null" :book="sources.book" :mixes="mixes" />
      </DashboardGrid>
      <HoldingsMapCard v-if="figures !== null && held > 0" :figures="figures" />
      <AppCard data-testid="holdings">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-4 pb-3 sm:px-5">
          <UInput
            v-model="find"
            icon="i-lucide-search"
            :placeholder="phone ? words.findShort : words.find"
            :aria-label="words.find"
            size="sm"
            class="min-w-0 flex-1 sm:w-56 sm:flex-none"
            data-testid="holdings-find"
          />
          <USelect v-model="grouping" :items="groupings" size="sm" :aria-label="words.groupBy" class="w-36 shrink-0" data-testid="holdings-group-by" />
        </div>
        <p v-if="list.groups.length === 0" class="px-4 pb-4 type-body sm:px-5" data-testid="holdings-none">{{ find === '' ? words.nothingHeld : words.noMatch(find) }}</p>
        <HoldingsTable v-else-if="wide" v-model:sort="sort" :list="list" />
        <div v-else class="pb-2" data-testid="holdings-rows">
          <section v-for="group in list.groups" :key="group.key">
            <h2 v-if="group.key !== 'all'" class="group-row flex items-baseline justify-between gap-3 px-4 py-2.5 type-body">
              <span class="min-w-0"><HoldingsGroupName :group="group" /></span>
              <span class="shrink-0 text-end">
                <MoneyText :cents="group.value" />
                <span v-if="group.weight !== null" class="block type-caption font-normal">{{ words.ofValue(formatShare(group.weight)) }}</span>
              </span>
            </h2>
            <ul>
              <li
                v-for="line in group.lines"
                :key="line.kind === 'cash' ? `${line.balance.account}|${line.balance.currency}` : line.holding.instrument.id"
                class="border-t border-default first:border-t-0"
              >
                <HoldingRow :line="line" />
              </li>
            </ul>
          </section>
          <div class="flex flex-col gap-0.5 border-t border-accented px-4 pt-2.5" data-testid="holdings-total">
            <span class="flex items-baseline justify-between gap-3 type-body font-medium text-highlighted">
              <span>{{ words.total }}</span>
              <MoneyText :cents="list.total.value" />
            </span>
            <span class="flex items-baseline justify-between gap-3 type-caption">
              <span>{{ words.columns.cost }} <MoneyText :cents="list.total.cost" /></span>
              <span v-if="list.total.gain !== null">
                <MoneyText :cents="list.total.gain" sign="always" tone="outcome" /><template v-if="list.total.gainShare !== null"> · {{ formatPercent(list.total.gainShare, 'always') }}</template>
              </span>
            </span>
          </div>
        </div>
      </AppCard>
      <ClosedPositionsCard v-if="closed.length > 0" :positions="closed" />
    </template>
    <TransactionDialog v-if="state.workbook !== null" v-model:open="adding" :book="state.workbook.book" :editing="null" />
  </section>
</template>
