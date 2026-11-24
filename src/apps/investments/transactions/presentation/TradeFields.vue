<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import AccountField from './AccountField.vue'
import InstrumentField from './InstrumentField.vue'
import { brokerWorthCheck } from '../domain/transactionDraft'
import type { TransactionTexts } from '../domain/transactionDraft'
import type { TransactionErrors } from './words'
import { words } from './words'
import { EURO } from '../../../../shared/money/currencyCode'
import { amountShown } from '../../../../shared/money/amountTyping'
import { decimalText } from '../../../../shared/money/decimal'
import DayField from '../../../../shared/ui/DayField.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'

/**
 * A buy's or a sale's holding, account, day, units, price, fees and the worth the broker booked, each amount in the
 * holding's currency. Fees and the worth keep every decimal a broker gives. The worth stays folded under a link beneath
 * the price until it is set, since most brokers book units × price to the cent.
 */
const texts = defineModel<TransactionTexts>({ required: true })

const props = defineProps<{
  book: InvestmentBook
  errors: TransactionErrors
  tried: boolean
}>()

const shown = (field: keyof TransactionTexts): string | false => (props.tried && props.errors[field]) || false
const worthOpened = ref(false)
const worthShown = computed(() => worthOpened.value || texts.value.brokerWorth.trim() !== '' || shown('brokerWorth') !== false)
const worthInput = useTemplateRef<{ inputRef: HTMLInputElement | null }>('worthInput')
const currency = computed(() => props.book.instruments.find((instrument) => instrument.id === texts.value.instrument)?.currency ?? EURO)
const worthCheck = computed(() => brokerWorthCheck(texts.value, props.book))

async function openWorth(): Promise<void> {
  worthOpened.value = true
  await nextTick()
  worthInput.value?.inputRef?.focus()
}
</script>

<template>
  <InstrumentField v-model="texts.instrument" :label="words.fields.holding" :error="shown('instrument')" :book="book" test-id="transaction-instrument" />
  <AccountField v-model="texts.account" :label="words.fields.account" :error="shown('account')" :book="book" test-id="transaction-account" />
  <UFormField :label="words.fields.tradeDate" :error="shown('date')">
    <DayField v-model="texts.date" class="w-full" data-testid="transaction-date" />
  </UFormField>
  <UFormField :label="words.fields.units" :help="words.fields.unitsHelp" :error="shown('quantity')">
    <UInput v-model="texts.quantity" inputmode="decimal" class="w-full" data-testid="transaction-quantity" />
  </UFormField>
  <UFormField :label="words.fields.pricePerUnit" :help="words.fields.priceIn(currency)" :error="shown('price')" :ui="{ container: 'flex flex-col' }">
    <UInput v-model="texts.price" inputmode="decimal" class="w-full" data-testid="transaction-price" />
    <UButton
      v-if="!worthShown"
      :label="words.fields.brokerWorthShow"
      icon="i-lucide-plus"
      color="neutral"
      variant="link"
      size="sm"
      class="inline-target quiet-link order-last mt-1 self-start px-0"
      data-testid="transaction-broker-worth-show"
      @click="openWorth"
    />
  </UFormField>
  <UFormField :label="words.fields.fees" :help="words.fields.feesHelp(currency)" :error="shown('fees')">
    <UInput v-model="texts.fees" inputmode="decimal" class="w-full" data-testid="transaction-fees" />
  </UFormField>
  <UFormField
    v-if="worthShown"
    :label="words.fields.brokerWorth"
    :help="words.fields.brokerWorthHelp(currency, worthCheck.booked === null ? null : amountShown(decimalText(worthCheck.booked)))"
    :error="shown('brokerWorth')"
    :ui="{ container: 'flex flex-col gap-1' }"
  >
    <UInput ref="worthInput" v-model="texts.brokerWorth" inputmode="decimal" class="w-full" data-testid="transaction-broker-worth" />
    <NoteLine v-if="worthCheck.farOff" tone="warning" data-testid="transaction-broker-worth-far-off">{{ words.fields.brokerWorthFarOff }}</NoteLine>
  </UFormField>
</template>
