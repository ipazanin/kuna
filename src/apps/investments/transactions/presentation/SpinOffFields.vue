<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import InstrumentField from './InstrumentField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'

/** Units of a new holding received for holding another, with the share of that holding's cost that moves to them. */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
</script>

<template>
  <InstrumentField v-model="texts.instrument" :label="words.fields.parent" :error="shown('instrument')" :book="book" test-id="transaction-instrument" />
  <InstrumentField v-model="texts.received" :label="words.fields.received" :error="shown('received')" :book="book" test-id="transaction-received" />
  <UFormField :label="words.fields.date" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <UFormField :label="words.fields.receivedUnits" :error="shown('quantity')">
    <UInput v-model="texts.quantity" inputmode="decimal" class="w-full" data-testid="transaction-quantity" />
  </UFormField>
  <UFormField :label="words.fields.costShare" :help="words.fields.costShareHelp" :error="shown('costShare')">
    <UInput v-model="texts.costShare" inputmode="decimal" class="w-full" data-testid="transaction-cost-share" />
  </UFormField>
</template>
