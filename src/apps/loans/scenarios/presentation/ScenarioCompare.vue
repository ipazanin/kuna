<script setup lang="ts">
import { computed, ref } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { copyScenario, removeScenario } from '../application/scenarioWrites'
import AgainstBaseCard from './AgainstBaseCard.vue'
import ScenarioCard from './ScenarioCard.vue'
import { scenarioBalanceChart, scenarioInterestChart } from './scenarioCharts'
import { MOST_COMPARED } from './scenarioComparison'
import ScenarioList from './ScenarioList.vue'
import ScenarioMark from './ScenarioMark.vue'
import { againstBase, chartedScenarios, earliestPayoff, scenarioCards, scenarioRows, slotted, tabComparison, TRIED_EXTRA, workedScenarios } from './scenariosView'
import type { ScenarioMarking, ScenarioRow, ScenariosTab } from './scenariosView'
import { AS_IT_STANDS } from './useScenarioCompare'
import type { ScenarioCompare } from './useScenarioCompare'
import { words } from './words'
import { fractionOf, rateText } from '../../bankLoans/domain/yearlyRate'
import { words as bankWords } from '../../bankLoans/presentation/words'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { ScenarioBook } from '../../workbook/domain/readLoanBook'
import { words as loansWords } from '../../words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { chartTokens } from '../../../../shared/charts/chartTokens'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { formatMoney, formatRate } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import ChartCard from '../../../../shared/ui/ChartCard.vue'
import ChartLegend from '../../../../shared/ui/ChartLegend.vue'
import DashboardGrid from '../../../../shared/ui/DashboardGrid.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ScenarioComparison from '../../../../shared/ui/ScenarioComparison.vue'
import type { ComparedGroup } from '../../../../shared/ui/ScenarioComparison.vue'
import ScenarioPicker from '../../../../shared/ui/ScenarioPicker.vue'

/**
 * One tab of Scenarios: the picker, a card per compared scenario, what each owes and pays in
 * interest over time, how much less and sooner each pays than the base, the figures side by side
 * with what your savings earn, and every scenario kept for the tab.
 */
const props = defineProps<{
  tab: ScenariosTab
  compare: ScenarioCompare
  today: CivilDate
}>()

const emit = defineEmits<{
  edit: [book: ScenarioBook, mark: ScenarioMarking | null]
  create: []
  tryExtra: []
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)
const phone = usePhoneLayout()

const offers = computed(() => props.tab.kind === 'offers')
const from = computed(() => (offers.value ? null : props.today))
const worked = computed(() => workedScenarios(props.tab, props.today))
const compared = computed(() => slotted(worked.value, props.compare.picked.value))
const base = computed(() => props.compare.base.value)
const baseEntry = computed(() => compared.value.find((entry) => entry.worked.key === base.value) ?? null)

const options = computed(() =>
  worked.value.map((entry) => {
    const slot = compared.value.find((held) => held.worked.key === entry.key)
    return { value: entry.key, label: entry.name, baseLabel: slot === undefined ? entry.name : `${slot.letter} · ${entry.name}`, locked: entry.key === AS_IT_STANDS }
  }),
)
const markOf = (key: string) => {
  const slot = compared.value.find((held) => held.worked.key === key)
  return slot === undefined ? null : { letter: slot.letter, colour: slot.colour }
}

const cards = computed(() => scenarioCards(props.tab, compared.value, base.value, props.today))
const bars = computed(() => againstBase(compared.value, base.value))
const charted = computed(() => chartedScenarios(compared.value, from.value))
const balanceChart = computed(() => scenarioBalanceChart(charted.value, base.value, chartTokens(), phone.value))
const interestChart = computed(() => scenarioInterestChart(charted.value, base.value, chartTokens(), phone.value, from.value !== null))
const legend = computed(() => charted.value.map((entry) => ({ label: `${entry.letter} ${entry.name}`, colour: `var(${entry.colour})`, mark: 'line' as const })))
/** The first due date at a variable rate in any compared scenario, after which its figures are estimates. */
const variableFrom = computed(() =>
  compared.value.reduce<CivilDate | null>((earliest, { worked: entry }) => {
    const day = entry.outcome?.variableFrom ?? null
    return day !== null && (earliest === null || day < earliest) ? day : earliest
  }, null),
)

const comparison = computed(() => tabComparison(props.tab, compared.value, base.value, props.compare.savings.value))
const baseLetter = computed(() => baseEntry.value?.letter ?? 'A')

/** The lines in their groups, with the notes under their labels. */
const groups = computed((): ComparedGroup[] => {
  const savings = props.compare.savings.value
  const horizon = earliestPayoff(compared.value)
  const estimated = comparison.value.lines.find((line) => line.key === 'highest-instalment')?.cells.some((cell) => cell.estimate) === true
  const captionOf = (key: string): string | null => {
    if (key === 'highest-instalment') return estimated && variableFrom.value !== null ? words.captions.estimateAfter(dayLabel(variableFrom.value)) : null
    if (key === 'total') return words.captions.total
    if (key === 'eks') return words.captions.eks
    if (key === 'left-over') return savings === null || horizon === null ? null : words.captions.leftOver(dayLabel(horizon), formatRate(fractionOf(savings)))
    return null
  }
  return (['instalments', 'costs'] as const)
    .map((group) => ({
      key: group,
      label: words.groups[group],
      lines: comparison.value.lines.filter((line) => line.group === group).map((line) => ({ ...line, caption: captionOf(line.key) })),
    }))
    .filter((group) => group.lines.length > 0)
})
const columns = computed(() =>
  comparison.value.columns.map((column) => ({ key: column.key, label: `${column.letter}, ${column.name}`, isBase: column.isBase, letter: column.letter, colour: column.colour })),
)
const columnMark = (key: string) => columns.value.find((column) => column.key === key) ?? null

const termsDiffer = computed(() => offers.value && new Set(compared.value.flatMap(({ worked: entry }) => (entry.outcome === null ? [] : [entry.outcome.instalments]))).size > 1)
/** The scenarios that mean paying the subsidy back, in one warning, with the most the subsidy has paid by any of their repayments. */
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
const refused = computed(() => cards.value.filter((card) => card.refusal !== null))

const rows = computed(() => scenarioRows(worked.value, compared.value, base.value))

/** What the field shows, kept as typed, since a half-typed rate such as "2," is in no address. */
const savingsText = ref(props.compare.savings.value === null ? '' : rateText(props.compare.savings.value))

function typeSavings(text: string): void {
  savingsText.value = text
  props.compare.setSavings(text)
}

async function copy(book: ScenarioBook): Promise<void> {
  await writes.write(words.list.copied, (unit) => void copyScenario(unit, book, words.list.copyName(book.scenario.name)), { failedTitle: words.list.notCopied })
}

async function remove(book: ScenarioBook): Promise<void> {
  const records = store.state.records
  if (records !== null) await writes.write(words.list.deleted, (unit) => removeScenario(unit, records, book.scenario), { failedTitle: loansWords.form.notDeleted })
}

function edit(row: ScenarioRow): void {
  if (row.kept !== null) emit('edit', row.kept, row.mark)
}
</script>

<template>
  <div class="flex flex-col gap-5" :data-tab="tab.value">
    <UAlert
      v-if="tab.kind === 'loan' && tab.book.plan === null"
      icon="i-lucide-triangle-alert"
      color="warning"
      variant="subtle"
      :title="bankWords.noPlanTitle"
      :description="bankWords.noPlan(dayLabel(tab.book.loan.firstInstalment))"
    />
    <template v-else-if="tab.scenarios.length === 0">
      <EmptyState
        v-if="tab.kind === 'loan'"
        icon="i-lucide-flask-conical"
        :title="words.empty.title"
        :description="words.empty.description"
        :actions="[
          { label: words.newScenario, icon: 'i-lucide-plus', onClick: () => emit('create') },
          { label: words.empty.tryExtra(formatMoney(TRIED_EXTRA)), color: 'neutral', variant: 'outline', onClick: () => emit('tryExtra') },
        ]"
        data-testid="scenarios-empty"
      />
      <EmptyState
        v-else
        icon="i-lucide-file-plus-2"
        :title="words.empty.offersTitle"
        :description="words.empty.offersDescription"
        :actions="[{ label: words.newOffer, icon: 'i-lucide-plus', onClick: () => emit('create') }]"
        data-testid="scenarios-empty"
      />
    </template>
    <template v-else>
      <UAlert v-if="tab.kind === 'loan' && tab.paidOff !== null" icon="i-lucide-circle-check" color="info" variant="subtle" :description="words.paidOff(dayLabel(tab.paidOff))" />
      <template v-else>
        <ScenarioPicker
          :options="options"
          :picked="compare.picked.value.map((entry) => entry.key)"
          :base="base"
          :most="MOST_COMPARED"
          :label="offers ? words.picker.offers(MOST_COMPARED) : words.picker.loan(MOST_COMPARED)"
          :against-label="words.picker.against"
          :full-note="words.picker.full(MOST_COMPARED)"
          :locked-note="words.picker.locked"
          @toggle="compare.toggle"
          @base="compare.pickBase"
        >
          <template #mark="{ option }">
            <ScenarioMark :letter="markOf(option.value)?.letter ?? null" :colour="markOf(option.value)?.colour ?? null" />
          </template>
        </ScenarioPicker>

        <DashboardGrid v-if="cards.length > 0" layout="row">
          <ScenarioCard v-for="card in cards" :key="card.key" :card="card" />
        </DashboardGrid>

        <DashboardGrid v-if="charted.length > 0" layout="pair">
          <ChartCard
            :title="words.charts.owed"
            :subtitle="offers ? words.charts.owedOffers : words.charts.owedLoan"
            :option="balanceChart.option"
            :description="balanceChart.description"
            :height="260"
            :phone-height="220"
            data-testid="scenario-balance-chart"
          >
            <template #legend><ChartLegend :entries="legend" /></template>
            <template v-if="variableFrom !== null" #footer>
              <p class="border-t border-default px-4 py-2 type-caption sm:px-5">{{ words.charts.variableFrom(dayLabel(variableFrom)) }}</p>
            </template>
          </ChartCard>
          <ChartCard
            :title="offers ? words.charts.interestOffers : words.charts.interestLoan"
            :subtitle="words.charts.interestSubtitle"
            :option="interestChart.option"
            :description="interestChart.description"
            :height="260"
            :phone-height="220"
            data-testid="scenario-interest-chart"
          >
            <template #legend><ChartLegend :entries="legend" /></template>
            <template #footer>
              <p class="border-t border-default px-4 py-2 type-caption sm:px-5">{{ words.charts.flat }}</p>
            </template>
          </ChartCard>
        </DashboardGrid>

        <AgainstBaseCard v-if="bars.payLess.length > 0" :subtitle="words.against.subtitle(baseLetter, baseEntry?.worked.name ?? '')" :pay-less="bars.payLess" :sooner="bars.sooner" />

        <AppCard v-if="columns.length > 0" :title="words.table.title" :subtitle="offers ? words.table.offers(baseLetter) : words.table.loan(baseLetter)" data-testid="side-by-side">
          <div class="flex flex-col gap-3 px-4 pb-4 sm:px-5">
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
            <ScenarioComparison :columns="columns" :groups="groups" :label="words.table.label" :base-note="words.table.baseNote" :best-note="words.table.best" :line-heading="words.table.lineHeading">
              <template #column="{ column }">
                <ScenarioMark :letter="columnMark(column.key)?.letter ?? null" :colour="columnMark(column.key)?.colour ?? null" />
              </template>
            </ScenarioComparison>
            <p v-if="termsDiffer" class="type-caption">{{ words.table.termsDiffer }}</p>
            <UAlert v-if="payback" icon="i-lucide-triangle-alert" color="warning" variant="subtle" :title="payback.title" :description="payback.description" data-testid="scenario-subsidy-back" />
            <UAlert
              v-for="card in refused"
              :key="card.key"
              icon="i-lucide-triangle-alert"
              color="warning"
              variant="subtle"
              :title="words.table.refusedTitle(card.letter, card.name)"
              :description="card.refusal ?? ''"
            />
          </div>
        </AppCard>
      </template>

      <ScenarioList
        :title="tab.kind === 'loan' ? words.list.loan(tab.label) : words.list.offers"
        :subtitle="tab.kind === 'loan' ? words.list.loanSubtitle : words.list.offersSubtitle"
        :rows="rows"
        :busy="writes.busy.value"
        @edit="edit"
        @copy="copy"
        @remove="remove"
      />
    </template>
  </div>
</template>
