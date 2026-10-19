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
import type { PayoutOptionId } from '../../domain/dividend/dividendCapacity'
import CitObligationList from '../CitObligationList.vue'
import MissingRoles from '../MissingRoles.vue'
import OwnerPayOff from '../OwnerPayOff.vue'
import BuildUpList from './BuildUpList.vue'
import DividendCard from './DividendCard.vue'
import { forecastChart } from './forecastChart'
import { forecastView } from './forecastView'

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
      categoryName: names.value.category,
    })
    return { state: 'ready' as const, ...shaped, chart: forecastChart(shaped.chartMonths, shaped.running, chartTokens()) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { state: 'failed' as const, failure: failure.message }
    }
    throw failure
  }
})
</script>

<template>
  <section class="flex flex-col gap-6">
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
          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="profit-and-loss-title">
            <header class="px-4 pt-4 sm:px-5">
              <h2 id="profit-and-loss-title" class="text-sm font-medium text-highlighted">Profit and loss</h2>
              <p class="mt-0.5 text-xs text-muted">By the lines the accountant prints. Open a line for what it adds up and the months a plan row or an average stands in for.</p>
            </header>
            <div class="px-4 pt-2 pb-3 sm:px-5">
              <BuildUpList :lines="view.profitAndLoss" test-id="forecast-profit-and-loss" />
            </div>
          </section>
          <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="pd-return-title">
            <header class="px-4 pt-4 sm:px-5">
              <h2 id="pd-return-title" class="text-sm font-medium text-highlighted">Profit tax return, PD</h2>
              <p class="mt-0.5 text-xs text-muted">From profit to the tax, the advances and the balance, by form line. Open a line for its steps and rules.</p>
            </header>
            <div class="px-4 pt-2 pb-3 sm:px-5">
              <BuildUpList :lines="view.pdReturn" test-id="forecast-pd-return" />
            </div>
          </section>
        </div>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="advances-title" data-testid="forecast-advances">
          <header class="px-4 pt-4 sm:px-5">
            <h2 id="advances-title" class="text-sm font-medium text-highlighted">Corporate tax payments, expected against paid</h2>
            <p class="mt-0.5 text-xs text-muted">
              The balance due on last year's return and this year's advances. The bank rows fill them oldest due date first, since the annual payment and the
              advances share one payment code.
            </p>
          </header>
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
        </section>

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

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="plan-rows-title" data-testid="plan-rows">
          <header class="flex flex-col gap-2 px-4 pt-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
            <div>
              <h2 id="plan-rows-title" class="text-sm font-medium text-highlighted">Plan rows for {{ year }}</h2>
              <p class="mt-0.5 text-xs text-muted">Read only here. They come from the workbook's plan tab, and a month's own row comes before a row for every month.</p>
            </div>
            <DrillLink to="/workbook" in-prose class="shrink-0 text-sm text-highlighted">Open the Workbook screen</DrillLink>
          </header>
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <p v-if="view.planRows.length === 0" class="py-4 text-sm text-muted">The plan tab holds no rows for {{ year }}, so every month the ledger has not closed takes its line's average.</p>
            <ul v-else class="flex flex-col">
              <li v-for="row in view.planRows" :key="row.key" class="plan-row">
                <div class="min-w-0">
                  <p class="text-sm text-highlighted">{{ row.item }}</p>
                  <p class="text-xs text-muted">{{ row.month }}</p>
                  <p v-if="row.note" class="text-xs text-muted">{{ row.note }}</p>
                  <p v-if="row.notCounted" class="mt-0.5 text-xs text-[var(--tone-warning)]">Not counted. {{ row.notCounted }}</p>
                </div>
                <MoneyText v-if="'cents' in row.value" :cents="row.value.cents" class="text-sm text-toned" />
                <span v-else class="identifier text-sm">{{ row.value.text }}</span>
              </li>
            </ul>
          </div>
        </section>
      </template>
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

.plan-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  padding-block: 0.5rem;
}

.plan-row + .plan-row {
  border-top: 1px solid var(--border-default);
}
</style>
