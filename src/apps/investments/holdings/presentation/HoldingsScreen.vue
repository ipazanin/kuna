<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { HOLDINGS_GROUPINGS, heldHoldings, holdingsList } from '../domain/holdingsList'
import type { HoldingsGrouping, HoldingsSort } from '../domain/holdingsList'
import { figuresClose } from '../domain/portfolioFigures'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { hasTransactions } from '../../workbook/domain/investmentBook'
import TransactionDialog from '../../transactions/presentation/TransactionDialog.vue'
import { words as transactionWords } from '../../transactions/presentation/words'
import HoldingRow from './HoldingRow.vue'
import HoldingsGroupName from './HoldingsGroupName.vue'
import HoldingsTable from './HoldingsTable.vue'
import { usePortfolio } from './usePortfolio'
import { words } from './words'
import { shortDayLabel } from '../../../../shared/calendar/dayLabel'
import { useMediaQuery } from '../../../../shared/layout/viewport'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { formatMoney, formatPercent } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** Every holding with its value, cost, gain, weight and last day, and the cash of each account, grouped, found and sorted. */
const { state } = useInvestmentsBooks()
const { sources, figures } = usePortfolio()
const wide = useMediaQuery('(min-width: 768px)')

const grouping = ref<HoldingsGrouping>('class')
const find = ref('')
const sold = ref(false)
const sort = ref<HoldingsSort | null>(null)
const adding = ref(false)
const groupings = HOLDINGS_GROUPINGS.map((value) => ({ value, label: words.groupings[value] }))

const noTransactions = computed(() => state.workbook !== null && !hasTransactions(state.workbook.book))
/** The file, and for a file with transactions this browser's copy of its prices too. */
const loading = computed(() => (state.workbook === null && state.status !== 'error') || (state.workbook !== null && !noTransactions.value && figures.value === null))
const list = computed(() =>
  figures.value === null || sources.value === null ? null : holdingsList(figures.value, sources.value.book, { grouping: grouping.value, find: find.value, sold: sold.value, sort: sort.value }),
)
const held = computed(() => (figures.value === null ? 0 : heldHoldings(figures.value).length))
const description = computed(() => {
  const close = figures.value === null ? null : figuresClose(figures.value)
  if (figures.value === null || close === null) return words.description
  const worth = figures.value.cash.some((balance) => balance.balance !== DECIMAL_ZERO) ? words.worth : words.worthWithoutCash
  return plural(worth(held.value, formatMoney(figures.value.value), shortDayLabel(close)), held.value)
})
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="words.title" :description="description">
      <template v-if="state.workbook !== null" #actions>
        <UButton :label="transactionWords.add" icon="i-lucide-plus" data-testid="holdings-add-transaction" @click="adding = true" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="1" data-testid="holdings-loading" />
    <EmptyState v-else-if="noTransactions" icon="i-lucide-layers" :title="words.nothingHeld" :description="words.nothingHeldDescription" data-testid="holdings-empty" />
    <AppCard v-else-if="list !== null" data-testid="holdings">
      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pt-4 pb-3 sm:px-5">
        <ChoiceButtons v-model="grouping" :options="groupings" :label="words.groupBy" data-testid="holdings-group-by" />
        <UInput v-model="find" icon="i-lucide-search" :placeholder="words.find" :aria-label="words.find" size="sm" class="w-full sm:w-56" data-testid="holdings-find" />
        <USwitch v-model="sold" :label="words.showSold" size="sm" data-testid="holdings-show-sold" />
      </div>
      <p v-if="list.groups.length === 0" class="px-4 pb-4 type-body sm:px-5" data-testid="holdings-none">{{ find === '' ? words.nothingHeld : words.noMatch(find) }}</p>
      <HoldingsTable v-else-if="wide" v-model:sort="sort" :list="list" />
      <div v-else class="pb-2" data-testid="holdings-rows">
        <section v-for="group in list.groups" :key="group.key">
          <h2 v-if="group.key !== 'all'" class="flex items-baseline justify-between gap-3 border-t border-default px-4 pt-3 pb-1 type-label">
            <span><HoldingsGroupName :group="group" /></span>
            <MoneyText v-if="group.key !== 'sold'" :cents="group.value" class="shrink-0" />
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
    <TransactionDialog v-if="state.workbook !== null" v-model:open="adding" :book="state.workbook.book" :editing="null" />
  </section>
</template>
