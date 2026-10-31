<script lang="ts">
/** Mirrors a chart's mark: a block for bars and areas, a stroke for lines, dashed for a line still to come, stripes, a ghost, an outline, or a dot on a line, filled or hollow. */
export type SwatchMark = 'bar' | 'line' | 'dashed' | 'hatched' | 'ghost' | 'outline' | 'dot' | 'ring'

export interface LegendEntry {
  readonly label: string
  /** Any CSS colour, usually a series or bucket token such as `var(--bucket-taxes)`. */
  readonly colour: string
  readonly mark?: SwatchMark
}
</script>

<script setup lang="ts">
withDefaults(
  defineProps<{
    entries: readonly LegendEntry[]
    /** Entries become buttons that show or hide their series. */
    toggleable?: boolean
    /** Labels of the entries whose series are hidden. */
    hidden?: readonly string[]
  }>(),
  { toggleable: false, hidden: () => [] },
)

const emit = defineEmits<{
  toggle: [label: string]
}>()
</script>

<template>
  <ul class="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-toned">
    <li v-for="entry in entries" :key="entry.label" class="inline-flex items-center">
      <button v-if="toggleable" type="button" class="legend-toggle inline-flex items-center gap-1.5" :aria-pressed="!hidden.includes(entry.label)" @click="emit('toggle', entry.label)">
        <span class="swatch" :class="`swatch-${entry.mark ?? 'bar'}`" :style="{ '--swatch': entry.colour }" aria-hidden="true" />
        <span>{{ entry.label }}</span>
      </button>
      <span v-else class="inline-flex items-center gap-1.5">
        <span class="swatch" :class="`swatch-${entry.mark ?? 'bar'}`" :style="{ '--swatch': entry.colour }" aria-hidden="true" />
        <span>{{ entry.label }}</span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.legend-toggle {
  margin: -0.25rem -0.375rem;
  padding: 0.25rem 0.375rem;
  border-radius: 4px;
  transition: opacity 120ms ease;
}

.legend-toggle:hover {
  color: var(--ink-strong);
}

.legend-toggle[aria-pressed='false'] {
  opacity: 0.45;
  text-decoration: line-through;
}

.legend-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 0;
}
</style>
