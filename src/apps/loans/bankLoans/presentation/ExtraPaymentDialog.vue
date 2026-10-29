<script lang="ts">
import type { ExtraPayment } from '../../workbook/domain/extraPayment'

/** What the form starts on: an extra payment to change, or the one the what-if panel worked out. */
export type ExtraPaymentStart = Pick<ExtraPayment, 'date' | 'amount' | 'effect'> & { readonly editing: ExtraPayment | null }

export const EFFECT_ITEMS = [
  { label: 'Shorter term', value: 'shorter-term', description: 'Keep the instalment and finish sooner.' },
  { label: 'Lower instalment', value: 'lower-instalment', description: 'Keep the end and pay less each month.' },
]
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { EXTRA_PAYMENT_WRITES, newExtraPayment } from '../application/bankLoanWrites'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { amountOf } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** Principal paid back early, and whether the bank shortens the term or lowers the instalment for it. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: BankLoanBook
  /** Null starts a blank payment. */
  start: ExtraPaymentStart | null
}>()

const writes = useRecordWrites(useLoansBooks())

const date = ref('')
const amount = ref('')
const effect = ref<ExtraPayment['effect']>('shorter-term')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  date.value = props.start?.date ?? ''
  amount.value = props.start === null ? '' : amountOf(props.start.amount).toFixed(2)
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
    date: day === null ? 'A date, such as 2027-03-01' : day < props.book.loan.drawdown ? 'On or after the payout' : null,
    amount: parsedAmount.value === null ? 'An amount above zero with at most two decimals' : null,
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
      ? await writes.write('Extra payment added', (unit) => unit.of(EXTRA_PAYMENT_WRITES).add(typed), { failedTitle: 'Not added' })
      : await writes.write('Extra payment saved', (unit) => unit.of(EXTRA_PAYMENT_WRITES).change(before, { ...typed, id: before.id }), { failedTitle: 'Not saved' })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = editing.value
  if (before === null) return
  if (await writes.write('Extra payment deleted', (unit) => unit.of(EXTRA_PAYMENT_WRITES).remove(before), { failedTitle: 'Not deleted' })) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="editing === null ? 'Add an extra payment' : 'Change the extra payment'"
    description="Principal paid back on top of the instalments. A housing loan charges no fee for it."
  >
    <FormGrid id="extra-payment" as="form" data-testid="extra-payment-form" @submit.prevent="save">
      <UFormField label="Paid on" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="extra-payment-date" />
      </UFormField>
      <UFormField label="Amount" :error="(tried && errors.amount) || false">
        <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="extra-payment-amount" />
      </UFormField>
      <URadioGroup v-model="effect" :items="EFFECT_ITEMS" legend="What the bank does" data-testid="extra-payment-effect" />
    </FormGrid>
    <template #start>
      <UButton v-if="editing !== null" label="Delete payment" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="extra-payment-delete" @click="remove" />
    </template>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="extra-payment"
        :label="editing === null ? 'Add payment' : 'Save payment'"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="extra-payment-save"
      />
    </template>
  </AppDialog>
</template>
