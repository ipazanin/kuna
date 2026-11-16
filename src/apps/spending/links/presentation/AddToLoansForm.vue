<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { addAndLink } from '../application/linkWithRecord'
import { addLoansMovement } from '../application/loanTargets'
import type { ShownTarget } from '../application/loanTargets'
import { movementKindsFor } from '../domain/linkTarget'
import type { InformalLoanTarget, MovementKind } from '../domain/linkTarget'
import { toastLinkedInLoans } from './linkedInLoansToasts'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { absAccountMoney } from '../../../../shared/money/accountMoney'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import { fold } from '../../../../shared/text/fold'
import { language } from '../../../../shared/text/language'

/**
 * Adds a movement to an informal loan in Loans from a saved entry and links the entry to it, with one Undo for both. The form's
 * own id lets the dialog's footer submit it, and `saving` is true while either write runs.
 */
const props = defineProps<{
  id: string
  entry: Transaction
  /** True when the entry has parts, which the link replaces with one under Loan principal. */
  split: boolean
  currency: CurrencyCode
  loans: readonly (ShownTarget & InformalLoanTarget)[]
  categories: readonly Category[]
}>()

const emit = defineEmits<{ linked: [] }>()
const saving = defineModel<boolean>('saving', { default: false })

const store = useSpendingBooks()
const toast = useToast()

/** The loan whose counterparty the payee names, or none. */
function namedLoan(): string {
  const payee = fold(props.entry.payee)
  return props.loans.find((loan) => fold(loan.counterparty) !== '' && payee.includes(fold(loan.counterparty)))?.link.key ?? ''
}

const loanKey = ref(namedLoan())
const loan = computed(() => props.loans.find((candidate) => candidate.link.key === loanKey.value) ?? null)
const kinds = computed((): readonly MovementKind[] => (loan.value === null ? [] : movementKindsFor(props.entry.amount, loan.value.direction)))
const kind = ref<MovementKind>('borrowed')
watch(
  kinds,
  (offered) => {
    if (!offered.includes(kind.value)) kind.value = offered[0] ?? 'borrowed'
  },
  { immediate: true },
)
const date = ref<string>(props.entry.date)
const amount = ref(props.currency === EURO ? amountForTyping(absAccountMoney(props.entry.amount)) : '')
const note = ref('')
const tried = ref(false)

const loanItems = computed(() => props.loans.map((candidate) => ({ label: candidate.name, value: candidate.link.key, description: candidate.counterparty })))
const kindOptions = computed(() => kinds.value.map((value) => ({ value, label: words.add.kinds[value] })))
const day = computed(() => parseCivilDate(date.value))
const typed = computed(() => {
  const cents = typedAmount(amount.value)
  return cents === null || cents <= 0 ? null : cents
})
const errors = computed(() => ({
  loan: loan.value === null ? words.add.pickLoan : null,
  date: day.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : null,
  amount: typed.value === null ? words.add.anAmount : null,
}))

async function save(): Promise<void> {
  tried.value = true
  const picked = loan.value
  const on = day.value
  const euros = typed.value
  if (picked === null || on === null || euros === null || saving.value) return
  saving.value = true
  try {
    const place = { currency: props.currency, categories: props.categories, language, notes: words.notes }
    const titles = { inLoans: words.add.inLoans, linked: words.linked }
    const movement = { day: on, kind: kind.value, amount: euros, note: note.value.trim() }
    const result = await addAndLink(store, props.entry, () => addLoansMovement(picked, movement, titles.inLoans), place, titles)
    if (toastLinkedInLoans(toast, result, words.add)) emit('linked')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <FormGrid :id="id" as="form" data-testid="spending-add-to-loans" @submit.prevent="save">
    <p v-if="split" class="type-caption" data-testid="spending-add-to-loans-replaces">{{ words.replacesParts }}</p>
    <UFormField :label="words.add.loan" :error="(tried && errors.loan) || false" class="sm:col-span-2">
      <USelect v-model="loanKey" :items="loanItems" :placeholder="words.add.pickLoan" class="w-full" data-testid="spending-add-to-loans-loan" />
    </UFormField>
    <UFormField v-if="kindOptions.length > 1" :label="words.add.kind" class="sm:col-span-2">
      <ChoiceButtons v-model="kind" :options="kindOptions" :label="words.add.kind" data-testid="spending-add-to-loans-kind" />
    </UFormField>
    <UFormField :label="words.add.amount" :error="(tried && errors.amount) || false">
      <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-add-to-loans-amount" />
    </UFormField>
    <UFormField :label="spendingWords.form.date" :error="(tried && errors.date) || false">
      <DayField v-model="date" class="w-full" data-testid="spending-add-to-loans-date" />
    </UFormField>
    <UFormField :label="spendingWords.form.note" class="sm:col-span-2">
      <UInput v-model="note" class="w-full" data-testid="spending-add-to-loans-note" />
    </UFormField>
  </FormGrid>
</template>
