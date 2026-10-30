<script setup lang="ts">
import { ref } from 'vue'

import { formatMoney } from '../../shared/money/moneyFormat'
import AppCard from '../../shared/ui/AppCard.vue'
import DashboardGrid from '../../shared/ui/DashboardGrid.vue'
import FactGrid from '../../shared/ui/FactGrid.vue'
import ScenarioComparison from '../../shared/ui/ScenarioComparison.vue'
import type { ComparedColumn, ComparedGroup } from '../../shared/ui/ScenarioComparison.vue'
import ScenarioPicker from '../../shared/ui/ScenarioPicker.vue'
import SparkLine from '../../shared/ui/SparkLine.vue'
import type { PickerOption } from '../../shared/ui/ScenarioPicker.vue'
import GallerySection from './GallerySection.vue'

/** Made-up scenarios A to E: A always compared, three more picked of four, colours by slot. */
const OPTIONS: readonly PickerOption[] = [
  { value: 'a', label: 'As it stands', baseLabel: 'A · As it stands', locked: true },
  { value: 'b', label: '€10,000 in January', baseLabel: 'B · €10,000 in January' },
  { value: 'c', label: '€150 a month', baseLabel: 'C · €150 a month' },
  { value: 'd', label: 'Another bank', baseLabel: 'D · Another bank' },
  { value: 'e', label: 'Rate rises to 5%', baseLabel: 'E · Rate rises to 5%' },
]
const COLOURS: Readonly<Record<string, string>> = { a: '--scenario-1', b: '--scenario-2', c: '--scenario-3', d: '--scenario-4' }

const picked = ref<string[]>(['a', 'b', 'c', 'd'])
const base = ref('a')
const opened = ref<string | null>(null)

function toggle(value: string): void {
  picked.value = picked.value.includes(value) ? picked.value.filter((key) => key !== value) : [...picked.value, value]
  if (!picked.value.includes(base.value)) base.value = 'a'
}

const COLUMNS: readonly ComparedColumn[] = [
  { key: 'a', label: 'A', isBase: true },
  { key: 'b', label: 'B', isBase: false },
  { key: 'c', label: 'C', isBase: false },
  { key: 'd', label: 'D', isBase: false },
]

const cell = (cents: number, best = false, difference: string | null = null) => ({ text: formatMoney(cents), best, difference })

const GROUPS: readonly ComparedGroup[] = [
  {
    key: 'instalments',
    label: 'Instalments',
    lines: [
      { key: 'next', label: 'Next instalment', caption: '15 Nov 2026', total: false, cells: [cell(59_433), cell(59_433), cell(59_433), cell(59_433)] },
      { key: 'highest', label: 'Highest instalment', caption: 'an estimate after Mar 2028', total: false, cells: [cell(62_120), cell(61_587, true, '−€5.33'), cell(62_120), cell(62_120)] },
      {
        key: 'left',
        label: 'Instalments left',
        total: false,
        cells: [
          { text: '257', best: false, difference: null },
          { text: '226', best: false, difference: '−31' },
          { text: '202', best: true, difference: '−55' },
          { text: '257', best: false, difference: null },
        ],
      },
    ],
  },
  {
    key: 'costs',
    label: 'What it costs',
    lines: [
      {
        key: 'interest',
        label: 'Interest left',
        total: false,
        cells: [cell(5_083_090), cell(3_983_971, true, '−€10,991.19'), cell(4_039_016, false, '−€10,440.74'), cell(4_097_649, false, '−€9,854.41')],
      },
      {
        key: 'subsidy',
        label: 'Subsidy pays',
        total: false,
        cells: [cell(255_000), { ...cell(255_000), warning: 'then paid back' }, cell(255_000), cell(255_000)],
      },
      {
        key: 'total',
        label: 'You pay in all',
        caption: 'principal, interest, extra and costs, less the subsidy',
        total: true,
        cells: [cell(15_666_809), cell(14_567_690, true, '−€10,991.19'), cell(14_622_735, false, '−€10,440.74'), cell(14_761_368, false, '−€9,054.41')],
      },
    ],
  },
]

const markOf = (key: string): string => `var(${COLOURS[key] ?? '--border-strong'})`
const OWED = [108, 100, 93, 85, 76, 67, 57, 46, 35, 23, 11, 0]
const OWED_SOONER = [108, 96, 84, 72, 60, 47, 34, 21, 8, 0]
const ROW_FACTS = [
  { label: 'Paid off', value: 'Mar 2048' },
  { label: 'Interest left', value: formatMoney(5_083_090), caption: '€10,991.19 less' },
]
</script>

<template>
  <GallerySection
    id="scenario-comparison"
    title="ScenarioPicker and ScenarioComparison"
    description="Up to four scenarios picked, one always, and the one the others are compared against. Side by side, the base marked, a tick on a line's one best figure and the difference to the base under each. Below 768 px each line keeps every figure, two by two. A figure can open how it is built."
  >
    <AppCard as="div" class="gap-4 p-4 sm:p-5">
      <ScenarioPicker
        :options="OPTIONS"
        :picked="picked"
        :base="base"
        :most="4"
        label="Scenarios to compare, up to 4"
        against-label="Compare against"
        full-note="4 are picked. Unpick one to pick another."
        locked-note="always compared"
        @toggle="toggle"
        @base="base = $event"
      >
        <template #mark="{ option }">
          <span class="swatch swatch-line h-0.75" :style="{ '--swatch': markOf(option.value) }" aria-hidden="true" />
        </template>
      </ScenarioPicker>
      <ScenarioComparison :columns="COLUMNS" :groups="GROUPS" label="Made-up scenarios side by side" base-note="The base" best-note="the best" line-heading="Line">
        <template #column="{ column }">
          <span class="inline-flex items-center gap-1.5"><span class="swatch swatch-line h-0.75" :style="{ '--swatch': markOf(column.key) }" aria-hidden="true" />{{ column.label }}</span>
        </template>
      </ScenarioComparison>
    </AppCard>
    <AppCard as="div" class="gap-2 p-4 sm:p-5">
      <ScenarioComparison
        :columns="COLUMNS.slice(0, 2)"
        :groups="[{ key: 'costs', label: 'What it costs', lines: GROUPS[1]!.lines.map((line) => ({ ...line, cells: line.cells.slice(0, 2) })) }]"
        label="Two scenarios whose figures open"
        base-note="The base"
        best-note="the best"
        line-heading="Line"
        openable
        :open-label="(line: string, column: string) => `${line}, ${column}: open how it is built`"
        @open="(line: string, column: string) => (opened = `${line} of ${column}`)"
      />
      <p class="type-caption" aria-live="polite">{{ opened === null ? 'Each figure is a button here.' : `Opened ${opened}.` }}</p>
    </AppCard>
    <h3 class="type-label">DashboardGrid row: up to four cards, two to a row from sm and one row from xl</h3>
    <DashboardGrid layout="row">
      <AppCard v-for="key in ['a', 'b', 'c', 'd']" :key="key" as="article" class="gap-2 border-t-3 p-4" :style="{ borderTopColor: markOf(key) }">
        <p class="text-sm font-semibold text-highlighted">Scenario {{ key.toUpperCase() }}</p>
        <FactGrid :facts="ROW_FACTS" />
      </AppCard>
    </DashboardGrid>
    <div class="flex flex-col gap-2 type-caption">
      <SparkLine :points="OWED_SOONER" :against="OWED" colour="var(--scenario-3)" against-colour="var(--scenario-1)" fill :height="56" />
      <span>SparkLine with a second line on the same scale under it, what the first is compared against</span>
    </div>
  </GallerySection>
</template>
