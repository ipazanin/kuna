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
    /**
     * `flow` colours money coming in and leaves money going out in the normal ink, since a cost is
     * not bad news. `outcome` is for a result such as a net, where a negative one is a loss.
     */
    tone?: 'flow' | 'outcome'
  }>(),
  { sign: 'negative', precision: 'cents' },
)

const formatted = computed(() => {
  if (props.precision === 'whole') return formatWholeMoney(props.cents, props.sign)
  if (props.precision === 'compact') return formatCompactMoney(props.cents, props.sign)
  return formatMoney(props.cents, props.sign)
})

const tone = computed(() => {
  if (props.tone === undefined || props.cents === 0) return ''
  if (props.cents > 0) return 'text-success'
  return props.tone === 'outcome' ? 'text-error' : ''
})
</script>

<template>
  <span class="figure whitespace-nowrap" :class="tone">{{ formatted }}</span>
</template>
