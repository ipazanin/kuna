<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import UPopover from '@nuxt/ui/components/Popover.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { chartTokens } from '../../../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../../../shared/layout/viewport'
import { formatPercent } from '../../../../../../shared/money/moneyFormat'
import AppCard from '../../../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../../../shared/ui/ChartLegend.vue'
import MoneyText from '../../../../../../shared/ui/MoneyText.vue'
import { useFilters } from '../../../../filters/application/filterStore'
import type { HrDooWorkbook } from '../../domain/hrDooPart'
import type { PayoutOptionId } from '../../domain/dividend/dividendCapacity'
import { scenarioGuards } from '../../domain/scenarios/scenarioGuards'
import BuildUpButton from '../BuildUpButton.vue'
import FigureDialog from '../FigureDialog.vue'
import DividendCard from '../forecast/DividendCard.vue'
import type { ForecastView } from '../forecast/forecastView'
import { figureDetail } from '../tracedFigureView'
import type { FigureDetail } from '../tracedFigureView'
import { comparedScenarios } from './payScenariosView'
import type { PayState, ScenarioColumn } from './payScenariosView'
import { scenarioBars } from './scenarioBars'
import ScenarioComparison from './ScenarioComparison.vue'
import ScenarioEditor from './ScenarioEditor.vue'

/** Which owner pay mix leaves the owner the most, at what cost to the company and with what risk, and what the year can pay out. */
const props = defineProps<{
  workbook: HrDooWorkbook
  year: number
  pay: PayState
  /** Null while the year cannot be forecast. */
  dividend: ForecastView['dividend'] | null
}>()

/** At most this many scenarios sit side by side. */
const MOST_COMPARED = 4

const PAYOUTS: readonly PayoutOptionId[] = ['after-adoption', 'interim', 'keep']

const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()
const phone = usePhoneLayout()

const link = (drill: Parameters<typeof drillLocation>[0] | null) => (drill === null ? null : drillLocation(drill))

const yearScenarios = computed(() => props.workbook.payScenarios.filter((scenario) => scenario.year === props.year))
const taken = computed(() => props.workbook.payScenarios.map((scenario) => scenario.slug))

const ready = computed(() => (props.pay.state === 'ready' ? props.pay.figures : null))
const workedOut = computed(() => ready.value?.entries.flatMap((entry) => (entry.kind === 'outcome' ? [entry.scenario] : [])) ?? [])
/** Guards need no company figures, so the editor shows why a scenario is stopped even before the settings are complete. */
const refusals = computed(
  () =>
    new Map(
      yearScenarios.value.flatMap((scenario) => {
        const reasons = scenarioGuards(scenario).map((guard) => guard.reason)
        return reasons.length === 0 ? [] : [[scenario.slug, reasons] as const]
      }),
    ),
)

/** The scenarios compared, the base and the payout option live in the address, so a reload or a shared link keeps them and nothing is written. */
const chosen = computed(() => {
  const available = workedOut.value.map((scenario) => scenario.slug)
  const asked = typeof route.query.compare === 'string' ? route.query.compare.split(',').filter((slug) => available.includes(slug)) : []
  return (asked.length > 0 ? asked : available).slice(0, MOST_COMPARED)
})
const base = computed(() => {
  const asked = typeof route.query.base === 'string' ? route.query.base : ''
  const seeded = `floor-salary-${props.year}`
  return chosen.value.includes(asked) ? asked : chosen.value.includes(seeded) ? seeded : (chosen.value[0] ?? '')
})
const payout = computed((): PayoutOptionId => PAYOUTS.find((id) => id === route.query.payout) ?? 'after-adoption')

function toggle(slug: string): void {
  const next = chosen.value.includes(slug) ? chosen.value.filter((entry) => entry !== slug) : [...chosen.value, slug]
  if (next.length === 0 || next.length > MOST_COMPARED) return
  void router.replace({ query: { ...route.query, compare: next.join(',') } })
}

function pickBase(slug: string): void {
  void router.replace({ query: { ...route.query, base: slug } })
}

function pickPayout(picked: PayoutOptionId): void {
  void router.replace({ query: { ...route.query, payout: picked === 'after-adoption' ? undefined : picked } })
}

const shown = computed(() => (ready.value === null ? null : comparedScenarios(ready.value, chosen.value, base.value, link)))
const bars = computed(() => (shown.value === null ? null : scenarioBars(shown.value.splits, chartTokens(), phone.value)))

const companyLines = computed(() => {
  const figures = ready.value
  if (figures === null) return []
  const { company } = figures
  const subtitle = `What the scenarios start from, the ${company.takenFrom} forecast`
  return [company.profitBeforeOwnerPay, company.ownerPayInForecast, company.cashBeforeOwnerPay, company.owedByOwner, company.retainedBroughtIn].map((figure) => figureDetail(figure, subtitle, link))
})

const marginal = computed(() => ready.value?.marginal.map((route) => figureDetail(route.net, `The next 100.00 of company money, ${props.year}`, link)) ?? [])

/** Each scenario's warnings and notes behind one badge, which counts the warnings, or the notes when it has no warning. */
const warningRows = computed(() => (shown.value?.columns ?? []).map((column) => ({ column, badge: badgeOf(column) })))

function badgeOf(column: ScenarioColumn): { readonly label: string; readonly warns: boolean } | null {
  const warnings = column.warnings.length
  const notes = column.notes.length
  if (warnings > 0) return { label: `${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`, warns: true }
  return notes === 0 ? null : { label: `${notes} ${notes === 1 ? 'note' : 'notes'}`, warns: false }
}

const startingOpen = ref(false)
const detail = ref<FigureDetail | null>(null)
const detailOpen = ref(false)

function openDetail(opened: FigureDetail): void {
  startingOpen.value = false
  detail.value = opened
  detailOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <UEmpty
      v-if="pay.state === 'needs'"
      icon="i-lucide-settings-2"
      :title="`The figures need ${pay.need}`"
      :description="`${pay.why} The scenarios below can be edited meanwhile.`"
      :actions="[{ label: pay.action.label, to: pay.action.to, color: 'neutral', variant: 'outline' }]"
      variant="outline"
      class="rounded-card border-dashed bg-raised/40"
      data-testid="scenarios-needs-setting"
    />
    <UEmpty
      v-else-if="pay.state === 'failed'"
      icon="i-lucide-triangle-alert"
      title="The scenarios could not be worked out"
      :description="pay.failure"
      variant="outline"
      class="rounded-card border-error/40 bg-raised"
      :ui="{ avatar: 'text-error' }"
    />
    <div v-else-if="ready" class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between" data-testid="scenario-picker">
      <div v-if="workedOut.length > 1" class="flex flex-wrap gap-1.5" role="group" :aria-label="`Scenarios to compare, up to ${MOST_COMPARED}`">
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
      <div class="flex flex-wrap items-center gap-2 sm:ms-auto">
        <label v-if="shown && chosen.length > 1" class="flex items-center gap-2 text-sm text-toned">
          <span class="shrink-0">Compare against</span>
          <USelect
            :model-value="base"
            :items="shown.columns.map((column) => ({ label: column.label, value: column.slug }))"
            size="sm"
            class="min-w-48"
            data-testid="scenario-base"
            @update:model-value="pickBase(String($event))"
          />
        </label>
        <UButton label="What the scenarios start from" icon="i-lucide-list-tree" color="neutral" variant="outline" size="sm" data-testid="open-starting-figures" @click="startingOpen = true" />
      </div>
    </div>

    <DividendCard v-if="dividend" v-bind="dividend" :year="year" :chosen="payout" @choose="pickPayout" />

    <template v-if="ready && shown && bars">
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
          <template #footer>
            <ul class="flex flex-col border-t border-default px-4 py-2 sm:px-5" aria-label="Warnings and notes" data-testid="scenario-warnings">
              <li v-for="{ column, badge } in warningRows" :key="column.slug" class="warning-row" :data-scenario-warnings="column.slug">
                <span class="min-w-0 text-sm text-toned">{{ column.label }}</span>
                <UPopover v-if="badge" :content="{ side: 'top', align: 'end', collisionPadding: 12 }">
                  <UButton
                    :label="badge.label"
                    :icon="badge.warns ? 'i-lucide-triangle-alert' : 'i-lucide-info'"
                    :color="badge.warns ? 'warning' : 'neutral'"
                    variant="soft"
                    size="xs"
                    class="shrink-0"
                    :aria-label="`${column.label}: ${badge.label}, open them`"
                    data-testid="scenario-warning-badge"
                  />
                  <template #content>
                    <div class="flex max-w-80 flex-col gap-3 p-3" data-testid="scenario-warning-list">
                      <ul v-if="column.warnings.length > 0" class="flex flex-col gap-1.5">
                        <li v-for="warning in column.warnings" :key="warning" class="flex items-start gap-2 text-sm text-toned">
                          <UIcon name="i-lucide-triangle-alert" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
                          <span>{{ warning }}</span>
                        </li>
                      </ul>
                      <ul v-if="column.notes.length > 0" class="flex flex-col gap-1">
                        <li v-for="note in column.notes" :key="note" class="text-xs text-muted">{{ note }}</li>
                      </ul>
                    </div>
                  </template>
                </UPopover>
                <span v-else class="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted">
                  <UIcon name="i-lucide-circle-check" class="size-3.5 text-[var(--tone-positive)]" aria-hidden="true" />
                  Nothing to warn about
                </span>
              </li>
            </ul>
          </template>
        </ChartCard>

        <AppCard
          title="Side by side"
          subtitle="A tick marks the best of a line that has a better way. The figure under each is the difference to the base. Open any figure for how it is built and its rules."
          collapse-id="year.comparison"
          :summary="`${shown.columns.length} ${shown.columns.length === 1 ? 'scenario' : 'scenarios'}, ${shown.lines.length} lines each`"
          start-collapsed
        >
          <div class="px-4 pt-1 pb-4 sm:px-5">
            <ScenarioComparison :columns="shown.columns" :lines="shown.lines" @open="openDetail" />
          </div>
        </AppCard>
      </template>

      <AppCard
        :title="`The next 100.00 of company money, ${year}`"
        subtitle="What reaches you of 100.00 the company has before corporate tax, by route, from the rules of the year. Salary above the floor buys pension too."
        collapse-id="year.marginal"
        :summary="`${marginal.length} ${marginal.length === 1 ? 'route' : 'routes'}`"
        start-collapsed
        data-testid="marginal-euro"
      >
        <ul class="flex flex-col px-4 pt-2 pb-3 sm:px-5">
          <li v-for="entry in marginal" :key="entry.title">
            <button type="button" class="route-row" :aria-label="`${entry.title}: open how it is built`" @click="openDetail(entry)">
              <span class="min-w-0 text-start text-sm text-toned">{{ entry.title }}</span>
              <MoneyText :cents="entry.cents" class="shrink-0 text-sm font-medium text-highlighted" />
            </button>
          </li>
        </ul>
      </AppCard>
    </template>

    <ScenarioEditor :year="year" :scenarios="yearScenarios" :refusals="refusals" :grants="workbook.grants" :taken="taken" />

    <UModal
      v-model:open="startingOpen"
      title="What the scenarios start from"
      :description="ready ? `The ${ready.company.takenFrom} forecast with its owner pay taken back out, so each scenario sets its own. Open a figure for how it is built.` : ''"
      :fullscreen="phone"
      :ui="{ header: 'pe-16 sm:pe-6' }"
    >
      <template #body>
        <ul class="flex flex-col" data-testid="starting-figures">
          <li v-for="line in companyLines" :key="line.title" class="starting-row">
            <span class="min-w-0 text-sm text-toned">{{ line.title }}</span>
            <BuildUpButton :cents="line.cents" :label="line.title" class="shrink-0 text-sm text-highlighted" @open="openDetail(line)" />
          </li>
        </ul>
      </template>
    </UModal>
    <FigureDialog v-model:open="detailOpen" :detail="detail" />
  </div>
</template>

<style scoped>
.warning-row,
.starting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.5rem;
  padding-block: 0.375rem;
}

.warning-row + .warning-row,
.starting-row + .starting-row {
  border-top: 1px solid var(--border-default);
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

.route-row:hover {
  background: var(--surface-elevated);
}
</style>
