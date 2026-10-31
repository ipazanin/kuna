<script setup lang="ts">
import { computed, ref } from 'vue'

import { chartTokens } from '../../../../../shared/charts/chartTokens'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import DonutCard from '../../../../../shared/ui/DonutCard.vue'
import type { DonutPart } from '../../../../../shared/ui/DonutCard.vue'
import DrillLink from '../../../../../shared/ui/DrillLink.vue'
import MoneyText from '../../../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../filters/application/filterStore'
import type { DrillTarget } from '../../../filters/domain/drillTarget'
import type { FilteredLedger } from '../../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../workbook/application/useDisplayNames'
import type { TracedRate } from '../domain/cit/citLiability'
import { hrDooWorkbook } from '../domain/hrDooPart'
import { dividendComparison } from '../domain/ownerBenefits'
import type { OwnerBenefits } from '../domain/ownerBenefits'
import BuildUpButton from './BuildUpButton.vue'
import FigureDialog from './FigureDialog.vue'
import { benefitsRing, categorySeries } from './packCharts'
import { figureDetail } from './tracedFigureView'
import type { FigureDetail } from './tracedFigureView'
import { words } from './words'

/** The owner's parts of shared company costs by the category they come from, and the tax the same money would have paid as a dividend. */
const props = defineProps<{
  ledger: FilteredLedger
  benefits: OwnerBenefits
  /** The period in view, in words. */
  period: string
  /** The corporate rate Year works out for a year, on the rows as booked. */
  corporateRateOf: (year: number) => TracedRate
}>()

const { drillLocation } = useFilters()
const names = useDisplayNames()

const DEFAULTS = { path: '/company/settings', query: { tab: 'categories' } }
const ESTIMATE = words.benefits.estimate

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
  const listed = parts.map((part) => words.benefits.atShare(part.label, part.note ?? '', formatMoney(part.value))).join(', ')
  return {
    parts,
    total: formatMoney(props.benefits.total.amount),
    description: words.benefits.description(title.value, props.period, listed, formatMoney(props.benefits.total.amount)),
  }
})

const workbook = computed(() => hrDooWorkbook(props.ledger.booked))

type Comparison =
  { readonly state: 'unregistered' } | { readonly state: 'failed'; readonly failure: string } | { readonly state: 'ready'; readonly taxAvoided: FigureDetail; readonly asDividend: number }

const comparison = computed((): Comparison => {
  if (workbook.value.companyFacts.companyRegistered === null) {
    return { state: 'unregistered' }
  }
  try {
    const figures = dividendComparison(props.benefits.byYear, title.value, props.corporateRateOf)
    const taxAvoided = figureDetail(figures.taxAvoided, words.benefits.asDividend(title.value, props.period), (drill: DrillTarget | null) => (drill === null ? null : drillLocation(drill)))
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
      <p>{{ words.benefits.noneShared(period) }}</p>
      <DrillLink :to="DEFAULTS" class="self-start text-xs text-highlighted" data-testid="owner-benefits-defaults">{{ words.benefits.setDefaults }}</DrillLink>
    </div>
  </AppCard>
  <DonutCard
    v-else
    :title="title"
    :subtitle="words.benefits.subtitle(period)"
    :definition="words.benefits.definition"
    :description="ring.description"
    :parts="ring.parts"
    :total="ring.total"
    :total-label="words.benefits.toTheOwner"
    data-testid="owner-benefits"
  >
    <template #aside>
      <div class="flex flex-col" data-testid="owner-benefits-dividend">
        <template v-if="comparison.state === 'ready'">
          <p class="donut-row comparison-row">
            <span class="min-w-0 text-toned">{{ words.benefits.taxAvoided }}</span>
            <BuildUpButton :cents="comparison.taxAvoided.cents" :label="words.benefits.taxAvoided" class="shrink-0 font-medium text-highlighted" @open="dialogOpen = true" />
          </p>
          <p class="donut-row comparison-row">
            <span class="min-w-0 text-toned">{{ words.benefits.wouldNet }}</span>
            <MoneyText :cents="comparison.asDividend" class="shrink-0 text-highlighted" />
          </p>
        </template>
        <p v-else-if="comparison.state === 'unregistered'" class="note text-sm text-toned">
          {{ words.benefits.dividendNeeds }}<span class="identifier">hr_company_registered</span>{{ words.benefits.dividendNeedsAfter }}
          <DrillLink :to="{ path: '/company/settings', hash: '#company-registered' }" in-prose class="text-highlighted">{{ words.benefits.setOnSettings }}</DrillLink>
        </p>
        <p v-else class="note text-sm text-toned">{{ words.benefits.notWorkedOut(comparison.failure) }}</p>
        <div class="note flex flex-col items-start gap-1 text-xs">
          <p class="text-muted">{{ ESTIMATE }}</p>
          <DrillLink :to="DEFAULTS" class="text-highlighted" data-testid="owner-benefits-defaults">{{ words.benefits.setDefaults }}</DrillLink>
        </div>
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
}

/* Padded so its first line sits level with the text of the legend row beside it. */
.note {
  padding-top: 0.5rem;
}
</style>
