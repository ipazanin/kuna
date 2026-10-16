<script setup lang="ts">
import { computed } from 'vue'

import { formatCompactMoney, formatMoney, formatWholeMoney } from '../money/moneyFormat'
import type { SignDisplay } from '../money/moneyFormat'

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
  if (props.precision === 'whole') return formatWholeMoney(props.cents, props.sign)
  if (props.precision === 'compact') return formatCompactMoney(props.cents, props.sign)
  return formatMoney(props.cents, props.sign)
})

const tone = computed(() => {
  if (!props.toned || props.cents === 0) return ''
  return props.cents > 0 ? 'text-positive' : 'text-negative'
})
</script>

<template>
  <span class="figure whitespace-nowrap" :class="tone">{{ formatted }}</span>
</template>
