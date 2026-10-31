<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import { words } from './words'
import { CURRENCY_CODES, EURO } from '../../../../shared/money/currencyCode'

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

const items = computed(() => {
  const { book } = props
  const named = new Set<string>([
    EURO,
    ...book.instruments.map((instrument) => instrument.currency),
    ...book.income.map((payment) => payment.currency),
    ...book.cashMovements.map((movement) => movement.currency),
    ...book.exchanges.flatMap((exchange) => [exchange.soldCurrency, exchange.boughtCurrency]),
  ])
  return [...named, ...CURRENCY_CODES.filter((code) => !named.has(code))]
})
</script>

<template>
  <UFormField :label="label" :help="help" :error="error">
    <USelectMenu v-model="currency" :items="items" :search-input="{ placeholder: words.findCurrency }" class="w-full" :data-testid="testId" />
  </UFormField>
</template>
