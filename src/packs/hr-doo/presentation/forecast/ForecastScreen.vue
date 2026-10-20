<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import KpiTile from '../../../../shared/ui/KpiTile.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../../../features/filters/application/filterStore'
import DrillChartCard from '../../../../features/filters/presentation/DrillChartCard.vue'
import { useSettings } from '../../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../../features/transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../../../features/workbook/application/useDisplayNames'
import { newestBookingOf } from '../../../../features/workbook/domain/workbook'
import LedgerGate from '../../../../features/workbook/presentation/LedgerGate.vue'
import { RULESET_CHECKED_ON } from '../../ruleset/ruleset'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import ConfidenceBadge from '../../ruleset/presentation/ConfidenceBadge.vue'
import type { PayoutOptionId } from '../../domain/dividend/dividendCapacity'
import { planDefaults } from '../../domain/forecast/forecastYear'
import { employmentFreeFrom } from '../../domain/scenarios/startingScenarios'
import CitObligationList from '../CitObligationList.vue'
import MissingRoles from '../MissingRoles.vue'
import OwnerPayOff from '../OwnerPayOff.vue'
import { WATCHED_WORDING } from '../payScenarios/payScenariosView'
import BuildUpList from './BuildUpList.vue'
import DividendCard from './DividendCard.vue'
import { forecastChart } from './forecastChart'
import { forecastView } from './forecastView'
import PlanActualList from './PlanActualList.vue'
import PlanEditor from './PlanEditor.vue'

const ledger = useFilteredLedger()
const settings = useSettings()
const names = useDisplayNames()
const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const checkedOn = dayLabel(RULESET_CHECKED_ON)

/** The newest booking, which the forecast is seen on: rows up to it count, and its month is still running. */
const asOf = computed((): CivilDate | null => newestBookingOf(ledger.value?.workbook.transactions ?? []))

const years = computed(() => (asOf.value === null ? [] : [yearOf(asOf.value), yearOf(asOf.value) + 1]))

const year = computed(() => {
  const asked = Number(route.query.year)
  return years.value.includes(asked) ? asked : (years.value[0] ?? null)
})

function pickYear(picked: number): void {
  void router.replace({ query: { ...route.query, year: String(picked) } })
}

const PAYOUTS: readonly PayoutOptionId[] = ['after-adoption', 'interim', 'keep']

/** The payout option lives in the address, so a reload or a shared link keeps it and nothing is written. */
const payout = computed((): PayoutOptionId => PAYOUTS.find((id) => id === route.query.payout) ?? 'after-adoption')

function pickPayout(picked: PayoutOptionId): void {
  void router.replace({ query: { ...route.query, payout: picked === 'after-adoption' ? undefined : picked } })
}

const view = computed(() => {
  const current = ledger.value
  const shown = year.value
  const day = asOf.value
  if (current === null || shown === null || day === null) {
    return null
  }
  if (current.workbook.settings.companyFacts.companyRegistered === null) {
    return { state: 'unregistered' as const }
  }
  try {
    const shaped = forecastView(current.workbook, shown, day, {
      link: (drill) => (drill === null ? null : drillLocation(drill)),
    })
    return { state: 'ready' as const, ...shaped, chart: forecastChart(shaped.chartMonths, shaped.running, chartTokens()) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed' as const, failure: failure.message }
    }
    throw failure
  }
})

/** The editor needs no tax facts, so it is there while the forecast waits for one. */
const editor = computed(() => {
  const current = ledger.value
  const shown = year.value
  const day = asOf.value
  if (current === null || shown === null || day === null) {
    return null
  }
  const { workbook } = current
  const switchOn = employmentFreeFrom(shown, workbook.grants)
  return {
    year: shown,
    lines: workbook.planLines.filter((line) => line.year === shown),
    defaults: planDefaults(workbook, shown, day),
    categories: workbook.categories,
    scenarios: workbook.payScenarios.filter((scenario) => scenario.year === shown),
    notCounted: view.value?.state === 'ready' ? view.value.notCounted : new Map<number, string>(),
    suggestedSwitch: switchOn === null || switchOn === `${shown}-01-01` ? null : switchOn,
  }
})
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Forecast" description="Where will this year end, and what is due in tax? The ledger's complete months, then the plan or each line's average for the rest.">
      <template v-if="years.length > 0 && settings.ownerPayModule" #actions>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Year" data-testid="year-picker">
          <UButton
            v-for="entry in years"
            :key="entry"
            :label="String(entry)"
            size="sm"
            color="neutral"
            :variant="entry === year ? 'solid' : 'outline'"
            :aria-pressed="entry === year"
            @click="pickYear(entry)"
          />
        </div>
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <UEmpty
        v-if="view && view.state === 'unregistered'"
        icon="i-lucide-calendar-x"
        title="The forecast needs the day the company was registered"
        description="The tax periods, the advances and the balance due all count from it. Set hr_company_registered on the settings tab, such as 2025-05-12."
        :actions="[{ label: 'Open the Workbook screen', to: '/workbook', color: 'neutral', variant: 'outline' }]"
        variant="outline"
        class="rounded-card border-dashed bg-raised/40"
        data-testid="forecast-unregistered"
      />
      <UEmpty
        v-else-if="view && view.state === 'failed'"
        icon="i-lucide-triangle-alert"
        title="The year could not be forecast"
        :description="view.failure"
        :actions="[{ label: 'Open the Workbook screen', to: '/workbook', color: 'neutral', variant: 'outline' }]"
        variant="outline"
        class="rounded-card border-error/40 bg-raised"
        :ui="{ avatar: 'text-error' }"
      />
      <template v-else-if="view && view.state === 'ready'">
        <UAlert
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="Planning figures to discuss with your accountant, not filing advice"
          :description="`The rules behind them were last checked against their sources on ${checkedOn}. The forecast is seen on ${dayLabel(view.forecast.asOf)}, the newest booking.`"
          data-testid="planning-banner"
        />

        <div v-if="view.watched.length > 0" class="flex flex-col gap-2 text-sm text-toned" data-testid="forecast-watched">
          <p v-for="group in view.watched" :key="group.confidence" class="flex items-start gap-2">
            <ConfidenceBadge :confidence="group.confidence" />
            <span class="min-w-0">{{ WATCHED_WORDING[group.confidence] }} for {{ year }}: {{ group.rules.map((rule) => rule.title).join(', ') }}.</span>
          </p>
        </div>

        <div v-if="view.employment.length > 0 || view.grantReleased > 0" class="flex flex-col gap-2 text-sm text-toned" data-testid="forecast-grants">
          <p v-if="view.grantReleased > 0" class="flex items-start gap-2">
            <UIcon name="i-lucide-hand-coins" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>The grants release <MoneyText :cents="view.grantReleased" /> in {{ year }}, on the Assets screen's schedule.</span>
          </p>
          <p v-for="line in view.employment" :key="line" class="flex items-start gap-2">
            <UIcon name="i-lucide-briefcase" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
            <span>{{ line }}</span>
          </p>
        </div>

        <div v-if="view.missingRoles.length > 0 || view.uninvoiced.length > 0" class="flex flex-col gap-3">
          <MissingRoles :missing="view.missingRoles" />
          <div v-if="view.uninvoiced.length > 0" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-file-question-mark" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <p>
              No invoice delivers in {{ view.uninvoiced.map((entry) => entry.month).join(', ') }}, though a later one does, so revenue reads nothing there. Fill
              <span class="identifier">period_from</span> and <span class="identifier">period_to</span> on the invoice that covers it.
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="forecast-tiles">
          <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
        </div>

        <DrillChartCard
          :chart="view.chart"
          :title="`Month by month, ${year}`"
          subtitle="Income above zero, costs below it and profit before tax as a line. A hatched bar is planned or averaged. A bar the ledger settles opens its rows."
          definition="Complete months come from the ledger as the accountant books them. The running month and later ones take the plan row for the line, or for revenue the billing plan's rows still to invoice, else its average over the last twelve complete months."
          :height="320"
          :phone-height="260"
        >
          <template #legend><ChartLegend :entries="view.chart.legend" /></template>
        </DrillChartCard>

        <div class="grid gap-4 xl:grid-cols-2">
          <AppCard
            title="Profit and loss"
            subtitle="By the lines the accountant prints. Open a line for what it adds up and the months a plan row or an average stands in for."
            collapse-id="forecast.profit-and-loss"
            :summary="view.profitAndLossSummary"
          >
            <div class="px-4 pt-2 pb-3 sm:px-5">
              <BuildUpList :lines="view.profitAndLoss" test-id="forecast-profit-and-loss" />
            </div>
          </AppCard>
          <AppCard
            title="Profit tax return, PD"
            subtitle="From profit to the tax, the advances and the balance, by form line. Open a line for its steps and rules."
            collapse-id="forecast.pd-return"
            :summary="view.pdReturnSummary"
          >
            <div class="px-4 pt-2 pb-3 sm:px-5">
              <BuildUpList :lines="view.pdReturn" test-id="forecast-pd-return" />
            </div>
          </AppCard>
        </div>

        <AppCard
          title="Corporate tax payments, expected against paid"
          subtitle="The balance due on last year's return and this year's advances. The bank rows fill them oldest due date first, since the annual payment and the advances share one payment code."
          collapse-id="forecast.advances"
          :summary="view.obligationsSummary"
          data-testid="forecast-advances"
        >
          <div class="grid gap-3 px-4 pt-3 sm:grid-cols-3 sm:px-5">
            <div class="next-figure">
              <p class="text-xs text-muted">Advances for {{ year }}</p>
              <p class="text-sm font-medium text-highlighted"><MoneyText :cents="view.advancesPaid.amount" /> paid</p>
              <p class="text-xs text-muted"><MoneyText :cents="view.advancesToCome.amount" /> still to come, PD line 56</p>
            </div>
            <div class="next-figure" data-testid="balance-due">
              <p class="text-xs text-muted">Balance due on the {{ year }} return</p>
              <template v-if="view.balanceDue">
                <p class="text-sm font-medium text-highlighted"><MoneyText :cents="view.balanceDue.cents" /></p>
                <p class="text-xs text-muted">By {{ view.balanceDue.dueOn }}</p>
              </template>
              <template v-else>
                <p class="text-sm font-medium text-highlighted">Nothing left to pay</p>
                <p class="text-xs text-muted">
                  <template v-if="view.refund !== null">The advances overpay it by <MoneyText :cents="view.refund" />, a refund or a credit.</template>
                  <template v-else>The advances cover the liability.</template>
                </p>
              </template>
            </div>
            <div class="next-figure" data-testid="new-advance">
              <p class="text-xs text-muted">New monthly advance</p>
              <template v-if="view.newAdvance">
                <p class="text-sm font-medium text-highlighted"><MoneyText :cents="view.newAdvance.cents" /></p>
                <p class="text-xs text-muted">From the {{ view.newAdvance.month }} advance, due {{ view.newAdvance.dueOn }}</p>
              </template>
              <template v-else>
                <p class="text-sm font-medium text-highlighted">None</p>
                <p class="text-xs text-muted">The liability sets no advance.</p>
              </template>
            </div>
          </div>
          <div v-if="view.unmatched.length > 0" class="flex items-start gap-2 px-4 pt-3 text-sm text-toned sm:px-5" data-testid="unmatched-payments">
            <UIcon name="i-lucide-circle-alert" class="mt-0.5 size-4 shrink-0 text-error" aria-hidden="true" />
            <div class="flex min-w-0 flex-col gap-1">
              <p>Payments no obligation takes, and refunds:</p>
              <ul class="flex flex-col">
                <li v-for="payment in view.unmatched" :key="payment.key" class="flex items-baseline justify-between gap-3">
                  <DrillLink :to="payment.to" :label="`${payment.label}, open the row`" class="min-w-0 truncate">{{ payment.label }}</DrillLink>
                  <MoneyText :cents="payment.cents" sign="always" />
                </li>
              </ul>
            </div>
          </div>
          <div class="px-4 pt-3 pb-4 sm:px-3">
            <p v-if="view.obligations.length === 0" class="px-2 py-4 text-sm text-muted">A first tax period pays no advances, and no earlier return leaves a balance.</p>
            <CitObligationList v-else :lines="view.obligations" test-id="forecast-obligations" />
          </div>
        </AppCard>

        <DividendCard
          :year="view.forecast.year"
          :capacity="view.capacityLines"
          :prudence="view.prudenceLines"
          :deterioration="view.deterioration"
          :decide-by="view.decideBy"
          :payouts="view.payouts"
          :chosen="payout"
          @choose="pickPayout"
        />

        <AppCard
          :title="`Cash by month, ${year}`"
          :subtitle="`The bank balance at each month end the ledger has passed, then projected as each month is paid. ${view.paymentLag}.`"
          collapse-id="forecast.cash"
          :summary="view.cashSummary"
          data-testid="forecast-cash"
        >
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <p v-if="view.runway" class="pb-2 text-sm text-toned">
              Cash at the year end lasts {{ view.runway.lasts }} at the cost of October to December, <MoneyText :cents="view.runway.monthlyCost" /> a month with the corporate tax due, as Overview counts runway.
            </p>
            <BuildUpList :lines="view.cashMonths" test-id="forecast-cash-months" />
          </div>
        </AppCard>

        <AppCard
          :title="`Plan against actual, ${year}`"
          subtitle="Each month the ledger settles replaces what the plan had for it, and the plan stays here to compare with. Revenue is held against the billing plan, the owner pay against the plan's scenarios."
          collapse-id="forecast.plan-actual"
          :summary="view.planActualSummary"
          data-testid="forecast-plan-actual"
        >
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <p v-if="view.planActual.length === 0" class="py-4 text-sm text-muted">No month the ledger settles in {{ year }} has a plan to compare with yet.</p>
            <PlanActualList v-else :lines="view.planActual" />
          </div>
        </AppCard>
      </template>
      <PlanEditor v-if="editor" v-bind="editor" :category-name="names.category" />
    </LedgerGate>
  </section>
</template>

<style scoped>
.next-figure {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  padding: 0.625rem 0.75rem;
}
</style>
