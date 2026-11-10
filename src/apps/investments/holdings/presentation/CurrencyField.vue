<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import CurrencySelect from '../../../../shared/ui/CurrencySelect.vue'

/** A currency picked by its code, with the euro and those the file already names first. */
const currency = defineModel<string>({ required: true })

const props = withDefaults(
  defineProps<{
    label: string
    help?: string
    error: string | false
    book: InvestmentBook
    testId: string
  }>(),
  { help: '' },
)

const named = computed(() => {
  const { book } = props
  return [
    EURO,
    ...book.instruments.map((instrument) => instrument.currency),
    ...book.income.map((payment) => payment.currency),
    ...book.cashMovements.map((movement) => movement.currency),
    ...book.exchanges.flatMap((exchange) => [exchange.soldCurrency, exchange.boughtCurrency]),
  ]
})
</script>

<template>
  <UFormField :label="label" :help="help" :error="error">
    <CurrencySelect v-model="currency" :first="named" :search="words.findCurrency" class="w-full" :data-testid="testId" />
  </UFormField>
</template>
