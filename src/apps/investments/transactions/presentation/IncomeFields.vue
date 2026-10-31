<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { INCOME_KINDS } from '../../workbook/domain/income'
import CurrencyField from '../../holdings/presentation/CurrencyField.vue'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words as recordWords } from '../../workbook/domain/words'
import AccountField from './AccountField.vue'
import InstrumentField from './InstrumentField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** A dividend, coupon, interest or other income: its holding where it has one, account, day, currency, gross and the tax withheld. */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const KIND_ITEMS = INCOME_KINDS.map((value) => ({ value, label: recordWords.incomeKinds[value] }))

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
</script>

<template>
  <InstrumentField
    v-model="texts.instrument"
    :label="words.fields.holding"
    :error="shown('instrument')"
    :book="book"
    :optional="texts.incomeKind !== 'dividend' && texts.incomeKind !== 'coupon'"
    test-id="transaction-instrument"
  />
  <UFormField :label="words.fields.incomeKind">
    <USelect v-model="texts.incomeKind" :items="KIND_ITEMS" class="w-full" data-testid="transaction-income-kind" />
  </UFormField>
  <AccountField v-model="texts.account" :label="words.fields.account" :error="shown('account')" :book="book" test-id="transaction-account" />
  <UFormField :label="words.fields.date" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <CurrencyField v-model="texts.currency" :book="book" :label="words.fields.currency" :error="shown('currency')" test-id="transaction-currency" />
  <p v-if="texts.reverses" class="type-caption sm:col-span-2" data-testid="transaction-reverses">{{ words.fields.reverses }}</p>
  <UFormField :label="words.fields.gross" :help="words.fields.grossHelp" :error="shown('amount')">
    <MoneyInput v-model="texts.amount" class="w-full" data-testid="transaction-amount" />
  </UFormField>
  <UFormField :label="words.fields.withheld" :help="words.fields.withheldHelp" :error="shown('withheld')">
    <MoneyInput v-model="texts.withheld" class="w-full" data-testid="transaction-withheld" />
  </UFormField>
</template>
