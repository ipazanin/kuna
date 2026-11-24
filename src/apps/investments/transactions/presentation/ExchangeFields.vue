<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import CurrencyField from '../../holdings/presentation/CurrencyField.vue'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import AccountField from './AccountField.vue'
import type { TransactionTexts } from '../domain/transactionDraft'
import type { TransactionErrors } from './words'
import { words } from './words'
import DayField from '../../../../shared/ui/DayField.vue'

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
    <DayField v-model="texts.date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <UFormField :label="words.fields.sold" :help="words.fields.soldHelp" :error="shown('amount')">
    <UInput v-model="texts.amount" inputmode="decimal" class="w-full" data-testid="transaction-amount" />
  </UFormField>
  <CurrencyField v-model="texts.currency" :book="book" :label="words.fields.soldCurrency" :error="shown('currency')" test-id="transaction-currency" />
  <UFormField :label="words.fields.bought" :help="words.fields.boughtHelp" :error="shown('bought')">
    <UInput v-model="texts.bought" inputmode="decimal" class="w-full" data-testid="transaction-bought" />
  </UFormField>
  <CurrencyField v-model="texts.boughtCurrency" :book="book" :label="words.fields.boughtCurrency" :error="shown('boughtCurrency')" test-id="transaction-bought-currency" />
  <UFormField :label="words.fields.exchangeFees" :help="words.fields.exchangeFeesHelp" :error="shown('fees')">
    <UInput v-model="texts.fees" inputmode="decimal" class="w-full" data-testid="transaction-fees" />
  </UFormField>
  <CurrencyField v-model="texts.feeCurrency" :book="book" :label="words.fields.feeCurrency" :error="shown('feeCurrency')" test-id="transaction-fee-currency" />
</template>
