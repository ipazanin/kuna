<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import InstrumentField from './InstrumentField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'

/** A close entered by hand: the holding, its day and its price in the holding's currency. */
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
  <UFormField :label="words.fields.date" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <UFormField :label="words.fields.price" :help="words.fields.priceIn(currency)" :error="shown('price')">
    <UInput v-model="texts.price" inputmode="decimal" class="w-full" data-testid="transaction-price" />
  </UFormField>
</template>
