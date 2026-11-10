<script setup lang="ts">
import { ref } from 'vue'

import { formatMoney } from '../../shared/money/moneyFormat'
import AppCard from '../../shared/ui/AppCard.vue'
import ComparedFigure from '../../shared/ui/ComparedFigure.vue'
import ScenarioComparison from '../../shared/ui/ScenarioComparison.vue'
import type { ComparedColumn, ComparedLine } from '../../shared/ui/ScenarioComparison.vue'
import ScenarioPicker from '../../shared/ui/ScenarioPicker.vue'
import SparkLine from '../../shared/ui/SparkLine.vue'
import type { PickerOption } from '../../shared/ui/ScenarioPicker.vue'
import GallerySection from './GallerySection.vue'
import { moneyFromCents } from '../../shared/money/money'

/** Made-up scenarios A to E, four picked, colours by slot. */
const OPTIONS: readonly PickerOption[] = [
  { value: 'a', label: 'Jadran Bank', baseLabel: 'A · Jadran Bank' },
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
  if (!picked.value.includes(base.value)) base.value = picked.value[0] ?? 'a'
}

const COLUMNS: readonly ComparedColumn[] = [
  { key: 'a', label: 'A', isBase: true },
  { key: 'b', label: 'B', isBase: false },
  { key: 'c', label: 'C', isBase: false },
  { key: 'd', label: 'D', isBase: false },
]

const cell = (cents: number, best = false, difference: string | null = null) => ({ text: formatMoney(moneyFromCents(cents)), best, difference })

const LINES: readonly ComparedLine[] = [
  {
    key: 'instalment',
    label: 'Monthly instalment',
    caption: 'an estimate from 20 Mar 2032',
    total: false,
    cells: [
      { ...cell(101_245), captioned: false },
      { ...cell(116_667, false, '+€154.22'), second: 'last €836.11', captioned: false },
      { ...cell(100_812, true, '−€4.33'), captioned: false },
      { ...cell(104_100, false, '+€28.55'), second: 'last €1,087.40' },
    ],
  },
  {
    key: 'interest',
    label: 'Interest',
    total: false,
    cells: [cell(2_149_425), cell(2_016_667, true, '−€1,327.58'), cell(2_097_440, false, '−€519.85'), cell(2_492_000, false, '+€3,425.75')],
  },
  {
    key: 'total',
    label: 'You pay in all',
    caption: 'principal, interest, extra and costs, less the subsidy',
    total: true,
    cells: [cell(12_149_425), cell(12_016_667, true, '−€1,327.58'), cell(12_097_440, false, '−€519.85'), cell(12_492_000, false, '+€3,425.75')],
  },
  {
    key: 'payoff',
    label: 'Paid off',
    total: false,
    cells: [
      { text: 'Oct 2036', best: false, difference: null },
      { text: 'Oct 2036', best: false, difference: null },
      { text: 'Oct 2036', best: false, difference: null },
      { text: 'Oct 2036', best: false, difference: null },
    ],
  },
  {
    key: 'subsidy',
    label: 'Subsidy pays',
    total: false,
    cells: [cell(255_000), { ...cell(255_000), warning: 'then paid back' }, cell(255_000), cell(255_000)],
  },
]

const markOf = (key: string): string => `var(${COLOURS[key] ?? '--border-strong'})`
const OWED = [108, 100, 93, 85, 76, 67, 57, 46, 35, 23, 11, 0]
const OWED_SOONER = [108, 96, 84, 72, 60, 47, 34, 21, 8, 0]
</script>

<template>
  <GallerySection
    id="scenario-comparison"
    title="ScenarioPicker and ScenarioComparison"
    description="Up to four scenarios picked, and the one the others are compared against. Side by side, the base marked, a tick on a line's one best figure, a second figure where an instalment changes and the difference to the base under each. Below 768 px each scenario is a card of its own with its lines in order. A figure can open how it is built."
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
        @toggle="toggle"
        @base="base = $event"
      >
        <template #mark="{ option }">
          <span class="swatch swatch-line h-0.75" :style="{ '--swatch': markOf(option.value) }" aria-hidden="true" />
        </template>
      </ScenarioPicker>
      <ScenarioComparison :columns="COLUMNS" :lines="LINES" label="Made-up scenarios side by side" base-note="The base" best-note="the best" line-heading="Line">
        <template #column="{ column }">
          <span class="inline-flex items-center gap-1.5"><span class="swatch swatch-line h-0.75" :style="{ '--swatch': markOf(column.key) }" aria-hidden="true" />{{ column.label }}</span>
        </template>
      </ScenarioComparison>
    </AppCard>
    <AppCard as="div" class="gap-2 p-4 sm:p-5">
      <ScenarioComparison
        :columns="COLUMNS.slice(0, 2)"
        :lines="LINES.map((line) => ({ ...line, cells: line.cells.slice(0, 2) }))"
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
    <AppCard as="div" class="gap-2 p-4 sm:p-5">
      <ScenarioComparison
        :columns="COLUMNS.slice(0, 2)"
        :lines="LINES.slice(0, 3).map((line, at) => ({ ...line, group: at === 0 ? 'Paid in' : 'Paid out', cells: line.cells.slice(0, 2) }))"
        label="Two scenarios with headings over their lines and a figure drawn its own way"
        base-note="The base"
        best-note="the best"
        line-heading="Line"
      >
        <template #figure="{ cell: figure, line }">
          <span class="inline-flex items-center gap-2">
            <ComparedFigure :cell="figure" :total="line.total" best-note="the best" />
            <span class="type-caption">beside</span>
          </span>
        </template>
      </ScenarioComparison>
      <p class="type-caption">
        A line's group is a heading over the lines that share it, in the table and on each card. The figure slot draws a table figure its own way, such as with Ask the chat beside it.
      </p>
    </AppCard>
    <div class="flex flex-col gap-2 type-caption">
      <SparkLine :points="OWED_SOONER" :against="OWED" colour="var(--scenario-3)" against-colour="var(--scenario-1)" fill :height="56" />
      <span>SparkLine with a second line on the same scale under it, what the first is compared against</span>
    </div>
  </GallerySection>
</template>
