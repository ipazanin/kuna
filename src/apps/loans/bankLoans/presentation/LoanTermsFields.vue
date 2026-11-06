<script lang="ts">
import type { BankLoan, InterimInterest, LoanTerms } from '../../workbook/domain/bankLoan'
import { MOST_INSTALMENTS } from '../../workbook/domain/bankLoanReading'
import { civilDate, parseCivilDate } from '../../../../shared/calendar/civilDate'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { typedCount } from '../../../../shared/text/typedCount'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
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
  repayment: BankLoan['repayment']
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
    repayment: terms?.repayment ?? 'annuity',
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
    instalments: instalments === null ? words.loanDialog.instalmentsError : instalments > MOST_INSTALMENTS ? words.loanDialog.tooMany(MOST_INSTALMENTS) : null,
    interim: interim === undefined ? words.loanDialog.interimError : null,
  }
  const valid = Object.values(errors).every((error) => error === null)
  return {
    terms:
      valid && principal !== null && drawdown !== null && firstInstalment !== null && instalments !== null && interim !== undefined
        ? { lender: texts.lender, principal, drawdown, firstInstalment, instalments, interimInterest: interim, repayment: texts.repayment }
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
import RepaymentChoice from './RepaymentChoice.vue'
import { useLoanWords } from './useLoanWords'

/** What a bank loan's plan cannot do without: the amount, how it is repaid, the instalments and the two days. */
const texts = defineModel<LoanTermsTexts>({ required: true })
const loanWords = useLoanWords()

defineProps<{
  /** Whether to show the fields' errors, which wait for the first try to save. */
  tried: boolean
}>()

const errors = computed(() => typedLoanTerms(texts.value).errors)
</script>

<template>
  <UFormField :label="loanWords.loanDialog.principal" :error="(tried && errors.principal) || false" :help="loanWords.loanDialog.principalHelp">
    <MoneyInput v-model="texts.principal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="bank-loan-principal" />
  </UFormField>
  <RepaymentChoice v-model="texts.repayment" class="sm:col-span-2" data-testid="bank-loan-repayment" />
  <UFormField :label="loanWords.loanDialog.instalments" :error="(tried && errors.instalments) || false" :help="loanWords.loanDialog.instalmentsHelp">
    <UInput v-model="texts.instalments" inputmode="numeric" class="w-full" data-testid="bank-loan-instalments" />
  </UFormField>
  <UFormField :label="loanWords.loanDialog.drawdown" :error="(tried && errors.drawdown) || false" :help="loanWords.loanDialog.drawdownHelp">
    <UInput v-model="texts.drawdown" type="date" class="w-full" data-testid="bank-loan-drawdown" />
  </UFormField>
  <UFormField :label="loanWords.loanDialog.firstInstalment" :error="(tried && errors.firstInstalment) || false" :help="loanWords.loanDialog.firstInstalmentHelp">
    <UInput v-model="texts.firstInstalment" type="date" class="w-full" data-testid="bank-loan-first-instalment" />
  </UFormField>
</template>
