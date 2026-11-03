<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { copyScenario, removeScenario } from '../application/scenarioWrites'
import { scenarioBalanceChart, scenarioChartSpan, scenarioInterestChart } from './scenarioCharts'
import { MOST_COMPARED, refusalText } from './scenarioComparison'
import ScenarioList from './ScenarioList.vue'
import ScenarioMark from './ScenarioMark.vue'
import { chartedScenarios, earliestPayoff, offersComparison, scenarioRows, slotted, workedOffers } from './scenariosView'
import type { ScenarioMarking, ScenarioRow } from './scenariosView'
import type { ScenarioCompare } from './useScenarioCompare'
import { words } from './words'
import { fractionOf, rateText } from '../../bankLoans/domain/yearlyRate'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import { words as loansWords } from '../../words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { useChartRange } from '../../../../shared/charts/useChartRange'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import ScenarioComparison from '../../../../shared/ui/ScenarioComparison.vue'
import ScenarioPicker from '../../../../shared/ui/ScenarioPicker.vue'

/**
 * The offers you are weighing: the picker, the figures side by side with what your savings earn, what
 * each owes and pays in interest over time, folded until opened, and every offer kept.
 */
const props = defineProps<{
  scenarios: readonly ScenarioBook[]
  compare: ScenarioCompare
  today: CivilDate
}>()

const emit = defineEmits<{
  edit: [book: ScenarioBook, mark: ScenarioMarking | null]
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)
const phone = usePhoneLayout()

const worked = computed(() => workedOffers(props.scenarios))
const compared = computed(() => slotted(worked.value, props.compare.picked.value))
const base = computed(() => props.compare.base.value)
const baseEntry = computed(() => compared.value.find((entry) => entry.worked.key === base.value) ?? null)

const options = computed(() =>
  worked.value.map((entry) => {
    const slot = compared.value.find((held) => held.worked.key === entry.key)
    return { value: entry.key, label: entry.name, baseLabel: slot === undefined ? entry.name : `${slot.letter} · ${entry.name}` }
  }),
)
const markOf = (key: string) => {
  const slot = compared.value.find((held) => held.worked.key === key)
  return slot === undefined ? null : { letter: slot.letter, colour: slot.colour }
}

const charted = computed(() => chartedScenarios(compared.value, null))
const scenarioRange = useChartRange(
  () => scenarioChartSpan(charted.value),
  () => props.today,
)
const balanceChart = computed(() => scenarioBalanceChart(charted.value, base.value ?? '', chartTokens(), phone.value, scenarioRange.window.value))
const interestChart = computed(() => scenarioInterestChart(charted.value, base.value ?? '', chartTokens(), phone.value, scenarioRange.window.value))
const legend = computed(() => charted.value.map((entry) => ({ label: `${entry.letter} ${entry.name}`, colour: `var(${entry.colour})`, mark: 'line' as const })))
/** The first due date at a variable rate in any compared offer, after which its figures are estimates. */
const variableFrom = computed(() =>
  compared.value.reduce<CivilDate | null>((earliest, { worked: entry }) => {
    const day = entry.outcome?.variableFrom ?? null
    return day !== null && (earliest === null || day < earliest) ? day : earliest
  }, null),
)

const comparison = computed(() => offersComparison(compared.value, base.value ?? '', props.compare.savings.value))
const baseLetter = computed(() => baseEntry.value?.letter ?? 'A')

/** The lines with the notes under their labels. */
const lines = computed(() => {
  const savings = props.compare.savings.value
  const horizon = earliestPayoff(compared.value)
  const captionOf = (key: string, estimated: boolean): string | null => {
    if (key === 'instalment') return estimated && variableFrom.value !== null ? words.captions.estimateAfter(dayLabel(variableFrom.value)) : null
    if (key === 'total') return words.captions.total
    if (key === 'eks') return words.captions.eks
    if (key === 'left-over') return savings === null || horizon === null ? null : words.captions.leftOver(dayLabel(horizon), formatRate(fractionOf(savings)))
    return null
  }
  return comparison.value.lines.map((line) => {
    const estimated = line.cells.some((cell) => cell.estimate)
    return {
      ...line,
      caption: captionOf(line.key, estimated),
      cells: estimated ? line.cells.map((cell) => ({ ...cell, captioned: cell.estimate })) : line.cells,
    }
  })
})
const columns = computed(() => comparison.value.columns.map((column) => ({ key: column.key, label: `${column.letter}, ${column.name}`, isBase: column.isBase, name: column.name })))
const columnName = (key: string) => columns.value.find((column) => column.key === key)?.name ?? ''

const termsDiffer = computed(() => new Set(compared.value.flatMap(({ worked: entry }) => (entry.outcome === null ? [] : [entry.outcome.instalments]))).size > 1)
/** The offers that mean paying the subsidy back, in one warning, with the most the subsidy has paid by any of their repayments. */
const payback = computed(() => {
  const backs = compared.value.flatMap(({ worked: entry, letter }) => (entry.outcome?.subsidyPayback ? [{ letter, payback: entry.outcome.subsidyPayback }] : []))
  const last = backs.at(-1)
  if (last === undefined) return null
  const letters =
    backs.length === 1
      ? last.letter
      : words.table.letters(
          backs
            .slice(0, -1)
            .map((entry) => entry.letter)
            .join(', '),
          last.letter,
        )
  const most = backs.reduce((highest, entry) => (entry.payback.paidByChange > highest ? entry.payback.paidByChange : highest), last.payback.paidByChange)
  return { title: plural(words.table.subsidyTitle(letters), backs.length), description: words.table.subsidy(dayLabel(last.payback.until), formatMoney(most)) }
})
/** The compared offers Kuna cannot work out, and why. */
const refused = computed(() => compared.value.flatMap(({ worked: entry, letter }) => ('refused' in entry.plan ? [{ key: entry.key, letter, name: entry.name, reason: refusalText(entry.plan) }] : [])))

const rows = computed(() => scenarioRows(worked.value, compared.value, base.value))

/** What the field shows, kept as typed, since a half-typed rate such as "2," is in no address. */
const savingsText = ref(props.compare.savings.value === null ? '' : rateText(props.compare.savings.value))

function typeSavings(text: string): void {
  savingsText.value = text
  props.compare.setSavings(text)
}

async function copy(row: ScenarioRow): Promise<void> {
  const book = row.kept
  await writes.write(words.list.copied, (unit) => void copyScenario(unit, book, words.list.copyName(book.scenario.name)), { failedTitle: words.list.notCopied, key: `copy-${row.key}` })
}

async function remove(row: ScenarioRow): Promise<void> {
  const records = store.state.records
  if (records !== null) {
    await writes.write(words.list.deleted, (unit) => removeScenario(unit, records, row.kept.scenario), { failedTitle: loansWords.form.notDeleted, key: `delete-${row.key}` })
  }
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <ScenarioPicker
      :options="options"
      :picked="compare.picked.value.map((entry) => entry.key)"
      :base="base ?? ''"
      :most="MOST_COMPARED"
      :label="words.picker.offers(MOST_COMPARED)"
      :against-label="words.picker.against"
      :full-note="words.picker.full(MOST_COMPARED)"
      @toggle="compare.toggle"
      @base="compare.pickBase"
    >
      <template #mark="{ option }">
        <ScenarioMark :letter="markOf(option.value)?.letter ?? null" :colour="markOf(option.value)?.colour ?? null" />
      </template>
    </ScenarioPicker>

    <AppCard v-if="columns.length > 0 || refused.length > 0" :title="words.table.title" :subtitle="words.table.subtitle(baseLetter)" data-testid="side-by-side">
      <div class="flex flex-col gap-3 px-4 pb-4 sm:px-5">
        <ScenarioComparison
          v-if="columns.length > 0"
          :columns="columns"
          :lines="lines"
          :label="words.table.label"
          :base-note="words.table.baseNote"
          :best-note="words.table.best"
          :line-heading="words.table.lineHeading"
        >
          <template #column="{ column }">
            <span class="inline-flex flex-wrap items-center justify-end gap-x-1.5">
              <ScenarioMark :letter="markOf(column.key)?.letter ?? null" :colour="markOf(column.key)?.colour ?? null" />
              <span>{{ columnName(column.key) }}</span>
            </span>
          </template>
        </ScenarioComparison>
        <p v-if="termsDiffer" class="type-caption">{{ words.table.termsDiffer }}</p>
        <UAlert v-if="payback" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="payback.title" :description="payback.description" data-testid="scenario-subsidy-back" />
        <UAlert
          v-for="entry in refused"
          :key="entry.key"
          icon="i-lucide-triangle-alert"
          color="warning"
          variant="subtle"
          :title="words.table.refusedTitle(entry.letter, entry.name)"
          :description="entry.reason"
        />
        <UFormField :label="words.table.savings" :help="words.table.savingsHelp" class="sm:max-w-md">
          <UInput
            :model-value="savingsText"
            inputmode="decimal"
            :placeholder="words.table.savingsPlaceholder"
            class="w-full"
            data-testid="scenario-savings"
            @update:model-value="typeSavings(String($event))"
          />
        </UFormField>
      </div>
    </AppCard>

    <DashboardGrid v-if="charted.length > 0" layout="pair">
      <ChartCard
        v-model:range="scenarioRange.range.value"
        :title="words.charts.owed"
        :subtitle="words.charts.owedSubtitle"
        :option="balanceChart.option"
        :description="balanceChart.description"
        :height="260"
        :phone-height="220"
        :ranges="scenarioRange.ranges.value"
        collapse-id="loans.scenarios.owed"
        start-collapsed
        data-testid="scenario-balance-chart"
      >
        <template #legend><ChartLegend :entries="legend" /></template>
        <template v-if="variableFrom !== null" #footer>
          <p class="border-t border-default px-4 py-2 type-caption sm:px-5">{{ words.charts.variableFrom(dayLabel(variableFrom)) }}</p>
        </template>
      </ChartCard>
      <ChartCard
        v-model:range="scenarioRange.range.value"
        :title="words.charts.interest"
        :subtitle="words.charts.interestSubtitle"
        :option="interestChart.option"
        :description="interestChart.description"
        :height="260"
        :phone-height="220"
        :ranges="scenarioRange.ranges.value"
        collapse-id="loans.scenarios.interest"
        start-collapsed
        data-testid="scenario-interest-chart"
      >
        <template #legend><ChartLegend :entries="legend" /></template>
        <template #footer>
          <p class="border-t border-default px-4 py-2 type-caption sm:px-5">{{ words.charts.flat }}</p>
        </template>
      </ChartCard>
    </DashboardGrid>

    <ScenarioList
      :title="words.list.title"
      :subtitle="words.list.subtitle"
      :rows="rows"
      :busy="writes.busy.value"
      :saving="writes.saving"
      @edit="(row) => emit('edit', row.kept, row.mark)"
      @copy="copy"
      @remove="remove"
    />
  </div>
</template>
