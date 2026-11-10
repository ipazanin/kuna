<script lang="ts">
export interface ComparedColumn {
  readonly key: string
  /** The column's name, which the `column` slot may draw in its own way. */
  readonly label: string
  readonly isBase: boolean
}

export interface ComparedCell {
  /** The figure as it reads. */
  readonly text: string
  /** A second figure under the first, such as where an instalment ends up. */
  readonly second?: string | null
  /** The one best figure of the line. */
  readonly best: boolean
  /** The difference to the base, such as "−€5.33", or null in the base's column and where nothing differs. */
  readonly difference: string | null
  /** Why the figure needs a second look, beside a warning icon. */
  readonly warning?: string | null
  /** False where the line's caption does not speak of this figure, so the column's card leaves it out. */
  readonly captioned?: boolean
}

export interface ComparedLine {
  readonly key: string
  readonly label: string
  /** A note under the label, such as the date a figure is due. */
  readonly caption?: string | null
  /** The heading over the run of lines that share it, such as "Taxes by type". Left out, the lines have no heading. */
  readonly group?: string | null
  /** The line the others add up to, set apart with a stronger rule. */
  readonly total: boolean
  /** One cell per column, in the columns' order. */
  readonly cells: readonly ComparedCell[]
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

import { useMediaQuery } from '../layout/viewport'
import ComparedFigure from './ComparedFigure.vue'
import FigureTable from './FigureTable.vue'

/**
 * Scenarios side by side, a column each, the base marked, its lines in order. A tick marks the best
 * figure of a line, and the figure under each is its difference to the base. Below 768 px each
 * column is a card of its own with its lines in the same order. With `openable`, a figure is a button
 * that opens how it is built.
 */
const props = withDefaults(
  defineProps<{
    columns: readonly ComparedColumn[]
    lines: readonly ComparedLine[]
    /** What a screen reader calls the table. */
    label: string
    /** The note under the base's name, such as "The base". */
    baseNote: string
    /** What a screen reader hears beside a ticked figure, such as "the best". */
    bestNote: string
    /** What a screen reader calls the column of line names. */
    lineHeading: string
    openable?: boolean
    /** The name of a figure's button, from its line's and its column's names. */
    openLabel?: (line: string, column: string) => string
  }>(),
  { openable: false, openLabel: (line: string, column: string) => `${line}, ${column}` },
)

const emit = defineEmits<{
  open: [line: string, column: string]
}>()

defineSlots<{
  /** A column's name, in the table's header and at the top of its card on a narrow screen. */
  column?: (scope: { column: ComparedColumn }) => unknown
  /** A figure in the table, which a screen may draw in its own way, such as with Ask the chat beside it. Left out, the figure is a button with `openable`. */
  figure?: (scope: { line: ComparedLine; column: ComparedColumn; cell: ComparedCell; index: number; open: () => void; openLabel: string }) => unknown
}>()

/** The lines in runs that share a heading, in order. */
const sections = computed(() =>
  props.lines.reduce<{ readonly group: string | null; readonly lines: readonly ComparedLine[] }[]>((runs, line) => {
    const group = line.group ?? null
    const last = runs[runs.length - 1]
    return last !== undefined && last.group === group ? [...runs.slice(0, -1), { group, lines: [...last.lines, line] }] : [...runs, { group, lines: [line] }]
  }, []),
)

/** Below md a card is too narrow for a label and four figures with cents, so each column becomes a card. */
const narrow = useMediaQuery('(max-width: 767px)')

function cellOf(line: ComparedLine, index: number): ComparedCell {
  return line.cells[index] ?? { text: '', best: false, difference: null }
}
</script>

<template>
  <div data-testid="scenario-comparison">
    <div v-if="narrow" class="flex flex-col gap-3" role="group" :aria-label="label">
      <section v-for="(column, index) in columns" :key="column.key" class="rounded-control border border-default px-3 pt-2 pb-1" :aria-label="column.label" :data-column="column.key">
        <h3 class="flex flex-wrap items-baseline gap-x-2 type-card-title">
          <slot name="column" :column="column">{{ column.label }}</slot>
          <span v-if="column.isBase" class="type-caption font-normal">{{ baseNote }}</span>
        </h3>
        <dl class="mt-1 flex flex-col">
          <template v-for="(section, at) in sections" :key="at">
            <div v-if="section.group" class="group-row -mx-3 px-3 py-1.5 text-xs">{{ section.group }}</div>
            <div
              v-for="line in section.lines"
              :key="line.key"
              class="flex items-start justify-between gap-3 border-t py-2"
              :class="line.total ? 'border-accented' : 'border-default'"
              :data-line="line.key"
            >
              <dt class="min-w-0 text-sm" :class="line.total ? 'font-medium text-highlighted' : 'text-toned'">
                {{ line.label }}
                <span v-if="line.caption && cellOf(line, index).captioned !== false" class="block type-caption">{{ line.caption }}</span>
              </dt>
              <dd class="shrink-0">
                <component
                  :is="openable ? 'button' : 'span'"
                  :type="openable ? 'button' : undefined"
                  class="text-sm"
                  :aria-label="openable ? openLabel(line.label, column.label) : undefined"
                  @click="openable && emit('open', line.key, column.key)"
                >
                  <ComparedFigure :cell="cellOf(line, index)" :total="line.total" :best-note="bestNote" />
                </component>
              </dd>
            </div>
          </template>
        </dl>
      </section>
    </div>
    <FigureTable v-else :label="label">
      <thead>
        <tr>
          <th scope="col" class="w-[30%] text-start">
            <span class="sr-only">{{ lineHeading }}</span>
          </th>
          <th v-for="column in columns" :key="column.key" scope="col" class="cell-wraps text-end align-bottom" :data-column="column.key">
            <span class="text-sm font-semibold text-highlighted"
              ><slot name="column" :column="column">{{ column.label }}</slot></span
            >
            <span v-if="column.isBase" class="block font-normal">{{ baseNote }}</span>
          </th>
        </tr>
      </thead>
      <tbody v-for="(section, at) in sections" :key="at">
        <tr v-if="section.group" class="group-row">
          <th :colspan="columns.length + 1" scope="colgroup" class="text-start">{{ section.group }}</th>
        </tr>
        <tr v-for="line in section.lines" :key="line.key" :class="{ 'total-row': line.total }" :data-line="line.key">
          <th scope="row" class="cell-wraps text-start align-top" :class="line.total ? 'font-medium text-highlighted' : 'font-normal text-toned'">
            {{ line.label }}
            <span v-if="line.caption" class="block type-caption">{{ line.caption }}</span>
          </th>
          <td v-for="(column, index) in columns" :key="column.key" class="text-end align-top">
            <slot
              name="figure"
              :line="line"
              :column="column"
              :cell="cellOf(line, index)"
              :index="index"
              :open="() => emit('open', line.key, column.key)"
              :open-label="openLabel(line.label, column.label)"
            >
              <component
                :is="openable ? 'button' : 'span'"
                :type="openable ? 'button' : undefined"
                class="inline-flex"
                :aria-label="openable ? openLabel(line.label, column.label) : undefined"
                @click="openable && emit('open', line.key, column.key)"
              >
                <ComparedFigure :cell="cellOf(line, index)" :total="line.total" :best-note="bestNote" />
              </component>
            </slot>
          </td>
        </tr>
      </tbody>
    </FigureTable>
  </div>
</template>
