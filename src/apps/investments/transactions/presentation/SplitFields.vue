<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import InstrumentField from './InstrumentField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'

/** A split of a holding: new units for old ones, both whole numbers, from a day on. */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
</script>

<template>
  <InstrumentField v-model="texts.instrument" :label="words.fields.holding" :error="shown('instrument')" :book="book" test-id="transaction-instrument" />
  <UFormField :label="words.fields.newUnits" :help="words.fields.splitHelp" :error="shown('newUnits')">
    <UInput v-model="texts.newUnits" inputmode="numeric" class="w-full" data-testid="transaction-new-units" />
  </UFormField>
  <UFormField :label="words.fields.oldUnits" :error="shown('oldUnits')">
    <UInput v-model="texts.oldUnits" inputmode="numeric" class="w-full" data-testid="transaction-old-units" />
  </UFormField>
  <UFormField :label="words.fields.date" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
</template>
