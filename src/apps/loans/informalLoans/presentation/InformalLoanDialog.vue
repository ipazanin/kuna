<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'

import { INFORMAL_LOAN_WRITES, newInformalLoan, removeInformalLoan } from '../application/informalLoanWrites'
import { informalLoanLink, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as loansWords } from '../../words'
import { words } from './words'

/** Money owed between people, with no interest and no plan: who owes whom, from when, and how much at the start. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The loan to change, or null to add one. */
  book: InformalLoanBook | null
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)
const router = useRouter()

const DIRECTIONS = [
  { label: words.loanDialog.youOweThem, value: 'you-owe' },
  { label: words.loanDialog.theyOweYou, value: 'owed-to-you' },
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
  opening.value = loan === null ? '' : plainAmount(loan.openingBalance)
  start.value = loan?.start ?? ''
  note.value = loan?.note ?? ''
  tried.value = false
})

const openingBalance = computed(() => typedAmount(opening.value))

const errors = computed(() => ({
  name: name.value.trim() === '' ? words.loanDialog.nameError : null,
  opening: openingBalance.value === null ? words.loanDialog.openingError : null,
  start: parseCivilDate(start.value) === null ? loansWords.form.aDate(civilDate(2025, 3, 1)) : null,
}))

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(start.value)
  if (Object.values(errors.value).some((error) => error !== null) || day === null || openingBalance.value === null) return
  const typed = newInformalLoan({ name: name.value, counterparty: counterparty.value, direction: direction.value, openingBalance: openingBalance.value, start: day, note: note.value })
  const book = props.book
  if (book === null) {
    if (await writes.write(words.loanDialog.added, (unit) => unit.of(INFORMAL_LOAN_WRITES).add(typed), { failedTitle: loansWords.form.notAdded })) {
      open.value = false
      await router.push(informalLoanLink(typed))
    }
    return
  }
  if (await writes.write(words.loanDialog.saved, (unit) => unit.of(INFORMAL_LOAN_WRITES).change(book.loan, { ...typed, id: book.loan.id }), { failedTitle: loansWords.form.notSaved }))
    open.value = false
}

async function remove(): Promise<void> {
  const book = props.book
  const records = store.state.records
  if (book === null || records === null) return
  if (await writes.write(words.loanDialog.deleted, (unit) => removeInformalLoan(unit, records, book.loan), { failedTitle: loansWords.form.notDeleted })) {
    open.value = false
    await router.push(LOANS_OVERVIEW_ROUTE)
  }
}
</script>

<template>
  <AppDialog v-model:open="open" :title="book === null ? words.loanDialog.addTitle : words.loanDialog.changeTitle" :description="words.loanDialog.description">
    <FormGrid id="informal-loan" as="form" data-testid="informal-loan-form" @submit.prevent="save">
      <UFormField :label="words.loanDialog.name" :error="(tried && errors.name) || false">
        <UInput v-model="name" :placeholder="words.loanDialog.namePlaceholder" class="w-full" data-testid="informal-loan-name" />
      </UFormField>
      <UFormField :label="words.loanDialog.counterparty">
        <UInput v-model="counterparty" :placeholder="words.loanDialog.counterpartyPlaceholder" class="w-full" />
      </UFormField>
      <URadioGroup v-model="direction" :items="DIRECTIONS" :legend="words.loanDialog.whoOwes" orientation="horizontal" />
      <UFormField :label="words.loanDialog.opening" :error="(tried && errors.opening) || false">
        <MoneyInput v-model="opening" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="informal-loan-opening" />
      </UFormField>
      <UFormField :label="words.loanDialog.start" :error="(tried && errors.start) || false">
        <UInput v-model="start" type="date" class="w-full" data-testid="informal-loan-start" />
      </UFormField>
      <UFormField :label="loansWords.form.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="book !== null"
        :label="words.loanDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="informal-loan-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="informal-loan"
        :label="book === null ? words.loanDialog.add : words.loanDialog.save"
        :icon="book === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="informal-loan-save"
      />
    </template>
  </AppDialog>
</template>
