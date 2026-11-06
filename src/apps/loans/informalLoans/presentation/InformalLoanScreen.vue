<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { balanceChart } from '../../balances/presentation/balanceChart'
import { DIRECTION_LOOKS } from '../../directions/presentation/loanDirection'
import { planStanding } from '../domain/expectedPlan'
import { informalLoanNamed, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { Movement } from '../../workbook/domain/movement'
import InformalLoanDialog from './InformalLoanDialog.vue'
import { informalLoanChartMonths, informalLoanFigures } from '../domain/informalLoanFigures'
import { MOVEMENT_KIND_NAMES, informalLoanMoves, movementLines, standingWords, whoOwes } from './informalLoanView'
import MovementDialog from './MovementDialog.vue'
import { words } from './words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthInRange, wholeMonthsSpan } from '../../../../shared/charts/chartRange'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import ScreenSkeleton from '../../../../shared/ui/ScreenSkeleton.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { TONE_TEXT } from '../../../../shared/ui/toneText'

/** One informal loan: who owes how much and what made it so, how repayments stand against its expected plan, the balance over time, and its movements newest first. */
const { state } = useLoansBooks()
const route = useRoute()
const day = today()

const book = computed(() => (state.workbook === null ? null : informalLoanNamed(state.workbook, route.query.loan)))
const figures = computed(() => (book.value === null ? null : informalLoanFigures(book.value, day)))
const phone = usePhoneLayout()
const look = computed(() => DIRECTION_LOOKS[book.value?.loan.direction ?? 'you-owe'])
const chartMonths = computed(() => (book.value === null ? null : informalLoanChartMonths(book.value, day)))
const owedRange = useChartRange(
  () => {
    const months = chartMonths.value?.months ?? []
    const [first] = months
    const last = months.at(-1)
    return first === undefined || last === undefined ? null : wholeMonthsSpan(first.month, last.month)
  },
  () => day,
)
const chart = computed(() => {
  if (book.value === null || chartMonths.value === null) return null
  return balanceChart(
    chartMonths.value.months.filter((entry) => monthInRange(owedRange.window.value, entry.month)),
    monthOf(day),
    chartTokens(),
    phone.value,
    { token: look.value.token, moves: informalLoanMoves(book.value), expected: chartMonths.value.expected },
  )
})
const standing = computed(() => (book.value === null ? null : planStanding(book.value.loan, book.value.movements, day)))
const standingLine = computed(() => (book.value === null || standing.value === null ? null : standingWords(book.value.loan, standing.value)))
const planFacts = computed((): Fact[] => {
  const expected = book.value?.loan.expected ?? null
  if (expected === null || standing.value === null) return []
  const { next } = standing.value
  return [
    { label: words.plan.plan, value: words.plan.monthly(formatMoney(expected.monthly), expected.day), caption: words.plan.from(dayLabel(expected.from)) },
    { label: words.plan.expected, value: formatMoney(standing.value.expected) },
    { label: words.plan.repaid, value: formatMoney(standing.value.repaid) },
    next === null ? { label: words.plan.next, value: words.plan.nothingNext } : { label: words.plan.next, value: dayLabel(next.date), caption: formatMoney(next.amount) },
  ]
})
const lines = computed(() => (book.value === null ? [] : movementLines(book.value)))
const showAll = ref(false)
const shown = computed(() => (showAll.value ? lines.value : lines.value.slice(0, FIRST_SHOWN)))

const owedLabel = computed(() => {
  const owed = figures.value?.owedByYou ?? 0
  const name = book.value?.loan.counterparty ?? ''
  return owed === 0 ? words.hero.settled : owed < 0 ? words.hero.nameOwesYou(name) : words.hero.youOweName(name)
})

const facts = computed((): Fact[] => {
  if (book.value === null || figures.value === null) return []
  const { totals } = figures.value
  return [
    { label: words.hero.opening, value: formatMoney(book.value.loan.openingBalance), caption: dayLabel(book.value.loan.start) },
    { label: words.hero.raised, value: formatMoney(totals.raised) },
    { label: words.hero.repaid, value: formatMoney(totals.repaid) },
    { label: words.hero.forgiven, value: formatMoney(totals.forgiven) },
  ]
})

const editingLoan = ref(false)
const movementOpen = ref(false)
const editingMovement = ref<Movement | null>(null)

function openMovement(movement: Movement | null): void {
  editingMovement.value = movement
  movementOpen.value = true
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <UButton :to="LOANS_OVERVIEW_ROUTE" :label="words.allLoans" icon="i-lucide-arrow-left" color="neutral" variant="link" class="-mb-4 self-start px-0" data-testid="back-to-loans" />
    <template v-if="book !== null && figures !== null">
      <PageHeader
        :title="book.loan.name"
        :description="[book.loan.counterparty, book.loan.expected === null ? words.noPlan : words.noInterest, book.loan.note].filter((part) => part !== '').join('. ')"
      >
        <template #actions>
          <UButton :label="words.changeLoan" icon="i-lucide-pencil" color="neutral" variant="outline" data-testid="informal-loan-edit" @click="editingLoan = true" />
          <UButton :label="words.addMovement" icon="i-lucide-plus" data-testid="movement-add" @click="openMovement(null)" />
        </template>
      </PageHeader>
      <AppCard as="article" class="gap-5 p-4 sm:flex-row sm:gap-0 sm:p-5" data-testid="informal-loan-hero">
        <div class="flex min-w-0 flex-col gap-2 sm:flex-1 sm:pe-6">
          <UBadge :label="look.label" :icon="look.icon" :color="look.tone" variant="subtle" class="self-start" data-testid="loan-direction" />
          <p class="text-sm text-muted">{{ owedLabel }}</p>
          <MoneyText :cents="Math.abs(figures.owedByYou)" class="block text-figure-lg font-semibold text-highlighted sm:text-figure-xl" />
          <p class="type-caption">{{ words.hero.atTheEnd(dayLabel(day)) }}</p>
        </div>
        <FactGrid :facts="facts" class="border-t border-default pt-5 sm:flex-1 sm:border-t-0 sm:border-s sm:ps-6 sm:pt-0" />
      </AppCard>
      <AppCard v-if="standingLine !== null" :title="words.plan.title" :subtitle="words.plan.subtitle" data-testid="loan-plan-standing">
        <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
          <p class="flex items-center gap-2 type-body font-medium" :class="standingLine.tone === null ? 'text-highlighted' : TONE_TEXT[standingLine.tone]">
            <UIcon :name="standingLine.tone === 'warning' ? 'i-lucide-clock-alert' : 'i-lucide-circle-check'" class="size-4 shrink-0" aria-hidden="true" />
            {{ standingLine.text }}
          </p>
          <FactGrid :facts="planFacts" />
        </div>
      </AppCard>
      <DashboardGrid layout="tiles">
        <KpiTile
          :label="words.tiles.lastMovement"
          :value="figures.last === null ? words.tiles.noneYet : formatMoney(figures.last.amount)"
          :caption="figures.last === null ? words.tiles.startedOn(dayLabel(book.loan.start)) : words.tiles.kindOn(MOVEMENT_KIND_NAMES[figures.last.kind], dayLabel(figures.last.date))"
          :to="null"
        />
        <KpiTile :label="words.tiles.since" :value="dayLabel(book.loan.start)" :caption="plural(words.tiles.movements(lines.length), lines.length)" :to="null" />
      </DashboardGrid>
      <DashboardGrid layout="pair">
        <ChartCard
          v-if="chart !== null"
          v-model:range="owedRange.range.value"
          :title="words.balance.title"
          :subtitle="book.loan.direction === 'owed-to-you' ? words.balance.subtitleOwedToYou : words.balance.subtitle"
          :option="chart.option"
          :description="chart.description"
          :height="260"
          :phone-height="220"
          :ranges="owedRange.ranges.value"
          data-testid="loan-balance-chart"
        >
          <template #legend>
            <ChartLegend :entries="chart.legend" />
          </template>
        </ChartCard>
        <AppCard
          :title="words.movements.title"
          :subtitle="book.loan.direction === 'owed-to-you' ? words.movements.subtitleOwedToYou : words.movements.subtitle"
          collapse-id="loans.movements"
          :summary="plural(words.tiles.movements(lines.length), lines.length)"
          data-testid="movement-list"
        >
          <p v-if="lines.length === 0" class="px-4 pb-4 text-sm text-muted sm:px-5">{{ words.movements.none(formatMoney(book.loan.openingBalance)) }}</p>
          <ul v-else class="flex flex-col pb-2">
            <li v-for="line in shown" :key="line.movement.id" class="flex items-center gap-3 border-t border-default px-4 py-2 first:border-t-0 sm:px-5" data-testid="movement-line">
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-baseline gap-x-2 text-sm">
                  <span class="text-highlighted">{{ line.kind }}</span>
                  <MoneyText :cents="line.change" sign="always" />
                </p>
                <p class="text-xs text-muted">{{ [dayLabel(line.movement.date), line.movement.note].filter((part) => part !== '').join(', ') }}</p>
              </div>
              <p class="text-end text-xs text-muted">
                {{ whoOwes(line.owedAfter) }}<br />
                <MoneyText :cents="Math.abs(line.owedAfter)" class="text-sm text-toned" />
              </p>
              <UButton
                icon="i-lucide-pencil"
                color="neutral"
                variant="ghost"
                size="sm"
                :aria-label="words.movements.change(dayLabel(line.movement.date))"
                data-testid="movement-edit"
                @click="openMovement(line.movement)"
              />
            </li>
          </ul>
          <div v-if="lines.length > FIRST_SHOWN" class="px-4 pb-4 sm:px-5">
            <ShowAllButton v-model:expanded="showAll" :total="lines.length" />
          </div>
        </AppCard>
      </DashboardGrid>
      <InformalLoanDialog v-model:open="editingLoan" :book="book" />
      <MovementDialog v-model:open="movementOpen" :book="book" :editing="editingMovement" :today="day" />
    </template>
    <ScreenSkeleton v-else-if="state.workbook === null && state.status !== 'error'" />
    <template v-else-if="state.workbook !== null">
      <PageHeader :title="words.informalLoan" />
      <AppCard>
        <p class="px-4 py-6 text-sm text-muted sm:px-5" data-testid="loan-missing">{{ words.missing }}</p>
      </AppCard>
    </template>
  </section>
</template>
