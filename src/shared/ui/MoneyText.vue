<script setup lang="ts">
import { computed } from 'vue'

import { formatCompactMoney, formatMoney } from '../money/moneyFormat'
import type { MoneyFormat, SignDisplay } from '../money/moneyFormat'

const props = withDefaults(
  defineProps<{
    cents: number
    /** `magnitude` drops the sign, for costs that read positive. `always` adds a plus, for changes. */
    sign?: SignDisplay
    precision?: 'cents' | 'compact'
    /**
     * `flow` colours money coming in and leaves money going out in the normal ink, since a cost is
     * not bad news. `outcome` is for a result such as a net, where a negative one is a loss.
     */
    tone?: 'flow' | 'outcome'
    /** The app's currency and number locale, for a figure shown outside its app, as on the home. Left out, the page's. */
    format?: MoneyFormat
  }>(),
  { sign: 'negative', precision: 'cents' },
)

const formatted = computed(() => {
  if (props.precision === 'compact') return formatCompactMoney(props.cents, props.sign, props.format)
  return formatMoney(props.cents, props.sign, props.format)
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
