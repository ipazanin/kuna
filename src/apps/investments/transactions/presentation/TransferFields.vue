<script setup lang="ts">
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import CurrencyField from '../../holdings/presentation/CurrencyField.vue'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import AccountField from './AccountField.vue'
import InstrumentField from './InstrumentField.vue'
import type { TransactionErrors, TransactionTexts } from './transactionForm'
import { words } from './words'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** Units of a holding or cash moved from one of the user's accounts to another. */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const MOVES = [
  { value: 'units' as const, label: words.fields.movesUnits },
  { value: 'cash' as const, label: words.fields.movesCash },
]

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
</script>

<template>
  <UFormField :label="words.fields.moves" class="sm:col-span-2">
    <ChoiceButtons v-model="texts.moves" :options="MOVES" :label="words.fields.moves" data-testid="transaction-moves" />
  </UFormField>
  <AccountField v-model="texts.account" :label="words.fields.from" :error="shown('account')" :book="book" test-id="transaction-account" />
  <AccountField v-model="texts.toAccount" :label="words.fields.to" :error="shown('toAccount')" :book="book" test-id="transaction-to-account" />
  <InstrumentField v-if="texts.moves === 'units'" v-model="texts.instrument" :label="words.fields.holding" :error="shown('instrument')" :book="book" test-id="transaction-instrument" />
  <UFormField :label="words.fields.date" :error="shown('date')">
    <UInput v-model="texts.date" type="date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <UFormField v-if="texts.moves === 'units'" :label="words.fields.units" :help="words.fields.unitsHelp" :error="shown('quantity')">
    <UInput v-model="texts.quantity" inputmode="decimal" class="w-full" data-testid="transaction-quantity" />
  </UFormField>
  <template v-else>
    <CurrencyField v-model="texts.currency" :book="book" :label="words.fields.currency" :error="shown('currency')" test-id="transaction-currency" />
    <UFormField :label="words.fields.amount" :error="shown('amount')">
      <MoneyInput v-model="texts.amount" class="w-full" data-testid="transaction-amount" />
    </UFormField>
  </template>
</template>
