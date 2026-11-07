<script setup lang="ts">
import { computed } from 'vue'

import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import type { MoneyTone, SignDisplay } from '../../../../shared/money/moneyFormat'
import { moneyToneClass } from '../../../../shared/ui/moneyTone'

/** An amount in an account's own currency, as `MoneyText` shows euros. */
const props = withDefaults(
  defineProps<{
    cents: AccountMoney
    currency: CurrencyCode
    sign?: SignDisplay | undefined
    tone?: MoneyTone | undefined
  }>(),
  { sign: 'negative' },
)

const formatted = computed(() => formatAccountMoney(props.cents, props.currency, props.sign))
</script>

<template>
  <span class="figure whitespace-nowrap" :class="moneyToneClass(cents, tone)">{{ formatted }}</span>
</template>
