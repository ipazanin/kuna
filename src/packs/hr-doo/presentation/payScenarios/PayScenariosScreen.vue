<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { yearOf } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatPercent } from '../../../../shared/money/moneyFormat'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import { useFilters } from '../../../../features/filters/application/filterStore'
import { useSettings } from '../../../../features/settings/application/useSettings'
import { useFilteredLedger } from '../../../../features/transactions/application/useFilteredLedger'
import { useWorkbook } from '../../../../features/workbook/application/workbookStore'
import { newestBookingOf } from '../../../../features/workbook/domain/workbook'
import LedgerGate from '../../../../features/workbook/presentation/LedgerGate.vue'
import ConfidenceBadge from '../../ruleset/presentation/ConfidenceBadge.vue'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import { RULESET_CHECKED_ON } from '../../ruleset/ruleset'
import { payScenarios } from '../../domain/scenarios/payScenarios'
import { scenarioGuards } from '../../domain/scenarios/scenarioGuards'
import OwnerPayOff from '../OwnerPayOff.vue'
import FigureDialog from '../FigureDialog.vue'
import ScenarioComparison from './ScenarioComparison.vue'
import ScenarioEditor from './ScenarioEditor.vue'
import { WATCHED_WORDING, figureDetail } from '../tracedFigureView'
import type { FigureDetail } from '../tracedFigureView'
import { comparedScenarios, watchedRules } from './payScenariosView'
import { scenarioBars } from './scenarioBars'

/** At most this many scenarios sit side by side. */
const MOST_COMPARED = 4

const ledger = useFilteredLedger()
const store = useWorkbook()
const settings = useSettings()
const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const checkedOn = dayLabel(RULESET_CHECKED_ON)
const phone = usePhoneLayout()
const workbook = computed(() => ledger.value?.workbook ?? null)
const asOf = computed((): CivilDate | null => newestBookingOf(workbook.value?.transactions ?? []))

/** The year of the newest booking, the year after it, and any other year a scenario is for. */
const years = computed(() => {
  if (asOf.value === null) return []
  const current = yearOf(asOf.value)
  return [...new Set([current, current + 1, ...(workbook.value?.payScenarios.map((scenario) => scenario.year) ?? [])])].sort((earlier, later) => earlier - later)
})

/** The plan looks a year ahead, so the year after the newest booking comes first. */
const year = computed(() => {
  const asked = Number(route.query.year)
  return years.value.includes(asked) ? asked : asOf.value === null ? null : yearOf(asOf.value) + 1
})

function pickYear(picked: number): void {
  const { compare: _compare, base: _base, ...others } = route.query
  void router.replace({ query: { ...others, year: String(picked) } })
}

const link = (drill: Parameters<typeof drillLocation>[0] | null) => (drill === null ? null : drillLocation(drill))

const tabMissing = computed(() => store.state.choice?.source === 'google' && (store.state.snapshot?.meta.missingTabs.includes('scenarios') ?? false))
const yearScenarios = computed(() => workbook.value?.payScenarios.filter((scenario) => scenario.year === year.value) ?? [])
const taken = computed(() => workbook.value?.payScenarios.map((scenario) => scenario.slug) ?? [])

const result = computed(() => {
  const current = workbook.value
  const shown = year.value
  const day = asOf.value
  if (current === null || shown === null || day === null) return null
  const facts = current.settings.companyFacts
  if (facts.companyRegistered === null) return { state: 'needs' as const, key: 'hr_company_registered', why: 'The tax periods and the corporate tax count from the day the company was registered.' }
  if (facts.residenceCity === '') return { state: 'needs' as const, key: 'hr_residence_city', why: 'Your city of residence sets the income tax rates of the salary.' }
  try {
    return { state: 'ready' as const, figures: payScenarios(current, shown, day) }
  } catch (failure) {
    if (failure instanceof RangeError) return { state: 'failed' as const, failure: failure.message }
    throw failure
  }
})

const ready = computed(() => (result.value?.state === 'ready' ? result.value.figures : null))
const workedOut = computed(() => ready.value?.entries.flatMap((entry) => (entry.kind === 'outcome' ? [entry.scenario] : [])) ?? [])
/** Guards need no company figures, so the editor shows why a scenario is stopped even before the settings are complete. */
const refusals = computed(() => new Map(yearScenarios.value.flatMap((scenario) => {
  const reasons = scenarioGuards(scenario).map((guard) => guard.reason)
  return reasons.length === 0 ? [] : [[scenario.slug, reasons] as const]
})))

/** The scenarios compared and the base live in the address, so a reload or a shared link keeps them and nothing is written. */
const chosen = computed(() => {
  const available = workedOut.value.map((scenario) => scenario.slug)
  const asked = typeof route.query.compare === 'string' ? route.query.compare.split(',').filter((slug) => available.includes(slug)) : []
  return (asked.length > 0 ? asked : available).slice(0, MOST_COMPARED)
})
const base = computed(() => {
  const asked = typeof route.query.base === 'string' ? route.query.base : ''
  const seeded = `floor-salary-${year.value}`
  return chosen.value.includes(asked) ? asked : chosen.value.includes(seeded) ? seeded : (chosen.value[0] ?? '')
})

function toggle(slug: string): void {
  const next = chosen.value.includes(slug) ? chosen.value.filter((entry) => entry !== slug) : [...chosen.value, slug]
  if (next.length === 0 || next.length > MOST_COMPARED) return
  void router.replace({ query: { ...route.query, compare: next.join(',') } })
}

function pickBase(slug: string): void {
  void router.replace({ query: { ...route.query, base: slug } })
}

const shown = computed(() => (ready.value === null ? null : comparedScenarios(ready.value, chosen.value, base.value, link)))
const bars = computed(() => (shown.value === null ? null : scenarioBars(shown.value.splits, chartTokens(), phone.value)))
const watched = computed(() => (ready.value === null ? [] : watchedRules(ready.value)))

const companyLines = computed(() => {
  const figures = ready.value
  if (figures === null) return []
  const { company } = figures
  const subtitle = `Company figures, ${company.takenFrom} forecast`
  return [company.profitBeforeOwnerPay, company.ownerPayInForecast, company.cashBeforeOwnerPay, company.owedByOwner, company.retainedBroughtIn].map((figure) => figureDetail(figure, subtitle, link))
})

const marginal = computed(() => ready.value?.marginal.map((route) => figureDetail(route.net, `The next 100.00 of company money, ${year.value}`, link)) ?? [])

const detail = ref<FigureDetail | null>(null)
const detailOpen = ref(false)

function openDetail(opened: FigureDetail): void {
  detail.value = opened
  detailOpen.value = true
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Pay scenarios" description="Which owner pay mix leaves you the most, at what cost to the company and with what risk?">
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
      <UAlert
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        title="Planning figures to discuss with your accountant, not filing advice"
        :description="`The rules behind them were last checked against their sources on ${checkedOn}.`"
        data-testid="planning-banner"
      />

      <UEmpty
        v-if="result && result.state === 'needs'"
        icon="i-lucide-settings-2"
        :title="`The figures need ${result.key}`"
        :description="`${result.why} Set it on Workbook, General. The scenarios below can be edited meanwhile.`"
        :actions="[{ label: 'Open the Workbook screen', to: '/workbook', color: 'neutral', variant: 'outline' }]"
        variant="outline"
        class="rounded-card border-dashed bg-raised/40"
        data-testid="scenarios-needs-setting"
      />
      <UEmpty
        v-else-if="result && result.state === 'failed'"
        icon="i-lucide-triangle-alert"
        title="The scenarios could not be worked out"
        :description="result.failure"
        variant="outline"
        class="rounded-card border-error/40 bg-raised"
        :ui="{ avatar: 'text-error' }"
      />
      <template v-else-if="ready && shown && bars">
        <div v-if="ready.company.takenFrom !== year || watched.length > 0" class="flex flex-col gap-2 text-sm text-toned" data-testid="scenario-inputs-notice">
          <p v-if="ready.company.takenFrom !== year" class="flex items-start gap-2">
            <UIcon name="i-lucide-calendar-arrow-down" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <span>Profit, cash and owner loans are taken from the {{ ready.company.takenFrom }} forecast, the latest year it covers. The rules are those of {{ year }}.</span>
          </p>
          <p v-for="group in watched" :key="group.confidence" class="flex items-start gap-2">
            <ConfidenceBadge :confidence="group.confidence" />
            <span class="min-w-0">{{ WATCHED_WORDING[group.confidence] }} for {{ year }}: {{ group.rules.map((rule) => rule.title).join(', ') }}.</span>
          </p>
        </div>

        <AppCard
          title="What every scenario starts from"
          :subtitle="`The ${ready.company.takenFrom} forecast with its owner pay taken back out. Open a figure for how it is built.`"
          data-testid="company-figures"
        >
          <ul class="grid gap-2 px-4 pt-3 pb-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
            <li v-for="line in companyLines" :key="line.title">
              <button type="button" class="input-figure" :aria-label="`${line.title}: open how it is built`" @click="openDetail(line)">
                <span class="text-xs text-muted">{{ line.title }}</span>
                <MoneyText :cents="line.cents" class="text-sm font-medium text-highlighted" />
              </button>
            </li>
          </ul>
        </AppCard>

        <UEmpty
          v-if="shown.columns.length === 0"
          icon="i-lucide-scale"
          :title="`No scenario for ${year} to compare yet`"
          description="Add the starting scenarios below, then edit, copy or rename them."
          variant="outline"
          class="rounded-card border-dashed bg-raised/40"
          data-testid="no-scenarios"
        />
        <template v-else>
          <div v-if="workedOut.length > 1" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid="scenario-picker">
            <div class="flex flex-wrap gap-1.5" role="group" :aria-label="`Scenarios to compare, up to ${MOST_COMPARED}`">
              <UButton
                v-for="scenario in workedOut"
                :key="scenario.slug"
                :label="scenario.label || scenario.slug"
                size="sm"
                color="neutral"
                :variant="chosen.includes(scenario.slug) ? 'solid' : 'outline'"
                :aria-pressed="chosen.includes(scenario.slug)"
                :disabled="!chosen.includes(scenario.slug) && chosen.length >= MOST_COMPARED"
                @click="toggle(scenario.slug)"
              />
            </div>
            <label v-if="chosen.length > 1" class="flex items-center gap-2 text-sm text-toned">
              <span class="shrink-0">Compare against</span>
              <USelect :model-value="base" :items="shown.columns.map((column) => ({ label: column.label, value: column.slug }))" size="sm" class="min-w-48" data-testid="scenario-base" @update:model-value="pickBase(String($event))" />
            </label>
          </div>

          <ChartCard
            v-if="bars.drawn"
            :title="`Where the profit before owner pay goes, ${year}`"
            subtitle="Each bar is one scenario's profit before owner pay. Pension pillar II is your own savings, shown apart from what the state takes."
            definition="Net to you counts the net salary, tax-free items, rent after its tax, the dividend after its tax and the annual settlement, less contributions you pay yourself. Income tax is what the months withhold plus the settlement."
            :option="bars.option"
            :description="bars.description"
            :format-value="(share: number) => formatPercent(share / 100)"
            :height="Math.max(140, 56 * shown.splits.length + 48)"
          >
            <template #legend><ChartLegend :entries="bars.legend" /></template>
          </ChartCard>

          <AppCard
            title="Side by side"
            subtitle="A tick marks the best of a line that has a better way. The figure under each is the difference to the base. Open any figure for how it is built and its rules."
            collapse-id="pay-scenarios.comparison"
            :summary="`${shown.columns.length} ${shown.columns.length === 1 ? 'scenario' : 'scenarios'}, ${shown.lines.length} lines each`"
          >
            <div class="px-4 pt-1 pb-4 sm:px-5">
              <ScenarioComparison :columns="shown.columns" :lines="shown.lines" @open="openDetail" />
            </div>
          </AppCard>

          <div class="grid gap-4 lg:grid-cols-2" data-testid="scenario-warnings">
            <AppCard v-for="column in shown.columns" :key="column.slug" :title="column.label">
              <div class="px-4 pt-2 pb-4 sm:px-5">
                <p v-if="column.warnings.length === 0" class="flex items-start gap-2 text-sm text-toned">
                  <UIcon name="i-lucide-circle-check" class="mt-0.5 size-4 shrink-0 text-[var(--tone-positive)]" aria-hidden="true" />
                  <span>Nothing to warn about.</span>
                </p>
                <ul v-else class="flex flex-col gap-1.5">
                  <li v-for="warning in column.warnings" :key="warning" class="flex items-start gap-2 text-sm text-toned">
                    <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
                    <span>{{ warning }}</span>
                  </li>
                </ul>
                <ul v-if="column.notes.length > 0" class="mt-3 flex flex-col gap-1">
                  <li v-for="note in column.notes" :key="note" class="text-xs text-muted">{{ note }}</li>
                </ul>
              </div>
            </AppCard>
          </div>
        </template>

        <AppCard
          :title="`The next 100.00 of company money, ${year}`"
          subtitle="What reaches you of 100.00 the company has before corporate tax, by route, from the rules of the year. Salary above the floor buys pension too."
          data-testid="marginal-euro"
        >
          <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
            <li v-for="route in marginal" :key="route.title">
              <button type="button" class="route-row" :aria-label="`${route.title}: open how it is built`" @click="openDetail(route)">
                <span class="min-w-0 text-start text-sm text-toned">{{ route.title }}</span>
                <MoneyText :cents="route.cents" class="shrink-0 text-sm font-medium text-highlighted" />
              </button>
            </li>
          </ul>
        </AppCard>
      </template>

      <ScenarioEditor v-if="year !== null" :year="year" :scenarios="yearScenarios" :refusals="refusals" :grants="workbook?.grants ?? []" :tab-missing="tabMissing" :taken="taken" />
      <FigureDialog v-model:open="detailOpen" :detail="detail" />
    </LedgerGate>
  </section>
</template>

<style scoped>
.input-figure {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.125rem;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-control);
  padding: 0.5rem 0.75rem;
  text-align: start;
}

.route-row {
  display: flex;
  width: 100%;
  min-height: 2.75rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-radius: var(--radius-control);
}

li + li > .route-row {
  border-top: 1px solid var(--border-default);
}

.input-figure:hover,
.route-row:hover {
  background: var(--surface-elevated);
}
</style>
