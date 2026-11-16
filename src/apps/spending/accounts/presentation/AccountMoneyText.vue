<script setup lang="ts">
import { computed } from 'vue'

import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import type { MoneyLook } from '../../../../shared/money/moneyFormat'
import { moneySign, moneyToneClass } from '../../../../shared/ui/moneyTone'

/** An amount in an account's own currency, as `MoneyText` shows euros. */
const props = defineProps<
  {
    cents: AccountMoney
    currency: CurrencyCode
  } & MoneyLook
>()

const formatted = computed(() => formatAccountMoney(props.cents, props.currency, moneySign(props.tone, props.sign)))
</script>

<template>
  <span class="figure whitespace-nowrap" :class="moneyToneClass(cents, tone)">{{ formatted }}</span>
</template>
