<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

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
import type { Workbook } from '../../../../features/workbook/domain/workbook'
import type { YearEndFigure } from '../../../../features/workbook/domain/yearEnd'
import LedgerGate from '../../../../features/workbook/presentation/LedgerGate.vue'
import { RULESET_CHECKED_ON } from '../../ruleset/ruleset'
import { dayLabel } from '../../ruleset/presentation/ruleWording'
import type { Rate } from '../../ruleset/schema'
import type { TracedFigure } from '../../ruleset/tracedFigure'
import type { AccrualAdjustment } from '../../domain/accrual/accrualAdjustment'
import type { AccrualLine } from '../../domain/accrual/accrualLines'
import { accrualYear } from '../../domain/accrual/accrualYear'
import { amountOnLine } from '../../domain/accrual/closedYear'
import { percentText } from '../../domain/payroll/payrollArithmetic'
import { compareYearEnd } from '../../domain/yearEnd/yearEndComparison'
import type { ComparedLine, ComparedStatement, LineStatus } from '../../domain/yearEnd/yearEndComparison'
import { yearEndOpenItems } from '../../domain/yearEnd/yearEndOpenItems'
import MissingRoles from '../MissingRoles.vue'
import OwnerPayOff from '../OwnerPayOff.vue'
import { missingAccrualRoles } from '../accrualRoles'
import { chipsOf, figureLabel, ruleChips, stepsOf } from '../tracedFigureView'
import { bridgeChart } from './bridgeChart'
import type { BridgeBar } from './bridgeChart'
import BridgeSteps from './BridgeSteps.vue'
import type { BridgeStepView } from './BridgeSteps.vue'
import ComparisonTable from './ComparisonTable.vue'
import type { ComparisonRow, ShownValue } from './ComparisonTable.vue'
import KontoTable from './KontoTable.vue'
import OpenItems from './OpenItems.vue'
import StatusBadge from './StatusBadge.vue'
import { ADJUSTMENT_LABELS, STATUSES, STATUS_WORDING, lineLabel } from './yearEndWording'

const ledger = useFilteredLedger()
const settings = useSettings()
const { drillLocation } = useFilters()
const route = useRoute()
const router = useRouter()

const checkedOn = dayLabel(RULESET_CHECKED_ON)

const TABLES: readonly { readonly key: string; readonly title: string; readonly description: string; readonly statements: readonly ComparedStatement[] }[] = [
  {
    key: 'pl',
    title: 'Profit and loss',
    description: 'The accountant’s lines beside ours on the accrual view and on the cash view, with the grant released.',
    statements: ['pl', 'grant'],
  },
  {
    key: 'balance',
    title: 'Balance sheet at 31 December',
    description: 'The cash view has no balance sheet beyond cash, so the other lines compare the accrual view alone.',
    statements: ['balance', 'grant'],
  },
  { key: 'tax', title: 'Profit tax return, PD', description: 'The build-up of the corporate tax by form line.', statements: ['tax'] },
]

const GRANT_LINES: Readonly<Record<string, string>> = { 'released-in-year': 'pl', 'deferred-at-year-end': 'balance' }

const years = computed(() => {
  const current = ledger.value
  return current === null ? [] : [...new Set(current.workbook.yearEndLines.map((line) => line.year))].sort((later, earlier) => earlier - later)
})

/** The year in the address, or the latest the year-end tab holds. */
const year = computed(() => {
  const asked = Number(route.query.year)
  return years.value.includes(asked) ? asked : (years.value[0] ?? null)
})

function pickYear(picked: number): void {
  void router.replace({ query: { ...route.query, year: String(picked) } })
}

const view = computed(() => {
  const current = ledger.value
  const shown = year.value
  if (current === null || shown === null) {
    return null
  }
  try {
    return { failure: null, ...yearEndView(current.workbook, shown) }
  } catch (failure) {
    if (failure instanceof RangeError) {
      return { failure: failure.message }
    }
    throw failure
  }
})

function yearEndView(workbook: Workbook, shownYear: number) {
  const accrual = accrualYear(workbook, shownYear, { depreciation: settings.value.companyFacts, citAdvancesPaid: null })
  const comparison = compareYearEnd(workbook, accrual)
  const { bridge } = accrual

  const bars: BridgeBar[] = [
    { label: 'Cash net', kind: 'total', amount: bridge.cashNet.amount, drill: bridge.cashNet.drill },
    ...bridge.steps.map((step): BridgeBar => ({ label: ADJUSTMENT_LABELS[step.id], kind: 'step', amount: step.figure.amount, drill: step.figure.drill })),
    { label: 'Profit before tax', kind: 'total', amount: bridge.profitBeforeTax.amount, drill: null },
    { label: ADJUSTMENT_LABELS['corporate-income-tax'], kind: 'step', amount: bridge.corporateIncomeTax.figure.amount, drill: null },
    { label: 'Profit after tax', kind: 'total', amount: bridge.profitAfterTax.amount, drill: null },
    { label: 'Not explained', kind: 'residual', amount: bridge.unexplainedAfterTax?.figure.amount ?? 0, drill: null },
  ]
  const total = (key: string, figure: TracedFigure): BridgeStepView => ({ key, label: figureLabel(figure), cents: figure.amount, to: drillOf(figure), kind: null, rules: [] })
  const adjustment = (entry: AccrualAdjustment): BridgeStepView => ({
    key: entry.id,
    label: figureLabel(entry.figure),
    cents: entry.figure.amount,
    to: drillOf(entry.figure),
    kind: entry.kind,
    rules: ruleChips(entry.figure.rules),
  })
  const residual = (id: string, label: string, entry: AccrualAdjustment | null): BridgeStepView => ({
    key: id,
    label,
    cents: entry?.figure.amount ?? 0,
    to: null,
    kind: entry === null ? 'matched' : 'open',
    rules: [],
  })

  return {
    accrual,
    tiles: STATUSES.map((status) => ({
      label: STATUS_WORDING[status].label,
      value: String(comparison.lines.filter((line) => line.status === status).length),
      to: null,
      caption: `of ${comparison.lines.length} lines`,
      definition: STATUS_WORDING[status].meaning,
    })),
    chart: bridgeChart(bars, chartTokens()),
    chartHeight: bars.length * 28 + 48,
    steps: [
      total('cash-net', bridge.cashNet),
      ...bridge.steps.map(adjustment),
      total('profit-before-tax', bridge.profitBeforeTax),
      residual('unexplained-before-tax', 'Not explained before tax', bridge.unexplainedBeforeTax),
      adjustment(bridge.corporateIncomeTax),
      total('profit-after-tax', bridge.profitAfterTax),
      residual('unexplained-after-tax', 'Not explained after tax', bridge.unexplainedAfterTax),
    ],
    tables: TABLES.map((table) => ({
      ...table,
      rows: comparison.lines
        .filter((line) => table.statements.includes(line.statement) && (line.statement !== 'grant' || GRANT_LINES[line.line] === table.key))
        .map(rowOf),
    })),
    recorded: comparison.recorded.map((entry) => ({
      key: `${entry.accountant.statement}-${entry.accountant.line}`,
      label: lineLabel(entry.accountant.statement, entry.accountant.line),
      value: shownOf(entry.accountant.figure),
      check: entry.check === null ? null : { status: (entry.check.holds ? 'matched' : 'open') as LineStatus, finding: entry.check.finding, to: entry.check.drill === null ? null : drillLocation(entry.check.drill) },
    })),
    distribution: comparison.distribution,
    konto: comparison.konto.map((group) => ({
      key: group.konto.map((line) => line.line).join('-'),
      konto: group.konto.map((line) => ({ line: line.line, label: line.label, cents: line.figure.kind === 'money' ? line.figure.amount : 0 })),
      categories: group.categories.map((figure, index) => ({ key: `${index}-${figure.label}`, label: figureLabel(figure), cents: figure.amount, to: drillOf(figure) })),
      accountant: group.accountant,
      ours: group.ours,
      difference: group.difference,
    })),
    unnamedKonto: comparison.unnamedKonto.map((line) => ({ line: line.line, label: line.label, cents: line.figure.kind === 'money' ? line.figure.amount : 0 })),
    openItems: yearEndOpenItems(workbook, accrual).map((item) => ({
      key: item.key,
      group: item.group,
      title: figureLabel({ label: item.title, on: item.on }),
      settledBy: item.settledBy,
      settled: item.settled,
      cents: item.figure?.amount ?? null,
      to: drillOf(item.figure),
      rules: chipsOf(item.rules),
    })),
    missingRoles: missingAccrualRoles(workbook.categories),
    noVat: workbook.categories.every((category) => category.vat === 'none'),
    unregistered: workbook.settings.companyFacts.companyRegistered === null,
  }
}

function rowOf(compared: ComparedLine): ComparisonRow {
  const { ours, cash } = compared
  return {
    key: `${compared.statement}-${compared.line}`,
    label: lineLabel(compared.statement, compared.line),
    printed: compared.accountant.label,
    accountant: shownOf(compared.accountant.figure),
    ours: ours === null ? null : oursValue(ours),
    oursTo: ours?.kind === 'money' ? drillOf(ours.figure) : null,
    cash: cash?.amount ?? null,
    cashTo: drillOf(cash),
    difference: compared.difference,
    residual: compared.residual,
    status: compared.status,
    explainedBy: compared.explainedBy.map((entry) => ({
      key: entry.id,
      label: ADJUSTMENT_LABELS[entry.id],
      cents: amountOnLine(entry, compared.line),
      to: drillOf(entry.figure),
      depth: 0,
    })),
    oursSteps: ours?.kind === 'money' ? stepsOf(ours.figure, drillOf) : [],
    cashSteps: stepsOf(cash, drillOf),
    rules: ruleChips(ours === null ? [] : ours.kind === 'money' ? ours.figure.rules : ours.kind === 'rate' ? ours.rate.rules : []),
  }
}

function drillOf(figure: TracedFigure | null): ReturnType<typeof drillLocation> {
  return figure?.drill == null ? null : drillLocation(figure.drill)
}

function shownOf(figure: YearEndFigure): ShownValue {
  return figure.kind === 'money' ? { cents: figure.amount } : { text: shownText(figure) }
}

function shownText(figure: YearEndFigure): string {
  switch (figure.kind) {
    case 'money':
      return ''
    case 'rate':
      return percentText(figure.basisPoints as Rate)
    case 'count':
      return String(figure.count)
    case 'date':
      return dayLabel(figure.date)
  }
}

function oursValue(line: AccrualLine): ShownValue {
  if (line.kind === 'money') return { cents: line.figure.amount }
  if (line.kind === 'rate') return { text: percentText(line.rate.basisPoints) }
  return { text: String(line.count) }
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Year end" description="Do our books agree with the accountant's, and why not? The accountant's figures beside ours, with the bridge that explains each difference.">
      <template v-if="years.length > 1 && settings.ownerPayModule" #actions>
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
        v-if="ledger && years.length === 0"
        icon="i-lucide-calendar-check"
        title="No year-end figures on the year-end tab"
        description="The year-end tab holds the accountant's figures for a closed year, typed once from the year-end package: the profit and loss, the balance sheet, the PD return, the distribution decision, the grant and the konto lines. With them this screen sets the books beside the accountant's and explains each difference."
        :actions="[{ label: 'Open the Year end tab', to: '/workbook?tab=year-end', color: 'neutral', variant: 'outline' }]"
        variant="outline"
        class="rounded-card border-dashed bg-raised/40"
        data-testid="year-end-empty"
      />
      <UEmpty
        v-else-if="view && view.failure !== null"
        icon="i-lucide-triangle-alert"
        title="The year could not be worked out"
        :description="view.failure"
        :actions="[{ label: 'Open the workbook settings', to: '/workbook', color: 'neutral', variant: 'outline' }]"
        variant="outline"
        class="rounded-card border-error/40 bg-raised"
        :ui="{ avatar: 'text-error' }"
      />
      <template v-else-if="view && view.failure === null">
        <UAlert
          icon="i-lucide-info"
          color="neutral"
          variant="subtle"
          title="Planning figures to discuss with your accountant, not filing advice"
          :description="`The rules behind them were last checked against their sources on ${checkedOn}.`"
          data-testid="planning-banner"
        />

        <div v-if="view.missingRoles.length > 0 || view.noVat || view.unregistered" class="flex flex-col gap-3">
          <MissingRoles :missing="view.missingRoles" />
          <div v-if="view.noVat" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-receipt" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <p>
              No category has a <span class="identifier">vat</span> treatment, so no input VAT leaves the costs.
              <DrillLink to="/workbook?tab=categories" in-prose class="text-highlighted">Set it on the categories tab</DrillLink>
            </p>
          </div>
          <div v-if="view.unregistered" class="flex items-start gap-2 text-sm text-toned">
            <UIcon name="i-lucide-calendar-x" class="mt-0.5 size-4 shrink-0 text-[var(--tone-warning)]" aria-hidden="true" />
            <p>
              <span class="identifier">hr_company_registered</span> is blank, so {{ year }} counts as a full tax period and the advances paid in it are not known.
              <DrillLink to="/workbook" in-prose class="text-highlighted">Set it on the Workbook screen</DrillLink>
            </p>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="status-tiles">
          <KpiTile v-for="tile in view.tiles" :key="tile.label" v-bind="tile" />
        </div>

        <DrillChartCard
          :chart="view.chart"
          :title="`From the cash net to profit, ${year}`"
          subtitle="One bar per adjustment, then the corporate tax, and last what nothing explains. A bar opens its rows."
          definition="The cash net is the bank rows and the owner's advances of the year, as the other screens count them. Each step turns part of it into the accrual view the accountant books."
          :height="view.chartHeight"
          :phone-height="view.chartHeight"
        >
          <template #legend><ChartLegend :entries="view.chart.legend" /></template>
        </DrillChartCard>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" aria-labelledby="bridge-steps-title">
          <header class="px-4 pt-4 sm:px-5">
            <h2 id="bridge-steps-title" class="text-sm font-medium text-highlighted">The bridge, step by step</h2>
            <p class="mt-0.5 text-xs text-muted">Each adjustment with how it stands against the accountant and the rules behind it.</p>
          </header>
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <BridgeSteps :steps="view.steps" />
          </div>
        </section>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">Open items</h2>
            <p class="mt-0.5 text-xs text-muted">What to settle with the accountant, and what would settle it.</p>
          </header>
          <div class="px-4 pt-3 pb-4 sm:px-5">
            <OpenItems :items="view.openItems" />
          </div>
        </section>

        <section v-for="table in view.tables" :key="table.key" class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">{{ table.title }}</h2>
            <p class="mt-0.5 text-xs text-muted">{{ table.description }} Open a line for how ours is built.</p>
          </header>
          <div class="px-4 pt-3 pb-3 sm:px-3">
            <p v-if="table.rows.length === 0" class="py-4 text-sm text-muted">The year-end tab holds none of these lines for {{ year }}.</p>
            <ComparisonTable v-else :rows="table.rows" :test-id="`comparison-${table.key}`" />
          </div>
          <div v-if="table.key === 'tax' && (view.recorded.length > 0 || view.distribution)" class="flex flex-col gap-2 border-t border-default px-4 py-3 sm:px-5" data-testid="recorded-lines">
            <h3 class="text-xs font-medium text-muted">Dates and the distribution decision, as the accountant records them</h3>
            <ul class="flex flex-col">
              <li v-for="entry in view.recorded" :key="entry.key" class="recorded-row">
                <p class="min-w-0 text-sm text-toned">{{ entry.label }}</p>
                <p class="text-sm text-highlighted"><MoneyText v-if="'cents' in entry.value" :cents="entry.value.cents" /><template v-else>{{ entry.value.text }}</template></p>
                <div v-if="entry.check" class="recorded-check">
                  <StatusBadge :status="entry.check.status" />
                  <DrillLink :to="entry.check.to" :label="`${entry.check.finding}, open the rows`" class="text-xs text-muted">{{ entry.check.finding }}</DrillLink>
                </div>
              </li>
              <li v-if="view.distribution" class="recorded-row">
                <p class="min-w-0 text-sm text-toned">The decision shares out</p>
                <p class="text-sm text-highlighted"><MoneyText :cents="view.distribution.shared" /></p>
                <div class="recorded-check">
                  <StatusBadge :status="view.distribution.residual === 0 ? 'matched' : 'open'" />
                  <span class="text-xs text-muted">
                    Our profit after tax is <MoneyText :cents="view.distribution.profitAfterTax" /><template v-if="view.distribution.residual !== 0">, a residual of <MoneyText :cents="view.distribution.residual" sign="always" /></template>
                  </span>
                </div>
              </li>
            </ul>
          </div>
        </section>

        <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised">
          <header class="px-4 pt-4 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">Konto lines</h2>
            <p class="mt-0.5 text-xs text-muted">
              Each konto line beside our accrual figure for the categories its <span class="identifier">categories</span> cell names. Lines that share a category
              are compared together.
            </p>
          </header>
          <div class="px-4 pt-2 pb-3 sm:px-5">
            <p v-if="view.konto.length === 0 && view.unnamedKonto.length === 0" class="py-4 text-sm text-muted">The year-end tab holds no konto lines for {{ year }}.</p>
            <KontoTable v-else :groups="view.konto" :unnamed="view.unnamedKonto" />
          </div>
        </section>
      </template>
    </LedgerGate>
  </section>
</template>

<style scoped>
.recorded-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.25rem 1rem;
  align-items: baseline;
  padding-block: 0.5rem;
}

.recorded-row + .recorded-row {
  border-top: 1px solid var(--border-default);
}

.recorded-check {
  display: flex;
  grid-column: 1 / -1;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.75rem;
}

@media (min-width: 640px) {
  .recorded-row {
    grid-template-columns: minmax(0, 14rem) 9rem minmax(0, 1fr);
  }

  .recorded-check {
    grid-column: auto;
  }
}
</style>
