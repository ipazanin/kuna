<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { INFORMAL_LOAN_WRITES, newInformalLoan, removeInformalLoan } from '../application/informalLoanWrites'
import { informalLoanLink, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { amountOf } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'

/** Money owed between people, with no interest and no plan: who owes whom, from when, and how much at the start. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The loan to change, or null to add one. */
  book: InformalLoanBook | null
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)
const router = useRouter()
const phone = usePhoneLayout()

const DIRECTIONS = [
  { label: 'You owe them', value: 'you-owe' },
  { label: 'They owe you', value: 'owed-to-you' },
]

const name = ref('')
const counterparty = ref('')
const direction = ref<InformalLoan['direction']>('you-owe')
const opening = ref('')
const start = ref('')
const note = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const loan = props.book?.loan ?? null
  name.value = loan?.name ?? ''
  counterparty.value = loan?.counterparty ?? ''
  direction.value = loan?.direction ?? 'you-owe'
  opening.value = loan === null ? '' : amountOf(loan.openingBalance).toFixed(2)
  start.value = loan?.start ?? ''
  note.value = loan?.note ?? ''
  tried.value = false
})

const openingBalance = computed(() => typedAmount(opening.value))

const errors = computed(() => ({
  name: name.value.trim() === '' ? 'A name, such as From Ana' : null,
  opening: openingBalance.value === null ? 'Zero or more, with at most two decimals' : null,
  start: parseCivilDate(start.value) === null ? 'A date, such as 2025-03-01' : null,
}))

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(start.value)
  if (Object.values(errors.value).some((error) => error !== null) || day === null || openingBalance.value === null) return
  const typed = newInformalLoan({ name: name.value, counterparty: counterparty.value, direction: direction.value, openingBalance: openingBalance.value, start: day, note: note.value })
  const book = props.book
  if (book === null) {
    if (await writes.write('Informal loan added', (unit) => unit.of(INFORMAL_LOAN_WRITES).add(typed), { failedTitle: 'Not added' })) {
      open.value = false
      await router.push(informalLoanLink(typed))
    }
    return
  }
  if (await writes.write('Informal loan saved', (unit) => unit.of(INFORMAL_LOAN_WRITES).change(book.loan, { ...typed, id: book.loan.id }), { failedTitle: 'Not saved' })) open.value = false
}

async function remove(): Promise<void> {
  const book = props.book
  const records = store.state.records
  if (book === null || records === null) return
  if (await writes.write('Informal loan deleted', (unit) => removeInformalLoan(unit, records, book.loan), { failedTitle: 'Not deleted' })) {
    open.value = false
    await router.push(LOANS_OVERVIEW_ROUTE)
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="book === null ? 'Add an informal loan' : 'Change the informal loan'"
    description="Money owed between people, with no interest and no plan. What was borrowed and repaid after the start goes in as movements."
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="informal-loan" class="grid gap-4 sm:grid-cols-2" data-testid="informal-loan-form" @submit.prevent="save">
        <UFormField label="Name" :error="(tried && errors.name) || false">
          <UInput v-model="name" placeholder="From Ana" class="w-full" data-testid="informal-loan-name" />
        </UFormField>
        <UFormField label="Who it is with">
          <UInput v-model="counterparty" placeholder="Ana" class="w-full" />
        </UFormField>
        <URadioGroup v-model="direction" :items="DIRECTIONS" legend="Who owes" orientation="horizontal" class="sm:col-span-2" />
        <UFormField label="Owed at the start" :error="(tried && errors.opening) || false">
          <UInput v-model="opening" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="informal-loan-opening" />
        </UFormField>
        <UFormField label="Starts on" :error="(tried && errors.start) || false">
          <UInput v-model="start" type="date" class="w-full" data-testid="informal-loan-start" />
        </UFormField>
        <UFormField label="Note" class="sm:col-span-2">
          <UInput v-model="note" class="w-full" />
        </UFormField>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="book !== null"
          label="Delete loan"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="writes.busy.value"
          data-testid="informal-loan-delete"
          @click="remove"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="informal-loan"
            :label="book === null ? 'Add loan' : 'Save loan'"
            :icon="book === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="informal-loan-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
