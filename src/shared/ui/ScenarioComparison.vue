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
  /** The one best figure of the line. */
  readonly best: boolean
  /** The difference to the base, such as "−€5.33", or null in the base's column and where nothing differs. */
  readonly difference: string | null
  /** Why the figure needs a second look, beside a warning icon. */
  readonly warning?: string | null
}

export interface ComparedLine {
  readonly key: string
  readonly label: string
  /** A note under the label, such as the date a figure is due. */
  readonly caption?: string | null
  /** The line the others add up to, set apart with a stronger rule. */
  readonly total: boolean
  /** One cell per column, in the columns' order. */
  readonly cells: readonly ComparedCell[]
}

export interface ComparedGroup {
  readonly key: string
  readonly label: string
  readonly lines: readonly ComparedLine[]
}
</script>

<script setup lang="ts">
import UIcon from '@nuxt/ui/components/Icon.vue'

import { useMediaQuery } from '../layout/viewport'
import FigureTable from './FigureTable.vue'

/**
 * Scenarios side by side, a column each, the base marked, its lines in groups. A tick marks the best
 * figure of a line, and the figure under each is its difference to the base. Below 768 px each line
 * keeps every figure: its label runs across and its figures sit two by two under it, each with its
 * column's name. With `openable`, a figure is a button that opens how it is built.
 */
const props = withDefaults(
  defineProps<{
    columns: readonly ComparedColumn[]
    groups: readonly ComparedGroup[]
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
  /** A column's name, in the table's header and beside each figure on a narrow screen. */
  column?: (scope: { column: ComparedColumn }) => unknown
}>()

/** Below md a card is too narrow for a label and four figures with cents, so each line goes two by two. */
const narrow = useMediaQuery('(max-width: 767px)')

function columnAt(index: number): ComparedColumn {
  return props.columns[index] ?? { key: String(index), label: '', isBase: false }
}
</script>

<template>
  <div data-testid="scenario-comparison">
    <div v-if="narrow" class="flex flex-col" role="group" :aria-label="label">
      <section v-for="group in groups" :key="group.key" :aria-label="group.label" class="flex flex-col">
        <h3 class="pt-3 pb-1 type-caption">{{ group.label }}</h3>
        <div v-for="line in group.lines" :key="line.key" class="border-t py-2" :class="line.total ? 'border-accented' : 'border-default'" :data-line="line.key">
          <p class="text-sm" :class="line.total ? 'font-medium text-highlighted' : 'text-toned'">{{ line.label }}</p>
          <p v-if="line.caption" class="type-caption">{{ line.caption }}</p>
          <dl class="mt-1 grid grid-cols-2 gap-x-3 gap-y-2">
            <div v-for="(cell, index) in line.cells" :key="columnAt(index).key" class="min-w-0" :data-column="columnAt(index).key">
              <dt class="text-xs font-semibold text-highlighted">
                <slot name="column" :column="columnAt(index)">{{ columnAt(index).label }}</slot>
                <span v-if="columnAt(index).isBase" class="sr-only">, {{ baseNote }}</span>
              </dt>
              <dd>
                <component
                  :is="openable ? 'button' : 'span'"
                  :type="openable ? 'button' : undefined"
                  class="flex flex-col items-start text-sm"
                  :aria-label="openable ? openLabel(line.label, columnAt(index).label) : undefined"
                  @click="openable && emit('open', line.key, columnAt(index).key)"
                >
                  <span class="inline-flex items-center gap-1" :class="cell.best || line.total ? 'font-medium text-highlighted' : 'text-toned'">
                    <UIcon v-if="cell.best" name="i-lucide-circle-check" class="size-3.5 text-success" aria-hidden="true" />
                    <span v-if="cell.best" class="sr-only">{{ bestNote }}</span>
                    <UIcon v-if="cell.warning" name="i-lucide-triangle-alert" class="size-3.5 text-warning" aria-hidden="true" />
                    <span class="figure">{{ cell.text }}</span>
                  </span>
                  <span v-if="cell.difference !== null" class="figure type-caption">{{ cell.difference }}</span>
                  <span v-if="cell.warning" class="type-caption">{{ cell.warning }}</span>
                </component>
              </dd>
            </div>
          </dl>
        </div>
      </section>
    </div>
    <FigureTable v-else :label="label">
      <thead>
        <tr>
          <th scope="col" class="w-[30%] text-start">
            <span class="sr-only">{{ lineHeading }}</span>
          </th>
          <th v-for="column in columns" :key="column.key" scope="col" class="cell-wraps text-end align-bottom">
            <span class="text-sm font-semibold text-highlighted"
              ><slot name="column" :column="column">{{ column.label }}</slot></span
            >
            <span v-if="column.isBase" class="block font-normal">{{ baseNote }}</span>
          </th>
        </tr>
      </thead>
      <tbody v-for="group in groups" :key="group.key">
        <tr>
          <th :colspan="columns.length + 1" scope="colgroup" class="pt-4 text-start type-caption">{{ group.label }}</th>
        </tr>
        <tr v-for="line in group.lines" :key="line.key" :data-line="line.key">
          <th scope="row" class="cell-wraps text-start align-top" :class="line.total ? 'font-medium text-highlighted' : 'font-normal text-toned'">
            {{ line.label }}
            <span v-if="line.caption" class="block type-caption">{{ line.caption }}</span>
          </th>
          <td v-for="(cell, index) in line.cells" :key="columnAt(index).key" class="text-end align-top">
            <component
              :is="openable ? 'button' : 'span'"
              :type="openable ? 'button' : undefined"
              class="inline-flex flex-col items-end"
              :aria-label="openable ? openLabel(line.label, columnAt(index).label) : undefined"
              @click="openable && emit('open', line.key, columnAt(index).key)"
            >
              <span class="inline-flex items-center gap-1" :class="cell.best || line.total ? 'font-medium text-highlighted' : 'text-toned'">
                <UIcon v-if="cell.best" name="i-lucide-circle-check" class="size-3.5 text-success" aria-hidden="true" />
                <span v-if="cell.best" class="sr-only">{{ bestNote }}</span>
                <UIcon v-if="cell.warning" name="i-lucide-triangle-alert" class="size-3.5 text-warning" aria-hidden="true" />
                <span class="figure">{{ cell.text }}</span>
              </span>
              <span v-if="cell.difference !== null" class="figure type-caption">{{ cell.difference }}</span>
              <span v-if="cell.warning" class="type-caption">{{ cell.warning }}</span>
            </component>
          </td>
        </tr>
      </tbody>
    </FigureTable>
  </div>
</template>
