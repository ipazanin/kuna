<script lang="ts">
import type { InterimInterest, LoanTerms } from '../../workbook/domain/bankLoan'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from './typedCount'
import { words as loansWords } from '../../words'
import { words } from './words'

/** The terms a bank loan shares with an offer, as typed. */
export interface LoanTermsTexts {
  lender: string
  principal: string
  drawdown: string
  firstInstalment: string
  instalments: string
  interimAmount: string
  interimDate: string
}

const EXAMPLE_DRAWDOWN = civilDate(2025, 8, 12)
const EXAMPLE_FIRST_INSTALMENT = civilDate(2025, 9, 20)

export function loanTermsTexts(terms: LoanTerms | null): LoanTermsTexts {
  return {
    lender: terms?.lender ?? '',
    principal: terms === null ? '' : plainAmount(terms.principal),
    drawdown: terms?.drawdown ?? '',
    firstInstalment: terms?.firstInstalment ?? '',
    instalments: terms === null ? '' : String(terms.instalments),
    interimAmount: terms?.interimInterest ? plainAmount(terms.interimInterest.amount) : '',
    interimDate: terms?.interimInterest?.date ?? '',
  }
}

export type LoanTermsErrors = Readonly<Record<'principal' | 'drawdown' | 'firstInstalment' | 'instalments' | 'interim', string | null>>

/** The terms the fields give, the subsidy left to its own fields, or null while one is wrong, with why each is. */
export function typedLoanTerms(texts: LoanTermsTexts): { readonly terms: Omit<LoanTerms, 'subsidy'> | null; readonly instalments: number | null; readonly errors: LoanTermsErrors } {
  const amount = typedAmount(texts.principal)
  const principal = amount !== null && amount > 0 ? amount : null
  const drawdown = parseCivilDate(texts.drawdown)
  const firstInstalment = parseCivilDate(texts.firstInstalment)
  const instalments = typedCount(texts.instalments)
  const interestAmount = typedAmount(texts.interimAmount)
  const interestDate = parseCivilDate(texts.interimDate)
  const interim: InterimInterest | null | undefined =
    texts.interimAmount.trim() === '' && texts.interimDate === ''
      ? null
      : interestAmount === null || interestAmount <= 0 || interestDate === null
        ? undefined
        : { amount: interestAmount, date: interestDate }
  const errors: LoanTermsErrors = {
    principal: principal === null ? loansWords.form.anAmount : null,
    drawdown: drawdown === null ? loansWords.form.aDate(EXAMPLE_DRAWDOWN) : null,
    firstInstalment: firstInstalment === null ? loansWords.form.aDate(EXAMPLE_FIRST_INSTALMENT) : drawdown !== null && firstInstalment <= drawdown ? words.loanDialog.afterDrawdown : null,
    instalments: instalments === null ? words.loanDialog.instalmentsError : instalments > 600 ? words.loanDialog.tooMany : null,
    interim: interim === undefined ? words.loanDialog.interimError : null,
  }
  const valid = Object.values(errors).every((error) => error === null)
  return {
    terms:
      valid && principal !== null && drawdown !== null && firstInstalment !== null && instalments !== null && interim !== undefined
        ? { lender: texts.lender, principal, drawdown, firstInstalment, instalments, interimInterest: interim }
        : null,
    instalments,
    errors,
  }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

/** The lender, amount, payout, instalments and interest before the first instalment, which a bank loan and an offer share. */
const texts = defineModel<LoanTermsTexts>({ required: true })

const props = withDefaults(
  defineProps<{
    /** Whether to show the fields' errors, which wait for the first try to save. */
    tried: boolean
    /** What the fields' test ids start with. */
    testPrefix?: string
  }>(),
  { testPrefix: 'bank-loan' },
)

const errors = computed(() => typedLoanTerms(texts.value).errors)
const testId = (field: string): string => `${props.testPrefix}-${field}`
</script>

<template>
  <UFormField :label="words.loanDialog.lender">
    <UInput v-model="texts.lender" :placeholder="words.loanDialog.lenderPlaceholder" class="w-full" :data-testid="testId('lender')" />
  </UFormField>
  <UFormField :label="words.loanDialog.principal" :error="(tried && errors.principal) || false">
    <UInput v-model="texts.principal" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" :data-testid="testId('principal')" />
  </UFormField>
  <UFormField :label="words.loanDialog.instalments" :error="(tried && errors.instalments) || false" :help="words.loanDialog.instalmentsHelp">
    <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" :data-testid="testId('instalments')" />
  </UFormField>
  <UFormField :label="words.loanDialog.drawdown" :error="(tried && errors.drawdown) || false">
    <UInput v-model="texts.drawdown" type="date" class="w-full" :data-testid="testId('drawdown')" />
  </UFormField>
  <UFormField :label="words.loanDialog.firstInstalment" :error="(tried && errors.firstInstalment) || false" :help="words.loanDialog.firstInstalmentHelp">
    <UInput v-model="texts.firstInstalment" type="date" class="w-full" :data-testid="testId('first-instalment')" />
  </UFormField>
  <UFormField :label="words.loanDialog.interim" :error="(tried && errors.interim) || false" :help="words.loanDialog.interimHelp">
    <UInput v-model="texts.interimAmount" inputmode="decimal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" />
  </UFormField>
  <UFormField :label="words.loanDialog.interimDate">
    <UInput v-model="texts.interimDate" type="date" class="w-full" />
  </UFormField>
</template>
