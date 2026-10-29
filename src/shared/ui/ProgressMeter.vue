<script lang="ts">
export interface MeterPart {
  readonly value: number
  /** Any CSS colour, usually a token such as `var(--loan-principal)`. */
  readonly colour: string
  /** Stripes over the colour, for a part someone else pays. */
  readonly striped?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

/** A bar split into parts in proportion to their values, read out as its label since a meter element cannot draw parts. */
const props = withDefaults(
  defineProps<{
    parts: readonly MeterPart[]
    /** What the bar shows in words, such as "14% of €180,000.00 paid back". */
    label: string
    height?: number
  }>(),
  { height: 6 },
)

const shown = computed(() => props.parts.filter((part) => part.value > 0))
</script>

<template>
  <div role="img" :aria-label="label" class="flex gap-0.5 overflow-hidden rounded-full" :style="{ height: `${height}px` }">
    <span v-for="(part, index) in shown" :key="index" class="meter-part" :class="{ striped: part.striped }" :style="{ flexGrow: part.value, '--part': part.colour }" />
  </div>
</template>

<style scoped>
.meter-part {
  flex-basis: 0;
  min-width: 3px;
  background: var(--part);
}

.meter-part.striped {
  background: repeating-linear-gradient(45deg, var(--chart-hatch) 0 2px, transparent 2px 5px), var(--part);
}
</style>
