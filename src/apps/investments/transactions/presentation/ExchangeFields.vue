<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import CurrencyField from '../../holdings/presentation/CurrencyField.vue'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import AccountField from './AccountField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** Cash of one currency changed into another in an account, each amount as booked, with the fees it charged. */
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
  <UFormField :label="words.fields.sold" :help="words.fields.soldHelp" :error="shown('amount')">
    <MoneyInput v-model="texts.amount" class="w-full" data-testid="transaction-amount" />
  </UFormField>
  <CurrencyField v-model="texts.currency" :book="book" :label="words.fields.soldCurrency" :error="shown('currency')" test-id="transaction-currency" />
  <UFormField :label="words.fields.bought" :help="words.fields.boughtHelp" :error="shown('bought')">
    <MoneyInput v-model="texts.bought" class="w-full" data-testid="transaction-bought" />
  </UFormField>
  <CurrencyField v-model="texts.boughtCurrency" :book="book" :label="words.fields.boughtCurrency" :error="shown('boughtCurrency')" test-id="transaction-bought-currency" />
  <UFormField :label="words.fields.exchangeFees" :help="words.fields.exchangeFeesHelp" :error="shown('fees')">
    <MoneyInput v-model="texts.fees" class="w-full" data-testid="transaction-fees" />
  </UFormField>
  <CurrencyField v-model="texts.feeCurrency" :book="book" :label="words.fields.feeCurrency" :error="shown('feeCurrency')" test-id="transaction-fee-currency" />
</template>
