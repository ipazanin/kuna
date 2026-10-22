<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { yearOf } from '../../../../shared/calendar/civilDate'
import { yearOfMonth } from '../../../../shared/calendar/monthKey'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import type { PageTab } from '../../../../shared/ui/PageTabs.vue'
import { useFilters } from '../../../../features/filters/application/filterStore'
import { useSettings } from '../../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../../features/transactions/application/useFilteredLedger'
import { newestBookingOf } from '../../../../features/workbook/domain/workbook'
import LedgerGate from '../../../../features/workbook/presentation/LedgerGate.vue'
import { useDisplayNames } from '../../../../features/workbook/application/useDisplayNames'
import type { RecordId } from '../../../../features/workbook/domain/recordId'
import ConfidenceBadge from '../../ruleset/presentation/ConfidenceBadge.vue'
import { RULESET_CHECKED_ON } from '../../ruleset/ruleset'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import { planDefaults } from '../../domain/forecast/forecastYear'
import { PACK_ROLES, categoriesWithRole } from '../../domain/packRoles'
import { employmentFreeFrom } from '../../domain/scenarios/startingScenarios'
import { missingAccrualRoles } from '../accrualRoles'
import AssetsPanel from '../assets/AssetsPanel.vue'
import ForecastPanel from '../forecast/ForecastPanel.vue'
import { forecastState } from '../forecast/forecastView'
import PlanEditor from '../forecast/PlanEditor.vue'
import MissingRoles from '../MissingRoles.vue'
import OwnerPayOff from '../OwnerPayOff.vue'
import PayPanel from '../payScenarios/PayPanel.vue'
import { payState } from '../payScenarios/payScenariosView'
import TaxesPanel from '../taxes/TaxesPanel.vue'
import { WATCHED_WORDING, watchedGroups } from '../tracedFigureView'
import AccountantPanel from '../yearEnd/AccountantPanel.vue'
import { closedYearView } from '../yearEnd/closedYearView'
import StatementsPanel from '../yearEnd/StatementsPanel.vue'
import { shownYear, yearOptions } from './yearChoice'
import type { YearTab } from './yearChoice'

const TAB_LABELS: Readonly<Record<YearTab, Omit<PageTab, 'value'>>> = {
  accountant: { label: 'Accountant', icon: 'i-lucide-book-check' },
  statements: { label: 'Statements', icon: 'i-lucide-file-spreadsheet' },
  forecast: { label: 'Forecast', icon: 'i-lucide-telescope' },
  plan: { label: 'Plan', icon: 'i-lucide-notebook-pen' },
  pay: { label: 'Pay', icon: 'i-lucide-split' },
  taxes: { label: 'Taxes', icon: 'i-lucide-landmark' },
  assets: { label: 'Assets', icon: 'i-lucide-package' },
}

const ledger = useFilteredLedger()
const settings = useSettings()
const names = useDisplayNames()
const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const checkedOn = dayLabel(RULESET_CHECKED_ON)

/** The newest booking. Its year is the current one, which a link without a year opens. */
const asOf = computed(() => newestBookingOf(ledger.value?.workbook.transactions ?? []))

const options = computed(() => {
  const current = ledger.value
  const day = asOf.value
  if (current === null || day === null) return []
  const accountantYears = [...new Set(current.workbook.yearEndLines.map((line) => line.year))]
  return yearOptions(accountantYears, yearOfMonth(current.window.firstMonth), yearOf(day))
})

const askedYear = computed(() => (typeof route.query.year === 'string' && route.query.year !== '' ? Number(route.query.year) : null))

const shown = computed(() => {
  const day = asOf.value
  if (day === null) return null
  const tab = typeof route.query.tab === 'string' ? route.query.tab : null
  const year = shownYear(options.value, askedYear.value, tab, yearOf(day))
  return options.value.find((option) => option.year === year) ?? null
})

/** A link that opened another year than it names, such as `?tab=statements` alone, gets that year into the address, so the next tab picked stays in it. */
watch(
  shown,
  (option) => {
    const day = asOf.value
    if (option === null || day === null || option.year === (askedYear.value ?? yearOf(day))) return
    void router.replace({ query: { ...route.query, year: String(option.year) }, hash: route.hash })
  },
  { immediate: true },
)

const tabs = computed((): PageTab[] => shown.value?.tabs.map((tab) => ({ value: tab, ...TAB_LABELS[tab] })) ?? [])

/** Another year keeps the open tab when it has one, and opens on its first tab otherwise. Its scenarios are its own, so the ones compared are not kept. */
function pickYear(picked: number): void {
  const { tab, compare: _compare, base: _base, ...others } = route.query
  const keepsTab = options.value.find((option) => option.year === picked)?.tabs.some((candidate) => candidate === tab) ?? false
  void router.replace({ query: { ...others, year: String(picked), ...(keepsTab && typeof tab === 'string' ? { tab } : {}) } })
}

function tabLink(tab: YearTab, hash = '') {
  return { query: { ...route.query, year: String(shown.value?.year ?? ''), tab }, hash }
}

const link = (drill: Parameters<typeof drillLocation>[0] | null) => (drill === null ? null : drillLocation(drill))

/** A closed year with the accountant's lines set beside ours, or the reason it could not be worked out. */
const closed = computed(() => {
  const current = ledger.value
  const option = shown.value
  if (current === null || option === null || option.view !== 'closed') {
    return null
  }
  try {
    return { failure: null, view: closedYearView(current.workbook, option.year, link, tabLink('statements')) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { failure: failure.message, view: null }
    }
    throw failure
  }
})

/** A year not closed yet, as it is likely to end. */
const forecast = computed(() => {
  const current = ledger.value
  const option = shown.value
  const day = asOf.value
  return current === null || option === null || day === null || option.view === 'closed' ? null : forecastState(current.workbook, option.year, day, { link })
})

/** The owner pay mixes of a year still to plan. */
const pay = computed(() => {
  const current = ledger.value
  const option = shown.value
  const day = asOf.value
  return current === null || option === null || day === null || option.view !== 'open' ? null : payState(current.workbook, option.year, day)
})

/** The plan tab's rows of a year still to plan. It needs no tax facts, so it is there while the forecast waits for one. */
const plan = computed(() => {
  const current = ledger.value
  const option = shown.value
  const day = asOf.value
  if (current === null || option === null || day === null || option.view !== 'open') {
    return null
  }
  const { workbook } = current
  const { year } = option
  const switchOn = employmentFreeFrom(year, workbook.grants)
  return {
    year,
    lines: workbook.planLines.filter((line) => line.year === year),
    defaults: planDefaults(workbook, year, day),
    categories: workbook.categories,
    scenarios: workbook.payScenarios.filter((scenario) => scenario.year === year),
    notCounted: forecast.value?.state === 'ready' ? forecast.value.view.notCounted : new Map<RecordId, string>(),
    suggestedSwitch: switchOn === null || switchOn === `${year}-01-01` ? null : switchOn,
  }
})

/** The rules the forecast and the scenarios rest on that the ruleset only estimates for the year, said once. */
const watched = computed(() =>
  watchedGroups([
    ...(forecast.value?.state === 'ready' ? forecast.value.view.watched : []),
    ...(pay.value?.state === 'ready' ? pay.value.figures.entries.flatMap((entry) => (entry.kind === 'outcome' ? entry.outcome.watched : [])) : []),
  ]),
)

/** The roles the tabs read, said once under the header. */
const missingRoles = computed(() => {
  const categories = ledger.value?.workbook.categories ?? []
  return [
    ...missingAccrualRoles(categories),
    ...(categoriesWithRole(categories, PACK_ROLES.watched).length === 0 ? [{ role: PACK_ROLES.watched, leftOut: 'no tax has a payment calendar' }] : []),
  ]
})

const noVat = computed(() => closed.value?.view?.noVat ?? false)
const unregistered = computed(() => closed.value?.view?.unregistered ?? false)
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Year" description="How the year ends, and whether our books agree with the accountant's for the last one.">
      <template v-if="options.length > 1 && settings.ownerPayModule" #actions>
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Year" data-testid="year-picker">
          <UButton
            v-for="option in options"
            :key="option.year"
            :label="String(option.year)"
            size="sm"
            color="neutral"
            :variant="option.year === shown?.year ? 'solid' : 'outline'"
            :aria-pressed="option.year === shown?.year"
            @click="pickYear(option.year)"
          />
        </div>
      </template>
    </PageHeader>
    <OwnerPayOff v-if="!settings.ownerPayModule" />
    <LedgerGate v-else>
      <template v-if="ledger && asOf && shown">
        <UAlert
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="Planning figures to discuss with your accountant, not filing advice"
          :description="`The rules behind them were last checked against their sources on ${checkedOn}.${forecast ? ` The forecast is seen on ${dayLabel(asOf)}, the newest booking.` : ''}`"
          data-testid="planning-banner"
        />

        <div v-if="missingRoles.length > 0 || noVat || unregistered || watched.length > 0" class="flex flex-col gap-3">
          <p v-for="group in watched" :key="group.confidence" class="flex items-start gap-2 text-sm text-toned" data-testid="year-watched">
            <ConfidenceBadge :confidence="group.confidence" />
            <span class="min-w-0">{{ WATCHED_WORDING[group.confidence] }} for {{ shown.year }}: {{ group.rules.map((rule) => rule.title).join(', ') }}.</span>
          </p>
          <MissingRoles :missing="missingRoles" />
          <div v-if="noVat" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-receipt" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <p>
              No category has a <span class="identifier">vat</span> treatment, so no input VAT leaves the costs.
              <DrillLink to="/settings?tab=categories" in-prose class="text-highlighted">Set it on Settings, Categories</DrillLink>
            </p>
          </div>
          <div v-if="unregistered" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-calendar-x" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <p>
              <span class="identifier">hr_company_registered</span> is blank, so {{ shown.year }} counts as a full tax period and the advances paid in it are not known.
              <DrillLink :to="{ path: '/settings', hash: '#company-registered' }" in-prose class="text-highlighted">Set it on Settings</DrillLink>
            </p>
          </div>
        </div>

        <PageTabs :tabs="tabs" label="Parts of the year" data-testid="year-tabs">
          <template #accountant>
            <UEmpty
              v-if="closed?.view === null"
              icon="i-lucide-triangle-alert"
              title="The year could not be worked out"
              :description="closed.failure ?? ''"
              variant="outline"
              class="rounded-card border-error/40 bg-raised"
              :ui="{ avatar: 'text-error' }"
            />
            <AccountantPanel v-else-if="closed?.view" :view="closed.view" :year="shown.year" />
          </template>
          <template #statements>
            <StatementsPanel :workbook="ledger.workbook" :year="shown.year" :view="closed?.view ?? null" />
          </template>
          <template #forecast>
            <ForecastPanel v-if="forecast" :forecast="forecast" :year="shown.year" />
          </template>
          <template #plan>
            <PlanEditor v-if="plan" v-bind="plan" :category-name="names.category" />
          </template>
          <template #pay>
            <PayPanel v-if="pay" :workbook="ledger.workbook" :year="shown.year" :pay="pay" :dividend="forecast?.state === 'ready' ? forecast.view.dividend : null" />
          </template>
          <template #taxes>
            <TaxesPanel :workbook="ledger.workbook" :window="ledger.window" :year="shown.year" :as-of="asOf" />
          </template>
          <template #assets>
            <AssetsPanel :workbook="ledger.workbook" :window="ledger.window" :year="shown.year" />
          </template>
        </PageTabs>
      </template>
    </LedgerGate>
  </section>
</template>
