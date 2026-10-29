<script lang="ts">
import type { SwatchMark } from './ChartLegend.vue'

export interface Fact {
  readonly label: string
  readonly value: string
  readonly caption?: string
  /** A key beside the label, in any CSS colour, when the fact names a part of a chart or a meter. */
  readonly swatch?: { readonly colour: string; readonly mark?: SwatchMark }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'

/** Labelled figures two to a row, and all in one row once the space around them fits them. */
const props = defineProps<{
  facts: readonly Fact[]
}>()

const columns = computed(() => (props.facts.length >= 4 ? '@lg:grid-cols-4' : props.facts.length === 3 ? '@sm:grid-cols-3' : ''))
</script>

<template>
  <div class="@container">
    <dl class="grid grid-cols-2 gap-x-4 gap-y-3" :class="columns">
      <div v-for="fact in facts" :key="fact.label" class="min-w-0">
        <dt class="flex items-center gap-1.5 type-caption">
          <span v-if="fact.swatch" class="swatch" :class="`swatch-${fact.swatch.mark ?? 'bar'}`" :style="{ '--swatch': fact.swatch.colour }" aria-hidden="true" />
          {{ fact.label }}
        </dt>
        <dd class="mt-0.5 type-figure-secondary">{{ fact.value }}</dd>
        <dd v-if="fact.caption" class="mt-0.5 type-caption">{{ fact.caption }}</dd>
      </div>
    </dl>
  </div>
</template>
