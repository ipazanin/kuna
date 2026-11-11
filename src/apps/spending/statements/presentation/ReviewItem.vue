<script setup lang="ts">
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'

/** One row of a To review card: what it is, its day and account, and its amount, with any details under the words and the actions it offers underneath. */
defineProps<{
  title: string
  caption: string
  cents: AccountMoney
  currency: CurrencyCode
}>()
defineSlots<{ details?: () => unknown; default?: () => unknown }>()
</script>

<template>
  <li class="flex flex-col gap-2 px-4 py-3 sm:px-5">
    <div class="flex items-start gap-3">
      <span class="flex min-w-0 flex-1 flex-col gap-0.5">
        <span class="break-words text-sm text-highlighted">{{ title }}</span>
        <span class="break-words type-caption">{{ caption }}</span>
        <slot name="details" />
      </span>
      <AccountMoneyText :cents="cents" :currency="currency" sign="always" tone="flow" class="shrink-0 text-sm" />
    </div>
    <slot />
  </li>
</template>
