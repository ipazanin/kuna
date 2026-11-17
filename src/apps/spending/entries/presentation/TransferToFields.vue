<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { words } from './words'
import type { Account } from '../../workbook/domain/account'
import { words as spendingWords } from '../../words'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** The To side of a transfer: the account the money went to, and what reached it when that differs from what left. */
const toAccount = defineModel<string>('toAccount', { required: true })
const toAmount = defineModel<string>('toAmount', { required: true })
const lessArrived = defineModel<boolean>('lessArrived', { required: true })

const props = defineProps<{
  items: readonly { label: string; value: string; description: string }[]
  /** The account picked as To, or null while none is. */
  to: Account | null
  twoCurrencies: boolean
  /** The account the fee row goes on when less arrives in one currency, or null when the bank fills both sides. */
  feeOn: Account | null
  /** What did not arrive, once both amounts are typed. */
  fee: AccountMoney | null
  /** The bank fixed the To account, or the amount and day of the row on it. */
  toFixed: boolean
  toBooked: boolean
  errors: { readonly toAccount: string | null; readonly toAmount: string | null }
  tried: boolean
}>()

const feeHelp = computed(() => (props.fee === null || props.feeOn === null ? words.dialog.arrivedHelp : words.dialog.feeHelp(formatAccountMoney(props.fee, props.feeOn.currency), props.feeOn.name)))
</script>

<template>
  <UFormField :label="words.dialog.toAccount" :error="(tried && errors.toAccount) || false">
    <USelect v-model="toAccount" :items="[...items]" :disabled="toFixed" class="w-full" data-testid="spending-entry-to-account" />
  </UFormField>
  <UFormField v-if="twoCurrencies" :label="words.dialog.amountIn(to?.currency ?? '')" :help="words.dialog.arrivedHelp" :error="(tried && errors.toAmount) || false">
    <MoneyInput v-model="toAmount" :placeholder="spendingWords.form.amountPlaceholder" :disabled="toBooked" class="w-full" data-testid="spending-entry-to-amount" />
  </UFormField>
  <template v-else-if="feeOn !== null">
    <UFormField :label="words.dialog.lessArrived">
      <USwitch v-model="lessArrived" :label="words.dialog.feeTaken" data-testid="spending-entry-less-arrived" />
    </UFormField>
    <UFormField v-if="lessArrived" :label="words.dialog.arrivedIn(to?.currency ?? '')" :help="feeHelp" :error="(tried && errors.toAmount) || false">
      <MoneyInput v-model="toAmount" :placeholder="spendingWords.form.amountPlaceholder" :disabled="toBooked" class="w-full" data-testid="spending-entry-to-amount" />
    </UFormField>
  </template>
</template>
