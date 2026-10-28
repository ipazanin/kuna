<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { BANK_LOAN_WRITES, RATE_PERIOD_WRITES, newBankLoan, newRatePeriod, removeBankLoan } from '../application/bankLoanWrites'
import { bankLoanLink, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { BankLoan, InterimInterest } from '../../workbook/domain/bankLoan'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../../shared/layout/viewport'
import { amountOf } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import RateFields, { rateError, typedRate } from './RateFields.vue'
import type { RateTexts } from './RateFields.vue'
import SubsidyFields, { subsidyTexts, typedSubsidy } from './SubsidyFields.vue'
import type { SubsidyTexts } from './SubsidyFields.vue'
import { typedCount } from './typedCount'

/**
 * Adds a bank loan with its first rate period and its subsidy in one write, or changes its terms.
 * A changed first instalment moves the first rate period along, since a loan's rate starts there.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The loan to change, or null to add one. */
  book: BankLoanBook | null
}>()

const store = useLoansBooks()
const writes = useRecordWrites(store)
const router = useRouter()
const phone = usePhoneLayout()

const name = ref('')
const lender = ref('')
const principal = ref('')
const drawdown = ref('')
const firstInstalment = ref('')
const instalments = ref('')
const interimAmount = ref('')
const interimDate = ref('')
const note = ref('')
const rate = ref<RateTexts>({ rate: '', rateType: 'fixed', note: '' })
const subsidised = ref(false)
const subsidy = ref<SubsidyTexts>(subsidyTexts(null))
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const loan = props.book?.loan ?? null
  name.value = loan?.name ?? ''
  lender.value = loan?.lender ?? ''
  principal.value = loan === null ? '' : amountOf(loan.principal).toFixed(2)
  drawdown.value = loan?.drawdown ?? ''
  firstInstalment.value = loan?.firstInstalment ?? ''
  instalments.value = loan === null ? '' : String(loan.instalments)
  interimAmount.value = loan?.interimInterest ? amountOf(loan.interimInterest.amount).toFixed(2) : ''
  interimDate.value = loan?.interimInterest?.date ?? ''
  note.value = loan?.note ?? ''
  rate.value = { rate: '', rateType: 'fixed', note: '' }
  subsidised.value = false
  subsidy.value = subsidyTexts(null)
  tried.value = false
})

const typed = computed(() => {
  const amount = typedAmount(principal.value)
  const interest = typedAmount(interimAmount.value)
  return {
    principal: amount !== null && amount > 0 ? amount : null,
    drawdown: parseCivilDate(drawdown.value),
    firstInstalment: parseCivilDate(firstInstalment.value),
    instalments: typedCount(instalments.value),
    interimAmount: interest !== null && interest > 0 ? interest : null,
    interimDate: parseCivilDate(interimDate.value),
  }
})

const interim = computed((): InterimInterest | null | undefined => {
  const { interimAmount: amount, interimDate: date } = typed.value
  if (interimAmount.value.trim() === '' && interimDate.value === '') return null
  return amount === null || date === null ? undefined : { amount, date }
})

const errors = computed(() => {
  const { drawdown: drawn, firstInstalment: first, instalments: count } = typed.value
  return {
    name: name.value.trim() === '' ? 'A name, such as Home loan' : null,
    principal: typed.value.principal === null ? 'An amount above zero with at most two decimals' : null,
    drawdown: drawn === null ? 'A date, such as 2025-08-12' : null,
    firstInstalment: first === null ? 'A date, such as 2025-09-20' : drawn !== null && first <= drawn ? 'After the drawdown' : null,
    instalments: count === null ? 'A whole number above zero, such as 240' : count > 600 ? 'At most 600' : null,
    interim: interim.value === undefined ? 'Both the amount and its date, or neither' : null,
    rate: props.book === null ? rateError(rate.value) : null,
    subsidy: props.book === null && subsidised.value && typedSubsidy(subsidy.value, count).subsidy === null ? 'Fill in the subsidy' : null,
  }
})

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

/** The loan as the fields give it, or null while a field is wrong. */
function typedTerms(): Omit<BankLoan, 'id'> | null {
  const { principal: amount, drawdown: drawn, firstInstalment: first, instalments: count } = typed.value
  if (!valid.value || amount === null || drawn === null || first === null || count === null || interim.value === undefined) return null
  return {
    name: name.value,
    lender: lender.value,
    principal: amount,
    drawdown: drawn,
    firstInstalment: first,
    instalments: count,
    interimInterest: interim.value,
    subsidy: props.book === null ? (subsidised.value ? typedSubsidy(subsidy.value, count).subsidy : null) : props.book.loan.subsidy,
    note: note.value,
  }
}

async function save(): Promise<void> {
  tried.value = true
  const terms = typedTerms()
  if (terms === null) return
  const book = props.book
  if (book === null) {
    const yearly = typedRate(rate.value.rate)
    if (yearly === null) return
    const loan = newBankLoan(terms)
    const period = newRatePeriod({ loan: loan.id, from: loan.firstInstalment, rate: yearly, rateType: rate.value.rateType, note: rate.value.note })
    const added = await writes.write(
      'Bank loan added',
      (unit) => {
        unit.of(BANK_LOAN_WRITES).add(loan)
        unit.of(RATE_PERIOD_WRITES).add(period)
      },
      { failedTitle: 'Not added' },
    )
    if (added) {
      open.value = false
      await router.push(bankLoanLink(loan))
    }
    return
  }
  const after: BankLoan = { ...newBankLoan(terms), id: book.loan.id }
  const firstPeriod = book.ratePeriods.find((period) => period.from === book.loan.firstInstalment) ?? null
  const saved = await writes.write(
    'Bank loan saved',
    (unit) => {
      unit.of(BANK_LOAN_WRITES).change(book.loan, after)
      if (firstPeriod !== null && after.firstInstalment !== book.loan.firstInstalment) unit.of(RATE_PERIOD_WRITES).change(firstPeriod, { ...firstPeriod, from: after.firstInstalment })
    },
    { failedTitle: 'Not saved' },
  )
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const book = props.book
  const records = store.state.records
  if (book === null || records === null) return
  const removed = await writes.write('Bank loan deleted', (unit) => removeBankLoan(unit, records, book.loan), { failedTitle: 'Not deleted' })
  if (removed) {
    open.value = false
    await router.push(LOANS_OVERVIEW_ROUTE)
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="book === null ? 'Add a bank loan' : 'Change the bank loan'"
    :description="book === null ? 'Its terms as the contract gives them. Kuna works out the plan from them.' : 'Its terms. Rate periods, the subsidy and extra payments change on the loan\'s page.'"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="bank-loan" class="grid gap-4 sm:grid-cols-2" data-testid="bank-loan-form" @submit.prevent="save">
        <UFormField label="Name" :error="(tried && errors.name) || false">
          <UInput v-model="name" placeholder="Home loan" class="w-full" data-testid="bank-loan-name" />
        </UFormField>
        <UFormField label="Lender">
          <UInput v-model="lender" placeholder="The bank" class="w-full" />
        </UFormField>
        <UFormField label="Amount borrowed" :error="(tried && errors.principal) || false">
          <UInput v-model="principal" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="bank-loan-principal" />
        </UFormField>
        <UFormField label="Monthly instalments" :error="(tried && errors.instalments) || false" help="240 for 20 years.">
          <UInput v-model="instalments" inputmode="numeric" class="w-full" data-testid="bank-loan-instalments" />
        </UFormField>
        <UFormField label="Paid out on" :error="(tried && errors.drawdown) || false">
          <UInput v-model="drawdown" type="date" class="w-full" data-testid="bank-loan-drawdown" />
        </UFormField>
        <UFormField label="First instalment" :error="(tried && errors.firstInstalment) || false" help="Every instalment falls on this day of the month.">
          <UInput v-model="firstInstalment" type="date" class="w-full" data-testid="bank-loan-first-instalment" />
        </UFormField>
        <UFormField label="Interest before the first instalment" :error="(tried && errors.interim) || false" help="What the bank charged from the payout, if it did.">
          <UInput v-model="interimAmount" inputmode="decimal" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField label="Charged on">
          <UInput v-model="interimDate" type="date" class="w-full" />
        </UFormField>
        <template v-if="book === null">
          <p class="text-sm font-medium text-highlighted sm:col-span-2">The rate from the first instalment</p>
          <RateFields v-model="rate" :tried="tried" />
          <USwitch v-model="subsidised" label="A subsidy pays part of each instalment" description="Such as APN's, for a set number of instalments." class="sm:col-span-2" data-testid="bank-loan-subsidised" />
          <SubsidyFields v-if="subsidised" v-model="subsidy" :tried="tried" :loan-instalments="typed.instalments" />
        </template>
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
          data-testid="bank-loan-delete"
          @click="remove"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="bank-loan"
            :label="book === null ? 'Add loan' : 'Save loan'"
            :icon="book === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="bank-loan-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
