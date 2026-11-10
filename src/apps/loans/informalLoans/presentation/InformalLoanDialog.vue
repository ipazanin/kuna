<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { INFORMAL_LOAN_WRITES, newInformalLoan, removeInformalLoan } from '../application/informalLoanWrites'
import { informalLoanLink, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import { checkedExpectedPlan } from '../domain/expectedPlan'
import type { InformalLoan } from '../../workbook/domain/informalLoan'
import type { InformalLoanBook } from '../../workbook/domain/readLoanBook'
import { civilDate, dayOfMonth, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { words as loansWords } from '../../words'
import { words } from './words'

/** Money owed between people, with no interest: who owes whom, from when, how much at the start, and what the borrower means to repay each month. */
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
const planned = ref(false)
const planMonthly = ref('')
const planFrom = ref('')
const planDay = ref('')
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
  const expected = loan?.expected ?? null
  planned.value = expected !== null
  planMonthly.value = expected === null ? '' : plainAmount(expected.monthly)
  planFrom.value = expected?.from ?? ''
  planDay.value = expected === null ? '' : String(expected.day)
  tried.value = false
})

watch(planFrom, (from) => {
  const day = parseCivilDate(from)
  if (day !== null && planDay.value === '') planDay.value = String(dayOfMonth(day))
})

const openingBalance = computed(() => typedAmount(opening.value))
const startDay = computed(() => parseCivilDate(start.value))

const plan = computed(() => {
  const { expected, faults } = checkedExpectedPlan(typedAmount(planMonthly.value), parseCivilDate(planFrom.value), typedCount(planDay.value), startDay.value)
  const errors = {
    monthly: faults.monthly ? loansWords.form.anAmount : null,
    from: faults.from ? words.loanDialog.planFromError : null,
    day: faults.day ? words.loanDialog.planDayError : null,
  }
  return { expected, errors }
})

const errors = computed(() => ({
  name: name.value.trim() === '' ? words.loanDialog.nameError : null,
  opening: openingBalance.value === null ? words.loanDialog.openingError : null,
  start: startDay.value === null ? loansWords.form.aDate(civilDate(2025, 3, 1)) : null,
  ...(planned.value ? plan.value.errors : {}),
}))

async function save(): Promise<void> {
  tried.value = true
  const day = startDay.value
  if (Object.values(errors.value).some((error) => error !== null) || day === null || openingBalance.value === null) return
  const typed = newInformalLoan({
    name: name.value,
    counterparty: counterparty.value,
    direction: direction.value,
    openingBalance: openingBalance.value,
    start: day,
    note: note.value,
    expected: planned.value ? plan.value.expected : null,
  })
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
  if (await writes.write(words.loanDialog.deleted, (unit) => removeInformalLoan(unit, records, book.loan), { key: 'delete', failedTitle: loansWords.form.notDeleted })) {
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
      <USwitch v-model="planned" :label="words.loanDialog.planSwitch" :description="words.loanDialog.planSwitchHelp" class="sm:col-span-2" data-testid="informal-loan-planned" />
      <template v-if="planned">
        <UFormField :label="words.loanDialog.planMonthly" :error="(tried && errors.monthly) || false">
          <MoneyInput v-model="planMonthly" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="informal-loan-plan-monthly" />
        </UFormField>
        <UFormField :label="words.loanDialog.planFrom" :error="(tried && errors.from) || false" :help="words.loanDialog.planFromHelp">
          <UInput v-model="planFrom" type="date" class="w-full" data-testid="informal-loan-plan-from" />
        </UFormField>
        <UFormField :label="words.loanDialog.planDay" :error="(tried && errors.day) || false" :help="words.loanDialog.planDayHelp">
          <UInput v-model="planDay" inputmode="numeric" class="w-full" data-testid="informal-loan-plan-day" />
        </UFormField>
      </template>
    </FormGrid>
    <template #start>
      <UButton
        v-if="book !== null"
        :label="words.loanDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="informal-loan-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="informal-loan"
        :label="book === null ? words.loanDialog.add : words.loanDialog.save"
        :icon="book === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value"
        data-testid="informal-loan-save"
      />
    </template>
  </AppDialog>
</template>
