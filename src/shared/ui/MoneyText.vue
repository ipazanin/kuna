<script setup lang="ts">
import { computed } from 'vue'

import { formatCompactEuros, formatEuros, formatWholeEuros } from '../money/euroFormat'
import type { SignDisplay } from '../money/euroFormat'

const props = withDefaults(
  defineProps<{
    cents: number
    /** `magnitude` drops the sign, for costs that read positive. `always` adds a plus, for changes. */
    sign?: SignDisplay
    precision?: 'cents' | 'whole' | 'compact'
    /** Colours the figure by its sign: income and gains green, losses red. */
    toned?: boolean
  }>(),
  { sign: 'negative', precision: 'cents', toned: false },
)

const formatted = computed(() => {
  if (props.precision === 'whole') return formatWholeEuros(props.cents, props.sign)
  if (props.precision === 'compact') return formatCompactEuros(props.cents, props.sign)
  return formatEuros(props.cents, props.sign)
})

const tone = computed(() => {
  if (!props.toned || props.cents === 0) return ''
  return props.cents > 0 ? 'text-positive' : 'text-negative'
})
</script>

<template>
  <span class="figure whitespace-nowrap" :class="tone">{{ formatted }}</span>
</template>
