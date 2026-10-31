<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import CurrencyField from '../../holdings/presentation/CurrencyField.vue'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import AccountField from './AccountField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** A deposit, withdrawal, fee or fee refund: its account, day, currency and amount. */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
</script>

<template>
  <AccountField v-model="texts.account" :label="words.fields.account" :error="shown('account')" :book="book" test-id="transaction-account" />
  <UFormField :label="words.fields.date" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <CurrencyField v-model="texts.currency" :book="book" :label="words.fields.currency" :error="shown('currency')" test-id="transaction-currency" />
  <UFormField :label="words.fields.amount" :error="shown('amount')">
    <MoneyInput v-model="texts.amount" class="w-full" data-testid="transaction-amount" />
  </UFormField>
</template>
