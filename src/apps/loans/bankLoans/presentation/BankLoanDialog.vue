<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { BANK_LOAN_WRITES, RATE_PERIOD_WRITES, newBankLoan, newRatePeriod, removeBankLoan } from '../application/bankLoanWrites'
import { typedRate } from '../domain/yearlyRate'
import { bankLoanLink, LOANS_OVERVIEW_ROUTE } from '../../overview/presentation/loanLinks'
import { useLoansBooks } from '../../workbook/application/loansStore'
import type { BankLoan, InterimInterest } from '../../workbook/domain/bankLoan'
import type { BankLoanBook } from '../../workbook/domain/readLoanBook'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import RateFields, { rateError } from './RateFields.vue'
import type { RateTexts } from './RateFields.vue'
import SubsidyFields, { subsidyTexts, typedSubsidy } from './SubsidyFields.vue'
import type { SubsidyTexts } from './SubsidyFields.vue'
import { typedCount } from './typedCount'
import { words as loansWords } from '../../words'
import { words } from './words'

/**
 * Adds a bank loan with its first rate period and its subsidy in one write, or changes its terms.
 * A changed first instalment moves the first rate period along, since a loan's rate starts there.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The loan to change, or null to add one. */
  book: BankLoanBook | null
}>()

const EXAMPLE_DRAWDOWN = civilDate(2025, 8, 12)
const EXAMPLE_FIRST_INSTALMENT = civilDate(2025, 9, 20)

const store = useLoansBooks()
const writes = useRecordWrites(store)
const router = useRouter()

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
  principal.value = loan === null ? '' : plainAmount(loan.principal)
  drawdown.value = loan?.drawdown ?? ''
  firstInstalment.value = loan?.firstInstalment ?? ''
  instalments.value = loan === null ? '' : String(loan.instalments)
  interimAmount.value = loan?.interimInterest ? plainAmount(loan.interimInterest.amount) : ''
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
    name: name.value.trim() === '' ? words.loanDialog.nameError : null,
    principal: typed.value.principal === null ? loansWords.form.anAmount : null,
    drawdown: drawn === null ? loansWords.form.aDate(EXAMPLE_DRAWDOWN) : null,
    firstInstalment: first === null ? loansWords.form.aDate(EXAMPLE_FIRST_INSTALMENT) : drawn !== null && first <= drawn ? words.loanDialog.afterDrawdown : null,
    instalments: count === null ? words.loanDialog.instalmentsError : count > 600 ? words.loanDialog.tooMany : null,
    interim: interim.value === undefined ? words.loanDialog.interimError : null,
    rate: props.book === null ? rateError(rate.value) : null,
    subsidy: props.book === null && subsidised.value && typedSubsidy(subsidy.value, count).subsidy === null ? words.loanDialog.subsidyError : null,
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
      words.loanDialog.added,
      (unit) => {
        unit.of(BANK_LOAN_WRITES).add(loan)
        unit.of(RATE_PERIOD_WRITES).add(period)
      },
      { failedTitle: loansWords.form.notAdded },
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
    words.loanDialog.saved,
    (unit) => {
      unit.of(BANK_LOAN_WRITES).change(book.loan, after)
      if (firstPeriod !== null && after.firstInstalment !== book.loan.firstInstalment) unit.of(RATE_PERIOD_WRITES).change(firstPeriod, { ...firstPeriod, from: after.firstInstalment })
    },
    { failedTitle: loansWords.form.notSaved },
  )
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const book = props.book
  const records = store.state.records
  if (book === null || records === null) return
  const removed = await writes.write(words.loanDialog.deleted, (unit) => removeBankLoan(unit, records, book.loan), { failedTitle: loansWords.form.notDeleted })
  if (removed) {
    open.value = false
    await router.push(LOANS_OVERVIEW_ROUTE)
  }
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="book === null ? words.loanDialog.addTitle : words.loanDialog.changeTitle"
    :description="book === null ? words.loanDialog.addDescription : words.loanDialog.changeDescription"
  >
    <FormGrid id="bank-loan" as="form" data-testid="bank-loan-form" @submit.prevent="save">
      <UFormField :label="words.loanDialog.name" :error="(tried && errors.name) || false">
        <UInput v-model="name" :placeholder="words.loanDialog.namePlaceholder" class="w-full" data-testid="bank-loan-name" />
      </UFormField>
      <UFormField :label="words.loanDialog.lender">
        <UInput v-model="lender" :placeholder="words.loanDialog.lenderPlaceholder" class="w-full" />
      </UFormField>
      <UFormField :label="words.loanDialog.principal" :error="(tried && errors.principal) || false">
        <UInput v-model="principal" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="bank-loan-principal" />
      </UFormField>
      <UFormField :label="words.loanDialog.instalments" :error="(tried && errors.instalments) || false" :help="words.loanDialog.instalmentsHelp">
        <UInput v-model="instalments" inputmode="numeric" class="w-full" data-testid="bank-loan-instalments" />
      </UFormField>
      <UFormField :label="words.loanDialog.drawdown" :error="(tried && errors.drawdown) || false">
        <UInput v-model="drawdown" type="date" class="w-full" data-testid="bank-loan-drawdown" />
      </UFormField>
      <UFormField :label="words.loanDialog.firstInstalment" :error="(tried && errors.firstInstalment) || false" :help="words.loanDialog.firstInstalmentHelp">
        <UInput v-model="firstInstalment" type="date" class="w-full" data-testid="bank-loan-first-instalment" />
      </UFormField>
      <UFormField :label="words.loanDialog.interim" :error="(tried && errors.interim) || false" :help="words.loanDialog.interimHelp">
        <UInput v-model="interimAmount" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
      </UFormField>
      <UFormField :label="words.loanDialog.interimDate">
        <UInput v-model="interimDate" type="date" class="w-full" />
      </UFormField>
      <template v-if="book === null">
        <p class="text-sm font-medium text-highlighted">{{ words.loanDialog.firstRate }}</p>
        <RateFields v-model="rate" :tried="tried" />
        <USwitch v-model="subsidised" :label="words.loanDialog.subsidised" :description="words.loanDialog.subsidisedHelp" data-testid="bank-loan-subsidised" />
        <SubsidyFields v-if="subsidised" v-model="subsidy" :tried="tried" :loan-instalments="typed.instalments" />
      </template>
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
        data-testid="bank-loan-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="loansWords.form.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="bank-loan"
        :label="book === null ? words.loanDialog.add : words.loanDialog.save"
        :icon="book === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="bank-loan-save"
      />
    </template>
  </AppDialog>
</template>
