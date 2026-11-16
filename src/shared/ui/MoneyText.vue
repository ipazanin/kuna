<script setup lang="ts">
import { computed } from 'vue'

import type { Money } from '../money/money'
import { formatCompactMoney, formatMoney } from '../money/moneyFormat'
import type { MoneyFormat, MoneyLook } from '../money/moneyFormat'
import { moneySign, moneyToneClass } from './moneyTone'

/**
 * `tone` says what kind of figure the amount is and decides its colour and sign. An amount in ink takes `sign`
 * instead, such as `magnitude` for a cost that reads positive.
 */
const props = withDefaults(
  defineProps<
    {
      cents: Money
      precision?: 'cents' | 'compact'
      /** The app's currency and number locale, for a figure shown outside its app, as on the home. Left out, the page's. */
      format?: MoneyFormat
    } & MoneyLook
  >(),
  { precision: 'cents' },
)

const formatted = computed(() => {
  const sign = moneySign(props.tone, props.sign)
  if (props.precision === 'compact') return formatCompactMoney(props.cents, sign, props.format)
  return formatMoney(props.cents, sign, props.format)
})
</script>

<template>
  <span class="figure whitespace-nowrap" :class="moneyToneClass(cents, tone)">{{ formatted }}</span>
</template>
