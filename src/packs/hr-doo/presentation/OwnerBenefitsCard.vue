<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CivilDate } from '../../../shared/calendar/civilDate'
import { chartTokens } from '../../../shared/charts/chartTokens'
import { formatWholeMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import DonutCard from '../../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import type { DrillTarget } from '../../../features/filters/domain/drillTarget'
import type { FilteredLedger } from '../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import type { TracedRate } from '../domain/cit/citLiability'
import { forecastYear } from '../domain/forecast/forecastYear'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { dividendComparison } from '../domain/ownerBenefits'
import type { OwnerBenefits } from '../domain/ownerBenefits'
import BuildUpButton from './BuildUpButton.vue'
import FigureDialog from './FigureDialog.vue'
import { benefitsRing, categorySeries } from './packCharts'
import { figureDetail } from './tracedFigureView'
import type { FigureDetail } from './tracedFigureView'

/** The owner's parts of shared company costs by the category they come from, and the tax the same money would have paid as a dividend. */
const props = defineProps<{
  ledger: FilteredLedger
  benefits: OwnerBenefits
  /** The period in view, in words. */
  period: string
  /** The newest booking, the day Year's forecast is seen on. */
  asOf: CivilDate
}>()

const { drillLocation } = useFilters()
const names = useDisplayNames()

const DEFAULTS = { path: '/settings', query: { tab: 'categories' } }
const ESTIMATE = 'Your estimate of private use. The accountant books these costs in full.'

const title = computed(() => names.value.category(props.benefits.category))

const ring = computed(() => {
  const categoryName = names.value.category
  const operating = props.ledger.workbook.categories.filter((category) => category.bucket === 'operating')
  const series = categorySeries(
    operating,
    props.benefits.bySource.map((source) => source.category),
    chartTokens(),
    categoryName,
  )
  const parts = benefitsRing(props.benefits, series, categoryName).map((part): DonutPart => ({ ...part, to: drillLocation(part.drill) }))
  const listed = parts.map((part) => `${part.label} at ${part.note} ${formatWholeMoney(part.value)}`).join(', ')
  return {
    parts,
    total: formatWholeMoney(props.benefits.total.amount),
    description: `${title.value} in ${props.period}, by the category each comes from: ${listed}. Together ${formatWholeMoney(props.benefits.total.amount)}.`,
  }
})

const workbook = computed(() => hrDooWorkbook(props.ledger.booked))

/** The corporate rate Year works out for a year, on the rows as booked. Each year's forecast runs once per workbook. */
const corporateRateOf = computed(() => {
  const books = workbook.value
  const asOf = props.asOf
  const known = new Map<number, TracedRate>()
  return (year: number): TracedRate => {
    const rate = known.get(year) ?? forecastYear(books, year, asOf).liability.rate
    known.set(year, rate)
    return rate
  }
})

type Comparison = { readonly state: 'unregistered' } | { readonly state: 'failed'; readonly failure: string } | { readonly state: 'ready'; readonly taxAvoided: FigureDetail; readonly asDividend: number }

const comparison = computed((): Comparison => {
  if (workbook.value.companyFacts.companyRegistered === null) {
    return { state: 'unregistered' }
  }
  try {
    const figures = dividendComparison(props.benefits.byYear, title.value, corporateRateOf.value)
    const taxAvoided = figureDetail(
      figures.taxAvoided,
      `${title.value} in ${props.period}, taken out as a dividend instead: corporate tax at the rate Year works out for the year each was paid in, then dividend tax at the rate of the year after.`,
      (drill: DrillTarget | null) => (drill === null ? null : drillLocation(drill)),
    )
    return { state: 'ready', taxAvoided, asDividend: figures.asDividend.amount }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed', failure: failure.message }
    }
    throw failure
  }
})

const dialogOpen = ref(false)
</script>

<template>
  <AppCard v-if="benefits.payments === 0" :title="title" :subtitle="period" data-testid="owner-benefits">
    <div class="flex flex-col gap-1 px-4 pt-1 pb-4 text-sm text-toned sm:px-5">
      <p>No company cost in {{ period }} was shared with the owner.</p>
      <DrillLink :to="DEFAULTS" class="self-start text-xs text-highlighted" data-testid="owner-benefits-defaults">Set the defaults</DrillLink>
    </div>
  </AppCard>
  <DonutCard
    v-else
    :title="title"
    :subtitle="`${period}. The owner's parts of company costs, by the category they come from.`"
    definition="Each category whose costs were shared with the owner, with the owner share its rows were counted at, or mixed when they differ. They count as owner pay with no tax on them."
    :description="ring.description"
    :parts="ring.parts"
    :total="ring.total"
    total-label="to the owner"
    data-testid="owner-benefits"
  >
    <template #aside>
      <div class="flex flex-col" data-testid="owner-benefits-dividend">
        <template v-if="comparison.state === 'ready'">
          <p class="comparison-row">
            <span class="min-w-0 text-toned">Tax avoided against a dividend</span>
            <BuildUpButton :cents="comparison.taxAvoided.cents" label="Tax avoided against a dividend" class="shrink-0 font-medium text-highlighted" @open="dialogOpen = true" />
          </p>
          <p class="comparison-row">
            <span class="min-w-0 text-toned">As a dividend you would net</span>
            <MoneyText :cents="comparison.asDividend" class="shrink-0 text-highlighted" />
          </p>
        </template>
        <p v-else-if="comparison.state === 'unregistered'" class="text-sm text-toned">
          The tax a dividend would cost needs <span class="identifier">hr_company_registered</span>, the day the first tax period starts.
          <DrillLink :to="{ path: '/settings', hash: '#company-registered' }" in-prose class="text-highlighted">Set it on Settings</DrillLink>
        </p>
        <p v-else class="text-sm text-toned">The tax a dividend would cost could not be worked out. {{ comparison.failure }}</p>
        <p class="mt-2 text-xs text-muted">{{ ESTIMATE }}</p>
        <DrillLink :to="DEFAULTS" class="mt-1 self-start text-xs text-highlighted" data-testid="owner-benefits-defaults">Set the defaults</DrillLink>
      </div>
      <FigureDialog v-if="comparison.state === 'ready'" v-model:open="dialogOpen" :detail="comparison.taxAvoided" />
    </template>
  </DonutCard>
</template>

<style scoped>
.comparison-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.75rem;
  border-bottom: 1px solid var(--border-default);
  font-size: 0.875rem;
}
</style>
