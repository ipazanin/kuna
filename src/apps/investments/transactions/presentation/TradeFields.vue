<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import AccountField from './AccountField.vue'
import InstrumentField from './InstrumentField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** A buy's or a sale's holding, account, day, units, price and fees, the price and fees in the holding's currency. */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
const currency = computed(() => props.book.instruments.find((instrument) => instrument.id === texts.value.instrument)?.currency ?? EURO)
</script>

<template>
  <InstrumentField v-model="texts.instrument" :label="words.fields.holding" :error="shown('instrument')" :book="book" test-id="transaction-instrument" />
  <AccountField v-model="texts.account" :label="words.fields.account" :error="shown('account')" :book="book" test-id="transaction-account" />
  <UFormField :label="words.fields.tradeDate" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <UFormField :label="words.fields.units" :help="words.fields.unitsHelp" :error="shown('quantity')">
    <UInput v-model="texts.quantity" inputmode="decimal" class="w-full" data-testid="transaction-quantity" />
  </UFormField>
  <UFormField :label="words.fields.pricePerUnit" :help="words.fields.priceIn(currency)" :error="shown('price')">
    <UInput v-model="texts.price" inputmode="decimal" class="w-full" data-testid="transaction-price" />
  </UFormField>
  <UFormField :label="words.fields.fees" :help="words.fields.feesHelp(currency)" :error="shown('fees')">
    <MoneyInput v-model="texts.fees" class="w-full" data-testid="transaction-fees" />
  </UFormField>
</template>
