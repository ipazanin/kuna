<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import { yearOf } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { formatMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import DrillLink from '../../../shared/ui/DrillLink.vue'
import { useFilters } from '../../../features/filters/application/filterStore'
import type { DrillTarget } from '../../../features/filters/domain/drillTarget'
import type { LoanBenefit } from '../domain/ownerLoanInterest'
import { percentText } from '../domain/payroll/payrollArithmetic'
import { dayLabel, ruleLink } from '../ruleset/presentation/ruleWording'
import BuildUpButton from './BuildUpButton.vue'
import FigureDialog from './FigureDialog.vue'
import { figureDetail } from './tracedFigureView'
import type { FigureDetail } from './tracedFigureView'

/** The benefit in kind of the loans to the owner, year by year, each opening how it is worked out. */
const props = defineProps<{
  /** Newest first, as `loanBenefitByYear` gives them. */
  benefits: readonly LoanBenefit[]
  asOf: CivilDate
}>()

const { drillLocation } = useFilters()
const route = useRoute()

const RULE = 'hr.pit.loan-benefit' as const

const newest = computed(() => props.benefits[0] ?? null)
const enough = computed(() => newest.value !== null && newest.value.carried >= newest.value.prescribed)
const rates = computed(() => (newest.value === null ? null : { prescribed: percentText(newest.value.prescribed), carried: percentText(newest.value.carried) }))

function through(benefit: LoanBenefit): string {
  return benefit.year === yearOf(props.asOf) ? `${benefit.year}, to ${dayLabel(props.asOf)}` : String(benefit.year)
}

const lines = computed(() =>
  props.benefits.map((benefit) => ({
    key: String(benefit.year),
    label: through(benefit),
    loans: `${benefit.loans} ${benefit.loans === 1 ? 'loan' : 'loans'} with a balance`,
    detail: figureDetail(
      benefit.figure,
      `At ${percentText(benefit.prescribed)} a year less the ${percentText(benefit.carried)} the loans carry, on each day's balance ${benefit.year === yearOf(props.asOf) ? `up to ${dayLabel(props.asOf)}` : `in ${benefit.year}`}.`,
      (drill: DrillTarget | null) => (drill === null ? null : drillLocation(drill)),
    ),
  })),
)

const summary = computed(() => {
  const first = lines.value[0]
  return enough.value || first === undefined ? 'No benefit in kind' : `${formatMoney(first.detail.cents)} in ${first.label}`
})

const opened = ref<FigureDetail | null>(null)
const dialogOpen = ref(false)

function open(detail: FigureDetail): void {
  opened.value = detail
  dialogOpen.value = true
}
</script>

<template>
  <AppCard
    v-if="newest && rates"
    id="owner-loan-benefit"
    title="Benefit in kind on the loans"
    collapse-id="owner.loan-benefit"
    :summary="summary"
    :reveal="route.hash === '#owner-loan-benefit'"
    data-testid="owner-loan-benefit"
  >
    <template #subtitle>
      <span class="block max-w-[65ch]">
        The loans to the owner carry {{ rates.carried }} a year. The income tax law counts a loan from an employer below {{ rates.prescribed }} as pay in kind, worth the
        difference on each day's balance, and it is taxed through payroll.
      </span>
    </template>
    <div class="flex flex-col gap-3 px-4 pt-1 pb-4 sm:px-5">
      <p v-if="enough" class="text-sm text-toned" data-testid="loan-benefit-none">
        At {{ rates.carried }} the loans carry at least the {{ rates.prescribed }} the law sets, so they give no benefit in kind.
      </p>
      <ul v-else class="flex flex-col" data-testid="loan-benefit-years">
        <li v-for="line in lines" :key="line.key" class="benefit-row">
          <div class="min-w-0">
            <p class="text-sm text-toned">{{ line.label }}</p>
            <p class="text-xs text-muted">{{ line.loans }}</p>
          </div>
          <BuildUpButton :cents="line.detail.cents" :label="`Benefit in kind in ${line.label}`" class="shrink-0 text-sm text-highlighted" @open="open(line.detail)" />
        </li>
      </ul>
      <p class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
        <DrillLink :to="ruleLink(RULE)" class="text-highlighted" data-testid="loan-benefit-rule">The rule and its source</DrillLink>
        <DrillLink to="/workbook" class="text-highlighted">Set the rate the loans carry</DrillLink>
      </p>
    </div>
    <FigureDialog v-model:open="dialogOpen" :detail="opened" />
  </AppCard>
</template>

<style scoped>
.benefit-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.75rem;
  padding-block: 0.375rem;
}

.benefit-row + .benefit-row {
  border-top: 1px solid var(--border-default);
}
</style>
