<script setup lang="ts">
import { computed, ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { investingRhythm } from '../domain/investingRhythm'
import { projection } from '../domain/projection'
import type { PortfolioSources } from '../../holdings/domain/holding'
import { projectionChart, savingChart } from './incomeCharts'
import { words } from './words'
import { yearOf } from '../../../../shared/calendar/civilDate'
import { monthOf } from '../../../../shared/calendar/monthKey'
import { monthName } from '../../../../shared/calendar/monthLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { decimalText, typedDecimal } from '../../../../shared/money/decimal'
import { ZERO } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatCount, formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../../../shared/ui/FactGrid.vue'
import type { Fact } from '../../../../shared/ui/FactGrid.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** How regularly money went in over the last 24 months, and where the value could get with a saving, a return and years typed here and kept nowhere. */
const props = defineProps<{
  sources: PortfolioSources
  /** The portfolio's value today, which the projection grows from. */
  value: Money
}>()

const MOST_YEARS = 60
const MOST_PERCENT = 100

const text = words.saving
const projectionText = words.projection
const phone = usePhoneLayout()

const rhythm = computed(() => investingRhythm(props.sources.book, props.sources.today))
const rhythmChart = computed(() => savingChart(rhythm.value, chartTokens(), phone.value))

const eachMonth = ref(amountForTyping(rhythm.value.averageMonth > 0 ? rhythm.value.averageMonth : ZERO))
const rate = ref('5')
const years = ref('20')

const typedMonthly = computed(() => {
  const amount = typedAmount(eachMonth.value)
  return amount !== null && amount >= 0 ? amount : null
})
/** The return as a fraction, typed in percent. */
const typedRate = computed(() => {
  const percent = typedDecimal(rate.value)
  const fraction = percent === null ? null : Number(decimalText(percent)) / 100
  return fraction !== null && fraction >= 0 && fraction <= MOST_PERCENT / 100 ? fraction : null
})
const typedYears = computed(() => {
  const count = typedCount(years.value)
  return count !== null && count <= MOST_YEARS ? count : null
})

const projected = computed(() =>
  typedMonthly.value === null || typedRate.value === null || typedYears.value === null ? null : projection(props.value, typedMonthly.value, typedRate.value, typedYears.value),
)
const lineChart = computed(() =>
  projected.value === null || typedMonthly.value === null || typedRate.value === null
    ? null
    : projectionChart(projected.value, typedMonthly.value, typedRate.value, yearOf(props.sources.today), chartTokens(), phone.value),
)
const facts = computed((): Fact[] =>
  projected.value === null
    ? []
    : [
        { label: projectionText.atTheEnd, value: formatMoney(projected.value.end), caption: projectionText.fromToday(formatMoney(props.value)) },
        ...projected.value.withdrawals.map((withdrawal) => ({
          label: projectionText.takeOut(formatRate(withdrawal.rate)),
          value: formatMoney(withdrawal.yearly),
          caption: projectionText.yearlyAndMonthly(formatMoney(withdrawal.monthly)),
        })),
      ],
)
</script>

<template>
  <div class="flex flex-col gap-6">
    <DashboardGrid layout="tiles" data-testid="saving-tiles">
      <KpiTile
        :label="text.inARow"
        :value="formatCount(rhythm.inARow)"
        :to="null"
        :caption="rhythm.thisMonthWaits ? text.noneYet(monthName(monthOf(sources.today))) : ''"
        data-testid="saving-in-a-row"
      />
      <KpiTile :label="text.longestRun" :value="formatCount(rhythm.longestRun)" :to="null" data-testid="saving-longest" />
      <KpiTile :label="text.average" :value="formatMoney(rhythm.averageMonth)" :to="null" data-testid="saving-average" />
    </DashboardGrid>
    <DashboardGrid>
      <ChartCard
        :title="text.title"
        :subtitle="text.subtitle"
        :option="rhythmChart.option"
        :description="rhythmChart.description"
        :phone-height="220"
        class="xl:col-span-2 3xl:col-span-1"
        data-testid="saving-months"
      />
      <AppCard :title="projectionText.title" :subtitle="projectionText.subtitle" data-testid="projection">
        <div class="flex flex-col gap-4 px-4 pt-3 pb-4 sm:px-5">
          <FormGrid>
            <UFormField :label="projectionText.eachMonth" :error="typedMonthly === null ? projectionText.errors.eachMonth : false">
              <MoneyInput v-model="eachMonth" class="w-full" data-testid="projection-each-month" />
            </UFormField>
            <UFormField :label="projectionText.rate" :error="typedRate === null ? projectionText.errors.rate : false">
              <UInput v-model="rate" inputmode="decimal" class="w-full" data-testid="projection-rate">
                <template #trailing><span class="text-muted">%</span></template>
              </UInput>
            </UFormField>
            <UFormField :label="projectionText.years" :error="typedYears === null ? projectionText.errors.years : false">
              <UInput v-model="years" inputmode="numeric" class="w-full" data-testid="projection-years" />
            </UFormField>
          </FormGrid>
          <FactGrid v-if="facts.length > 0" :facts="facts" data-testid="projection-facts" />
        </div>
      </AppCard>
      <ChartCard
        v-if="lineChart !== null"
        :title="projectionText.chartTitle"
        :subtitle="projectionText.subtitle"
        :option="lineChart.option"
        :description="lineChart.description"
        :phone-height="220"
        data-testid="projection-chart"
      />
    </DashboardGrid>
  </div>
</template>
