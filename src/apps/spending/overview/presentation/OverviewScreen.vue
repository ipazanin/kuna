<script setup lang="ts">
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { askChat } from '../../../../shared/ai/presentation/chatDock'
import { words as chatWords } from '../../../../shared/ai/presentation/words'
import { stillNew } from '../../../../shared/app/setUpLines'
import { words as assistantWords } from '../../assistant/words'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteLocationRaw } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'

import { monthFlow } from '../../analytics/domain/monthFlow'
import { groupMonthsChart } from '../../analytics/presentation/groupMonthsChart'
import { monthFlowChart } from '../../analytics/presentation/monthFlowChart'
import { spendingFigures } from '../../analytics/presentation/spendingFigures'
import { words as figureWords } from '../../analytics/presentation/words'
import { leftToSpend, limitsUnrated } from '../../budgets/domain/budgetCarry'
import { categoryTree, fixedCategories } from '../../categories/domain/categoryTree'
import { categoryColours } from '../../categories/presentation/categoryColours'
import { words as homeWords } from '../../home/presentation/words'
import { waitsForRates } from '../../rates/presentation/waitsForRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import { unratedNote } from '../../rates/presentation/unratedNote'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { words as rateWords } from '../../rates/presentation/words'
import { words as screenWords } from '../../screenWords'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import AccountsCard from './AccountsCard.vue'
import LimitsCard from './LimitsCard.vue'
import { SPENDING_BUDGETS_ROUTE, SPENDING_OVERVIEW_ROUTE, categoryIdNamed, transactionsLink } from './spendingLinks'
import AccountDialog from '../../accounts/presentation/AccountDialog.vue'
import { spendingRing } from './spendingRing'
import { spendingSetUp } from './spendingSetUp'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { addMonths, firstDayOf, monthOf, monthsFrom } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney, formatShare } from '../../../../shared/money/moneyFormat'
import RecordProblemsAlert from '../../../../shared/storage/presentation/RecordProblemsAlert.vue'
import { fileKeptNote } from '../../../../shared/storage/presentation/fileKeptNote'
import { plural } from '../../../../shared/text/translation'
import type { ChartPointSelection } from '../../../../shared/ui/ChartCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import DonutCard from '../../../../shared/ui/DonutCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import GettingSetUpCard from '../../../../shared/ui/GettingSetUpCard.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'

/** This month's spending by group and against its limits, income and saving month by month, and the accounts. */
const { state } = useSpendingBooks()
const rates = useRates()
const route = useRoute()
const router = useRouter()
const phone = usePhoneLayout()
const day = today()
const month = monthOf(day)

const addingAccount = ref(false)

const loading = computed(() => state.workbook === null && state.status !== 'error')
const fileNote = computed(() => fileKeptNote(state.choice, words.empty))

/** While the ECB rates load, a file with a foreign account shows no euro figure rather than one that leaves its rows out. */
const waiting = computed(() => waitsForRates(state.workbook?.accounts ?? [], rates.value))
const figures = computed(() => (state.workbook === null ? null : spendingFigures(state.workbook, everydayRates(rates.value))))
const totals = computed(() => figures.value?.totalsOf(month) ?? null)
const limits = computed(() => figures.value?.limitsIn(month) ?? [])
const savingsRate = computed(() => (totals.value === null ? null : (monthFlow([totals.value])[0]?.savingsRate ?? null)))
const unratedLine = computed(() => (waiting.value ? null : unratedNote(totals.value?.unrated ?? 0)))

const categories = computed(() => state.workbook?.categories ?? [])
const categoriesById = computed(() => new Map(categories.value.map((category) => [category.id, category])))
const colourOf = computed(() => categoryColours(categories.value))
const spendingGroups = computed(() => categoryTree(categories.value, ['spending']).map((entry) => entry.group))
const savingCategory = computed(() => fixedCategories(categories.value).find((category) => category.kind === 'saving') ?? null)

const openedGroup = computed(() => {
  const id = categoryIdNamed(route.query.group)
  return spendingGroups.value.find((group) => group.id === id) ?? null
})
const ring = computed(() => (totals.value === null ? null : spendingRing(totals.value, categories.value, colourOf.value, month, openedGroup.value)))

/** From the month of the first entry, at most twelve months back, to this month. */
const chartMonths = computed(() => {
  const first = state.workbook?.transactions[0]
  const earliest = addMonths(month, -11)
  const from = first === undefined ? month : monthOf(first.date) > earliest ? monthOf(first.date) : earliest
  return monthsFrom(from, month)
})
const monthTotals = computed(() => {
  const counted = figures.value
  return counted === null ? [] : chartMonths.value.map((shown) => counted.totalsOf(shown))
})
const groupsChart = computed(() => groupMonthsChart(monthTotals.value, spendingGroups.value, colourOf.value, month, chartTokens()))
const flowChart = computed(() => monthFlowChart(monthFlow(monthTotals.value), month, chartTokens()))

function groupMonthLink(selection: ChartPointSelection): RouteLocationRaw | null {
  const group = groupsChart.value.groupAt(selection.seriesName)
  const shown = chartMonths.value[selection.dataIndex]
  return group === null || shown === undefined ? null : transactionsLink(shown, group)
}

/** A click on a bar opens the group's entries of that month. A phone's tap only shows the tooltip, and the table view holds the links. */
function openGroupMonth(selection: ChartPointSelection): void {
  if (phone.value) return
  const link = groupMonthLink(selection)
  if (link !== null) void router.push(link)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader :title="screenWords.overview" :description="words.description" />
    <ScreenSkeleton v-if="loading" :heading="false" :cards="3" data-testid="spending-loading" />
    <template v-else-if="state.workbook !== null && totals !== null && ring !== null">
      <RecordProblemsAlert
        v-if="state.workbook.problems.length > 0"
        :title="plural(words.problems.title(state.workbook.problems.length), state.workbook.problems.length)"
        :problems="state.workbook.problems"
        data-testid="spending-problems"
      />
      <EmptyState v-if="state.workbook.accounts.length === 0" icon="i-lucide-wallet" :title="words.empty.title" data-testid="spending-empty">
        <template #description>
          <span class="block">{{ words.empty.description }}</span>
        </template>
        <template #actions>
          <div class="flex flex-col items-center gap-4">
            <div class="flex flex-wrap justify-center gap-2">
              <UButton :label="words.empty.addAccount" icon="i-lucide-plus" data-testid="spending-overview-add-account" @click="addingAccount = true" />
              <AskChatButton :text="chatWords.ask.setUp" size="md" data-testid="set-up-chat" @ask="askChat(assistantWords.guides.setUp.title)" />
            </div>
            <span class="type-caption">{{ fileNote }}</span>
          </div>
        </template>
      </EmptyState>
      <template v-else>
        <GettingSetUpCard :lines="spendingSetUp(state.workbook)">
          <template v-if="stillNew(spendingSetUp(state.workbook))" #actions>
            <AskChatButton :text="chatWords.ask.setUp" data-testid="set-up-chat" @ask="askChat(assistantWords.guides.setUp.title)" />
          </template>
        </GettingSetUpCard>
        <DashboardGrid layout="tiles" data-testid="spending-tiles">
          <KpiTile :label="figureWords.spent" :value="formatMoney(totals.spent)" :caption="monthLabel(month)" :to="transactionsLink(month)" data-testid="spending-spent">
            <template v-if="waiting" #value>
              <span class="block type-body font-normal">{{ rateWords.loading }}</span>
            </template>
          </KpiTile>
          <KpiTile :label="figureWords.income" :value="formatMoney(totals.income)" :caption="monthLabel(month)" :to="transactionsLink(month)" data-testid="spending-income">
            <template v-if="waiting" #value>
              <span class="block type-body font-normal">{{ rateWords.loading }}</span>
            </template>
          </KpiTile>
          <KpiTile :label="figureWords.saved" :value="formatMoney(totals.saved)" :caption="monthLabel(month)" :to="transactionsLink(month, savingCategory)" data-testid="spending-saved">
            <template v-if="waiting" #value>
              <span class="block type-body font-normal">{{ rateWords.loading }}</span>
            </template>
          </KpiTile>
          <KpiTile
            :label="figureWords.savingsRate"
            :value="savingsRate === null ? words.tiles.noIncome : formatShare(savingsRate)"
            :definition="words.tiles.savingsRateDefinition"
            :to="null"
            data-testid="spending-savings-rate"
          >
            <template v-if="waiting || savingsRate === null" #value>
              <span class="block type-body font-normal">{{ waiting ? rateWords.loading : words.tiles.noIncome }}</span>
            </template>
          </KpiTile>
          <KpiTile v-if="limits.length > 0" :label="homeWords.leftThisMonth" :value="formatMoney(leftToSpend(limits))" :to="SPENDING_BUDGETS_ROUTE" data-testid="spending-left">
            <template v-if="waiting" #value>
              <span class="block type-body font-normal">{{ rateWords.loading }}</span>
            </template>
          </KpiTile>
        </DashboardGrid>
        <p v-if="unratedLine !== null" class="type-caption" data-testid="spending-unrated">{{ unratedLine }}</p>
        <DashboardGrid data-testid="spending-cards">
          <DonutCard
            v-if="ring.parts.length > 0"
            :title="ring.group === null ? words.donut.title : words.donut.groupTitle(ring.group.name)"
            :subtitle="waiting ? rateWords.loading : monthLabel(month)"
            :description="ring.description"
            :parts="ring.parts"
            :total="formatMoney(ring.total)"
            :total-label="words.donut.totalLabel"
            :opens="ring.opens"
            data-testid="spending-donut"
          >
            <template v-if="ring.group !== null" #actions>
              <UButton :to="SPENDING_OVERVIEW_ROUTE" :label="words.donut.allGroups" icon="i-lucide-arrow-left" color="neutral" variant="ghost" size="sm" data-testid="spending-donut-back" />
            </template>
          </DonutCard>
          <EmptyState v-else icon="i-lucide-chart-pie" :title="words.donut.nothing" :description="words.donut.nothingNote" data-testid="spending-donut-empty" />
          <LimitsCard v-if="limits.length > 0" :limits="limits" :note="waiting ? null : unratedNote(limitsUnrated(limits))" :categories="categoriesById" :colour-of="colourOf" />
          <ChartCard
            :title="words.months.title"
            :subtitle="words.months.subtitle"
            :description="groupsChart.description"
            :option="groupsChart.option"
            :loading="waiting"
            :empty="groupsChart.legend.length === 0"
            :link-at="groupMonthLink"
            :height="300"
            :phone-height="260"
            data-testid="spending-months"
            @select="openGroupMonth"
          >
            <template #legend><ChartLegend :entries="groupsChart.legend" /></template>
          </ChartCard>
          <ChartCard
            :title="words.flow.title"
            :subtitle="words.flow.subtitle"
            :description="flowChart.description"
            :option="flowChart.option"
            :loading="waiting"
            :height="300"
            :phone-height="260"
            data-testid="spending-flow"
          >
            <template #legend><ChartLegend :entries="flowChart.legend" /></template>
            <template #table>
              <caption class="sr-only">
                {{
                  words.flow.title
                }}
              </caption>
              <thead>
                <tr>
                  <th scope="col" class="text-start">
                    <span class="sr-only">{{ figureWords.flow.monthHeading }}</span>
                  </th>
                  <th v-for="column in flowChart.table.columns" :key="column" scope="col" class="text-end">{{ column }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in flowChart.table.rows" :key="row.month">
                  <th scope="row" class="text-start font-normal text-toned">{{ row.label }}</th>
                  <td v-for="(cell, index) in row.cells" :key="index" class="figure text-end">{{ cell }}</td>
                </tr>
              </tbody>
            </template>
          </ChartCard>
          <AccountsCard :book="state.workbook" :rates="rates" :day="day" />
        </DashboardGrid>
      </template>
    </template>
    <AccountDialog v-model:open="addingAccount" :account="null" :opening-day="firstDayOf(month)" />
  </section>
</template>
