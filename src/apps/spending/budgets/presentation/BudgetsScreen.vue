<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { leftToSpend, limitsUnrated } from '../domain/budgetCarry'
import { spendingFigures } from '../../analytics/presentation/spendingFigures'
import { categoryTree } from '../../categories/domain/categoryTree'
import { categoryColours } from '../../categories/presentation/categoryColours'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import LimitDialog from './LimitDialog.vue'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { monthOf, monthsFrom, parseMonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { negateMoney } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import FigureTable from '../../../../shared/ui/FigureTable.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/** Each limited category of a month with its limit, what carried in, what is available, what it spent and what is left. */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()
const router = useRouter()
const current = monthOf(today())

const loading = computed(() => state.workbook === null && state.status !== 'error')
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))

/** The months a limit has held in, from the first budget to this month, newest first. */
const months = computed(() => {
  const first = (state.workbook?.budgets ?? []).map((budget) => budget.from).reduce((earliest, from) => (from < earliest ? from : earliest), current)
  return monthsFrom(first, current).reverse()
})
const shown = computed(() => {
  const asked = typeof route.query.month === 'string' ? parseMonthKey(route.query.month) : null
  return asked !== null && months.value.includes(asked) ? asked : current
})
const monthItems = computed(() => months.value.map((month) => ({ label: monthLabel(month), value: month })))

function showMonth(month: string): void {
  const { month: _shown, ...rest } = route.query
  void router.replace({ query: month === current ? rest : { ...rest, month } })
}

const categories = computed(() => state.workbook?.categories ?? [])
const colourOf = computed(() => categoryColours(categories.value))
/** Every spending category in the order of the tree, each group before its children, with the group it sits in. */
const ordered = computed(() =>
  categoryTree(categories.value, ['spending']).flatMap((entry) => [{ category: entry.group, group: null }, ...entry.children.map((child) => ({ category: child, group: entry.group }))]),
)

const limits = computed(() => (state.workbook === null ? [] : spendingFigures(state.workbook, everydayRates(rates.value)).limitsIn(shown.value)))
const rows = computed(() =>
  ordered.value.flatMap(({ category, group }) => {
    const limit = limits.value.find((entry) => entry.category === category.id)
    return limit === undefined ? [] : [{ category, group, limit }]
  }),
)

const unrated = computed(() => (waiting.value ? null : unratedNote(limitsUnrated(limits.value))))

const editing = ref<Category | null>(null)
const dialogOpen = ref(false)

function openDialog(category: Category | null): void {
  editing.value = category
  dialogOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader :title="screenWords.limits" :description="words.description">
      <template v-if="rows.length > 0 || months.length > 1" #actions>
        <USelect v-if="months.length > 1" :model-value="shown" :items="monthItems" :aria-label="words.month" class="w-44" data-testid="spending-budgets-month" @update:model-value="showMonth" />
        <UButton v-if="rows.length > 0" :label="words.setLimit" icon="i-lucide-plus" data-testid="spending-limit-add" @click="openDialog(null)" />
      </template>
    </PageHeader>
    <ScreenSkeleton v-if="loading" :heading="false" :cards="1" data-testid="spending-budgets-loading" />
    <template v-else-if="state.workbook !== null">
      <EmptyState v-if="rows.length === 0" icon="i-lucide-gauge" :title="words.empty.title" :description="words.empty.description" data-testid="spending-budgets-empty">
        <template #actions>
          <UButton :label="words.setLimit" icon="i-lucide-plus" data-testid="spending-limit-add" @click="openDialog(null)" />
        </template>
      </EmptyState>
      <AppCard v-else :title="monthLabel(shown)" :subtitle="waiting ? rateWords.loading : undefined" data-testid="spending-budgets">
        <FigureTable class="mt-2 px-1 sm:px-2" :label="words.table.label(monthLabel(shown))">
          <thead>
            <tr>
              <th scope="col" class="text-start">{{ words.table.category }}</th>
              <th scope="col" class="hidden text-end @2xl:table-cell">{{ words.table.monthlyLimit }}</th>
              <th scope="col" class="hidden text-end @2xl:table-cell">{{ words.table.carriedIn }}</th>
              <th scope="col" class="text-end">{{ words.table.available }}</th>
              <th scope="col" class="hidden text-end @sm:table-cell">{{ words.table.spent }}</th>
              <th scope="col" class="text-end">{{ words.table.left }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in rows" :key="row.category.id" :data-carried-in="row.limit.carriedIn" :data-available="row.limit.available" data-testid="spending-budget-row">
              <th scope="row" class="cell-wraps text-start font-normal">
                <span class="inline-flex items-center gap-1.5">
                  <span class="swatch swatch-bar shrink-0" :style="{ '--swatch': `var(${colourOf(row.category)})` }" aria-hidden="true" />
                  <UButton
                    :label="row.category.name"
                    :aria-label="words.table.change(row.category.name)"
                    color="neutral"
                    variant="link"
                    class="px-0 text-start text-highlighted"
                    data-testid="spending-limit-change"
                    @click="openDialog(row.category)"
                  />
                </span>
                <span v-if="row.group !== null" class="block type-caption">{{ row.group.name }}</span>
                <span v-if="row.limit.carriedIn !== 0" class="block type-caption @2xl:hidden" data-testid="spending-budget-carry">{{
                  words.table.carriedInAmount(formatMoney(row.limit.carriedIn, 'always'))
                }}</span>
              </th>
              <td class="figure hidden text-end @2xl:table-cell">{{ formatMoney(row.limit.limit) }}</td>
              <td class="figure hidden text-end @2xl:table-cell">{{ formatMoney(row.limit.carriedIn, row.limit.carriedIn === 0 ? 'negative' : 'always') }}</td>
              <td class="figure text-end">{{ formatMoney(row.limit.available) }}</td>
              <td class="figure hidden text-end @sm:table-cell">{{ formatMoney(row.limit.spent) }}</td>
              <td class="figure cell-wraps text-end">
                <NoteLine v-if="row.limit.left < 0" as="span" size="body" tone="error" inline data-testid="spending-limit-over">{{ words.overBy(formatMoney(negateMoney(row.limit.left))) }}</NoteLine>
                <template v-else>{{ formatMoney(row.limit.left) }}</template>
              </td>
            </tr>
          </tbody>
          <tfoot v-if="rows.length > 1">
            <tr>
              <th scope="row" class="text-start">{{ words.table.inAll }}</th>
              <td class="hidden @2xl:table-cell" />
              <td class="hidden @2xl:table-cell" />
              <td />
              <td class="hidden @sm:table-cell" />
              <td class="figure text-end" data-testid="spending-budgets-left">{{ formatMoney(leftToSpend(limits)) }}</td>
            </tr>
          </tfoot>
        </FigureTable>
        <p v-if="unrated !== null" class="px-4 pt-2 pb-4 type-caption sm:px-5" data-testid="spending-budgets-unrated">{{ unrated }}</p>
      </AppCard>
    </template>
    <LimitDialog v-model:open="dialogOpen" :category="editing" :month="shown" :current="current" />
  </section>
</template>
