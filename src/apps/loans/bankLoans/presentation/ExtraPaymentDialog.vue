<script lang="ts">
import type { ExtraPayment } from '../../workbook/domain/extraPayment'

/** What the form starts on: an extra payment to change, or the one the what-if panel worked out. */
export type ExtraPaymentStart = Pick<ExtraPayment, 'date' | 'amount' | 'effect'> & { readonly editing: ExtraPayment | null }
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { EXTRA_PAYMENT_WRITES, newExtraPayment } from '../application/bankLoanWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { EXTRA_PAYMENT_EFFECTS } from '../../workbook/domain/extraPayment'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { words as loansWords } from '../../words'
import { words } from './words'

/** Principal paid back early, and whether the bank shortens the term or lowers the instalment for it. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: BankLoanBook
  /** Null starts a blank payment. */
  start: ExtraPaymentStart | null
}>()

const writes = useRecordWrites(useLoansBooks())

const EFFECT_ITEMS = EXTRA_PAYMENT_EFFECTS.map((effect) => ({ value: effect, ...words.extraDialog.effects[effect] }))

const date = ref('')
const amount = ref('')
const effect = ref<ExtraPayment['effect']>('shorter-term')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  date.value = props.start?.date ?? ''
  amount.value = props.start === null ? '' : amountForTyping(props.start.amount)
  effect.value = props.start?.effect ?? 'shorter-term'
  tried.value = false
})

const editing = computed(() => props.start?.editing ?? null)

const parsedAmount = computed(() => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

const errors = computed(() => {
  const day = parseCivilDate(date.value)
  return {
    date: day === null ? loansWords.form.aDate(civilDate(2027, 3, 1)) : day < props.book.loan.drawdown ? words.extraDialog.afterPayout : null,
    amount: parsedAmount.value === null ? loansWords.form.anAmount : null,
  }
})

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (errors.value.date !== null || day === null || parsedAmount.value === null) return
  const typed = newExtraPayment({ loan: props.book.loan.id, date: day, amount: parsedAmount.value, effect: effect.value })
  const before = editing.value
  const written =
    before === null
      ? await writes.write(words.extraDialog.added, (unit) => unit.of(EXTRA_PAYMENT_WRITES).add(typed), { failedTitle: loansWords.form.notAdded })
      : await writes.write(words.extraDialog.saved, (unit) => unit.of(EXTRA_PAYMENT_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: loansWords.form.notSaved })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = editing.value
  if (before === null) return
  if (await writes.write(words.extraDialog.deleted, (unit) => unit.of(EXTRA_PAYMENT_WRITES).remove(before), { failedTitle: loansWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing === null ? words.extraDialog.addTitle : words.extraDialog.changeTitle" :description="words.extraDialog.description">
    <FormGrid id="extra-payment" as="form" data-testid="extra-payment-form" @submit.prevent="save">
      <UFormField :label="words.extraDialog.paidOn" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="extra-payment-date" />
      </UFormField>
      <UFormField :label="words.extraDialog.amount" :error="(tried && errors.amount) || false">
        <UInput v-model="amount" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="extra-payment-amount" />
      </UFormField>
      <URadioGroup v-model="effect" :items="EFFECT_ITEMS" :legend="words.extraDialog.effect" data-testid="extra-payment-effect" />
    </FormGrid>
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="words.extraDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="extra-payment-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="extra-payment"
        :label="editing === null ? words.extraDialog.add : words.extraDialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="extra-payment-save"
      />
    </template>
  </AppDialog>
</template>
