<script setup lang="ts">
import { computed, ref } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { addAndLink } from '../application/linkWithRecord'
import type { LinkStep } from '../application/linkWithRecord'
import { addLoansExtraPayment } from '../application/loanTargets'
import type { ShownInstalment } from '../application/linkReview'
import type { ExtraPaymentOffer } from '../domain/instalmentOffers'
import type { ExtraPaymentEffect, ExtraPaymentTarget } from '../domain/linkTarget'
import { toastAddedAndLinked } from './addedAndLinkedToasts'
import { instalmentText, words } from './words'
import { linkEntry, linkWithExtraPayment } from '../../entries/application/entryWrites'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import { language } from '../../../../shared/text/language'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/**
 * Records a row of a euro account as an extra payment of the loan whose instalment the offer names, with one Undo for both
 * writes. A row that is all extra payment files whole under Loan principal linked to it. A row that pays the instalment too
 * splits into the instalment's interest and principal linked to it, the extra payment linked to the new one, and whatever the
 * amount typed leaves over. The day starts as the row's, and the amount as what the row pays beyond the instalment. The form's
 * own id lets the dialog's footer submit it, and `saving` is true while either write runs.
 */
const props = defineProps<{
  id: string
  offer: ExtraPaymentOffer<ShownInstalment>
}>()

const emit = defineEmits<{ recorded: [] }>()
const saving = defineModel<boolean>('saving', { default: false })

const store = useSpendingBooks()
const toast = useToast()

const effect = ref<ExtraPaymentEffect>('shorter-term')
const date = ref<string>(props.offer.row.date)
const amount = ref(amountForTyping(props.offer.extra))
const tried = ref(false)

const effectOptions = computed(() => (['shorter-term', 'lower-instalment'] as const).map((value) => ({ value, label: words.extra.effects[value] })))
const day = computed(() => parseCivilDate(date.value))
const typed = computed(() => {
  const cents = typedAmount(amount.value)
  return cents === null || cents <= 0 ? null : cents
})
const errors = computed(() => ({
  date: day.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : null,
  amount: typed.value === null ? words.add.anAmount : null,
}))

async function save(): Promise<void> {
  tried.value = true
  const on = day.value
  const euros = typed.value
  const book = store.state.workbook
  if (on === null || euros === null || book === null || saving.value) return
  saving.value = true
  try {
    const place = { currency: EURO, categories: book.categories, language, notes: words.notes }
    const titles = { added: words.extra.inLoans, linked: words.linked }
    const payment = { day: on, amount: euros, effect: effect.value }
    const { row, instalment, withInstalment } = props.offer
    const link: LinkStep<ExtraPaymentTarget> = withInstalment ? (unit, records, entry, extra, at) => linkWithExtraPayment(unit, records, entry, instalment, extra, at) : linkEntry
    const result = await addAndLink(store, row, () => addLoansExtraPayment(instalment, payment, titles.added), place, titles, link)
    if (toastAddedAndLinked(toast, result, words.extra)) emit('recorded')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormGrid :id="id" as="form" data-testid="spending-extra-payment" @submit.prevent="save">
    <p v-if="offer.withInstalment" class="type-body sm:col-span-2" data-testid="spending-extra-payment-instalment">
      {{ words.extra.instalmentToo(instalmentText(offer.instalment), formatMoney(offer.instalment.youPay)) }}
    </p>
    <UFormField :label="words.extra.effect" class="sm:col-span-2">
      <ChoiceButtons v-model="effect" :options="effectOptions" :label="words.extra.effect" data-testid="spending-extra-payment-effect" />
    </UFormField>
    <UFormField :label="words.add.amount" :error="(tried && errors.amount) || false">
      <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-extra-payment-amount" />
    </UFormField>
    <UFormField :label="spendingWords.form.date" :error="(tried && errors.date) || false">
      <DayField v-model="date" class="w-full" data-testid="spending-extra-payment-date" />
    </UFormField>
  </FormGrid>
</template>
