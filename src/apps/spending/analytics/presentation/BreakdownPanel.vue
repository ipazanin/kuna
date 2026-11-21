<script setup lang="ts">
import { computed } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

import BreakdownTable from './BreakdownTable.vue'
import { breakdownChart } from './breakdownChart'
import { words } from './words'
import type { SpendingFigures } from '../domain/spendingFigures'
import type { BreakdownLine, Grouping } from '../domain/spanBreakdown'
import { categoryColours } from '../../categories/presentation/categoryColours'
import { entriesLink } from '../../overview/presentation/spendingLinks'
import type { EntriesGroup } from '../../overview/presentation/spendingLinks'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { words as rateWords } from '../../rates/presentation/words'
import type { Category } from '../../workbook/domain/category'
import type { SpendingBook } from '../../workbook/domain/readSpendingBook'
import type { LedgerWindow } from '../../../../shared/calendar/ledgerWindow'
import { periodRange } from '../../../../shared/calendar/period'
import type { Period } from '../../../../shared/calendar/period'
import { periodInWords } from '../../../../shared/calendar/periodInWords'
import type { PeriodPreset } from '../../../../shared/calendar/periodPresets'
import { periodOfText, periodText } from '../../../../shared/calendar/periodText'
import { monthRange } from '../../../../shared/calendar/dateRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import type { ChartPointSelection } from '../../../../shared/ui/ChartCard.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import PeriodBar from '../../../../shared/ui/PeriodBar.vue'

/** A span's money grouped by category, payee, label or account, as a chart of what each spent and a table that opens each line's entries. */
const props = defineProps<{
  book: SpendingBook
  figures: SpendingFigures
  window: LedgerWindow
  waiting: boolean
}>()

const route = useRoute()
const phone = usePhoneLayout()
const router = useRouter()

const PRESETS: readonly PeriodPreset[] = ['month', 'quarter', 'year', 'l12', 'custom']
const GROUPINGS: readonly Grouping[] = ['category', 'payee', 'label', 'account']

/** This month, which stays out of the address. */
const thisMonth = computed((): Period => ({ preset: 'month', month: props.window.partMonth }))
const period = computed<Period>({
  get: () => {
    const named = periodOfText(typeof route.query.period === 'string' ? route.query.period : null)
    return named !== null && PRESETS.includes(named.preset) ? named : thisMonth.value
  },
  set: (picked) => {
    const { period: _left, ...others } = route.query
    const text = periodText(picked)
    void router.replace({ query: text === periodText(thisMonth.value) ? others : { ...others, period: text } })
  },
})
const grouping = computed<Grouping>({
  get: () => GROUPINGS.find((offered) => offered === route.query.grouping) ?? 'category',
  set: (picked) => {
    const { grouping: _left, ...others } = route.query
    void router.replace({ query: picked === 'category' ? others : { ...others, grouping: picked } })
  },
})
const groupings = GROUPINGS.map((value) => ({ value, label: words.analysis.breakdown.groupings[value] }))

const range = computed(() => periodRange(period.value, props.window) ?? monthRange(props.window.firstMonth, props.window.partMonth))
const spanWords = computed(() => periodInWords(period.value, props.window))
const breakdown = computed(() => props.figures.breakdownOf(range.value, grouping.value))

const categoriesById = computed(() => new Map<string, Category>(props.book.categories.map((category) => [category.id, category])))
const colourOf = computed(() => categoryColours(props.book.categories))
function colourOfLine(line: BreakdownLine): string {
  const category = line.key === null ? undefined : categoriesById.value.get(line.key)
  return category === undefined ? '--chart-deemphasis' : colourOf.value(category)
}
const chart = computed(() => breakdownChart(breakdown.value.lines, grouping.value, colourOfLine, spanWords.value, chartTokens()))

/** The group a line stands for, as Entries narrows to it, or null for the rows on no account. */
function groupOf(line: BreakdownLine): EntriesGroup | null {
  const key = line.key
  if (key === null) return null
  switch (grouping.value) {
    case 'category': {
      const category = categoriesById.value.get(key)
      return category === undefined ? null : { category }
    }
    case 'payee':
      return { payee: key }
    case 'label': {
      const label = props.book.labels.find((held) => held.id === key)
      return label === undefined ? null : { label }
    }
    case 'account': {
      const account = props.book.accounts.find((held) => held.id === key)
      return account === undefined ? null : { account }
    }
  }
}

function linkOf(line: BreakdownLine): RouteLocationRaw | null {
  const group = groupOf(line)
  return group === null ? null : entriesLink(range.value, group)
}

function barLink(selection: ChartPointSelection): RouteLocationRaw | null {
  const line = chart.value.lineAt(selection.dataIndex)
  return line === null ? null : linkOf(line)
}

/** A click on a bar opens its entries. A phone's tap only shows the tooltip, and the table below holds the links. */
function openBar(selection: ChartPointSelection): void {
  if (phone.value) return
  const link = barLink(selection)
  if (link !== null) void router.push(link)
}

const subtitle = computed(() => (props.waiting ? rateWords.loading : (unratedNote(breakdown.value.total.unrated) ?? spanWords.value)))
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-3">
      <PeriodBar v-model:period="period" :window="window" :presets="PRESETS" />
      <ChoiceButtons v-model="grouping" :options="groupings" :label="words.analysis.breakdown.grouping" data-testid="spending-analysis-grouping" />
    </div>
    <ChartCard
      :title="words.analysis.breakdown.chartTitle"
      :subtitle="subtitle"
      :description="chart.description"
      :option="chart.option"
      :loading="waiting"
      :empty="chart.empty"
      :empty-title="words.analysis.breakdown.nothingSpent"
      :category-label="(category: string) => category"
      :link-at="barLink"
      :height="Math.max(160, 40 + 34 * chart.lineCount)"
      data-testid="spending-analysis-chart"
      @select="openBar"
    />
    <BreakdownTable :breakdown="breakdown" :grouping="grouping" :link-of="linkOf" :subtitle="subtitle" />
  </div>
</template>
