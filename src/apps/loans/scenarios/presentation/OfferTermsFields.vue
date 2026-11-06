<script lang="ts">
import { costTexts, typedCosts } from './changeTexts'
import { words } from './words'
import type { CostTexts } from './changeTexts'
import type { LoanChange, OfferTerms } from '../domain/loanScenario'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import { typedLoanTerms } from '../../bankLoans/presentation/LoanTermsFields.vue'
import type { LoanTermsErrors } from '../../bankLoans/presentation/LoanTermsFields.vue'
import { subsidyTexts, typedSubsidy } from '../../bankLoans/presentation/SubsidyFields.vue'
import type { SubsidyTexts } from '../../bankLoans/presentation/SubsidyFields.vue'
import { typedTerm } from '../../bankLoans/presentation/typedTerm'
import { words as bankWords } from '../../bankLoans/presentation/words'
import type { BankLoan } from '../../workbook/domain/bankLoan'
import type { RatePeriod } from '../../workbook/domain/ratePeriod'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayMonthsLater } from '../../../../shared/calendar/monthKey'
import { plainAmount } from '../../../../shared/money/money'
import { typedCount } from '../../../../shared/text/typedCount'

type RateChange = Extract<LoanChange, { kind: 'rate-change' }>

/** An offer as typed: the amount, rate, term and repayment up front, and the rest, which changes nothing until filled. */
export interface OfferTexts {
  principal: string
  rate: string
  /** The first rate's kind, kept from a saved offer, fixed for a new one. */
  rateType: RatePeriod['rateType']
  years: string
  months: string
  repayment: BankLoan['repayment']
  name: string
  lender: string
  payout: string
  /** Blank for a month after the payout. */
  firstInstalment: string
  interimAmount: string
  interimDate: string
  fixedYears: string
  thenVariable: string
  subsidised: boolean
  subsidy: SubsidyTexts
  costs: CostTexts
  bankEks: string
}

/** Where a fixed rate gives way to a variable one, counted in whole years from the first instalment. */
function variableAfter(firstInstalment: CivilDate, years: number): CivilDate {
  return dayMonthsLater(firstInstalment, 12 * years)
}

/**
 * The fields for a saved offer, or a new one paid out today, with the changes the fields do not hold:
 * every change but the first rate and a variable rate from a whole year on after a fixed one.
 */
export function offerTexts(name: string, terms: OfferTerms | null, changes: readonly LoanChange[], today: CivilDate): { readonly texts: OfferTexts; readonly later: readonly LoanChange[] } {
  const rates = changes.filter((change): change is RateChange => change.kind === 'rate-change')
  const first = terms === null ? undefined : rates.find((change) => change.from === terms.firstInstalment)
  const yearsFixed =
    terms === null || first === undefined || first.rateType !== 'fixed'
      ? []
      : rates.flatMap((change) => {
          if (change === first || change.rateType !== 'variable') return []
          const years = Math.floor(terms.instalments / 12)
          const whole = Array.from({ length: years }, (_, index) => index + 1).find((count) => variableAfter(terms.firstInstalment, count) === change.from)
          return whole === undefined || whole * 12 >= terms.instalments ? [] : [{ change, years: whole }]
        })
  const variable = yearsFixed[0] ?? null
  const payout = terms?.drawdown ?? today
  return {
    texts: {
      principal: terms === null ? '' : plainAmount(terms.principal),
      rate: first === undefined ? '' : rateText(first.rate),
      rateType: first?.rateType ?? 'fixed',
      years: terms === null ? '' : String(Math.floor(terms.instalments / 12)),
      months: terms === null ? '' : String(terms.instalments % 12),
      repayment: terms?.repayment ?? 'annuity',
      name,
      lender: terms?.lender ?? '',
      payout,
      firstInstalment: terms === null || terms.firstInstalment === dayMonthsLater(payout, 1) ? '' : terms.firstInstalment,
      interimAmount: terms?.interimInterest ? plainAmount(terms.interimInterest.amount) : '',
      interimDate: terms?.interimInterest?.date ?? '',
      fixedYears: variable === null ? '' : String(variable.years),
      thenVariable: variable === null ? '' : rateText(variable.change.rate),
      subsidised: (terms?.subsidy ?? null) !== null,
      subsidy: subsidyTexts(terms?.subsidy ?? null),
      costs: costTexts(terms?.costs ?? null),
      bankEks: terms === null || terms.bankEks === null ? '' : rateText(terms.bankEks),
    },
    later: changes.filter((change) => change !== first && change !== variable?.change),
  }
}

/** Whether the fields fill anything under More terms that changes a figure, so the section opens on them. */
export function fillsMore(texts: OfferTexts): boolean {
  const costs = Object.values(texts.costs).some((cost) => cost.trim() !== '')
  return (
    [texts.lender, texts.firstInstalment, texts.interimAmount, texts.interimDate, texts.fixedYears, texts.thenVariable, texts.bankEks].some((text) => text.trim() !== '') || texts.subsidised || costs
  )
}

/** Whether a field under More terms is wrong while the four up front are right, which only opening the section shows. */
export function wrongInMore(errors: OfferErrors): boolean {
  return errors.principal === null && errors.rate === null && errors.term === null
}

export type OfferErrors = LoanTermsErrors & Readonly<Record<'rate' | 'term' | 'fixedYears' | 'thenVariable' | 'bankEks', string | null>>

/**
 * The offer the fields give with its rates, the first from the first instalment and a variable one
 * after the fixed years, or nulls while a field is wrong, with why each is.
 */
export function typedOffer(texts: OfferTexts): { readonly terms: OfferTerms | null; readonly rates: readonly RateChange[]; readonly errors: OfferErrors } {
  const instalments = typedTerm(texts.years, texts.months)
  const payout = parseCivilDate(texts.payout)
  const firstInstalment = texts.firstInstalment === '' && payout !== null ? dayMonthsLater(payout, 1) : texts.firstInstalment
  const loan = typedLoanTerms({
    lender: texts.lender,
    principal: texts.principal,
    drawdown: texts.payout,
    firstInstalment,
    instalments: instalments === null ? '' : String(instalments),
    interimAmount: texts.interimAmount,
    interimDate: texts.interimDate,
    repayment: texts.repayment,
  })
  const subsidy = texts.subsidised ? typedSubsidy(texts.subsidy, instalments, bankWords.subsidyFields).subsidy : null
  const { costs } = typedCosts(texts.costs)
  const bankEks = texts.bankEks.trim() === '' ? null : typedRate(texts.bankEks)
  const rate = typedRate(texts.rate)
  const variableWanted = texts.fixedYears.trim() !== '' || texts.thenVariable.trim() !== ''
  const fixedYears = typedCount(texts.fixedYears)
  const fixedYearsWrong = variableWanted && (fixedYears === null || (instalments !== null && fixedYears * 12 >= instalments))
  const thenVariable = typedRate(texts.thenVariable)
  const thenVariableWrong = variableWanted && thenVariable === null
  const errors: OfferErrors = {
    ...loan.errors,
    rate: rate === null ? bankWords.rateFields.rateError : null,
    term: instalments === null ? words.editor.termError : null,
    fixedYears: fixedYearsWrong ? words.editor.fixedForError : null,
    thenVariable: thenVariableWrong ? bankWords.rateFields.rateError : null,
    bankEks: texts.bankEks.trim() !== '' && bankEks === null ? bankWords.rateFields.rateError : null,
  }
  const valid = loan.terms !== null && rate !== null && costs !== null && (!texts.subsidised || subsidy !== null) && errors.bankEks === null && !fixedYearsWrong && !thenVariableWrong
  if (!valid || loan.terms === null || rate === null || costs === null) return { terms: null, rates: [], errors }
  const terms: OfferTerms = { ...loan.terms, subsidy, costs, bankEks }
  const first: RateChange = { kind: 'rate-change', from: terms.firstInstalment, rate, rateType: texts.rateType }
  const later: RateChange[] =
    fixedYears === null || thenVariable === null || !variableWanted ? [] : [{ kind: 'rate-change', from: variableAfter(terms.firstInstalment, fixedYears), rate: thenVariable, rateType: 'variable' }]
  return { terms, rates: [first, ...later], errors }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import CostFields from './CostFields.vue'
import FoldBlock from '../../bankLoans/presentation/FoldBlock.vue'
import RepaymentChoice from '../../bankLoans/presentation/RepaymentChoice.vue'
import SubsidyFields from '../../bankLoans/presentation/SubsidyFields.vue'
import { useLoanWords } from '../../bankLoans/presentation/useLoanWords'
import { words as loansWords } from '../../words'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/**
 * An offer's amount, yearly rate, term and repayment, then More terms as a bordered block that opens
 * to the name, the lender, the dates, interest before the first instalment, a variable rate after some
 * fixed years, a subsidy, costs, the bank's EKS and whatever the `more` slot adds.
 */
const texts = defineModel<OfferTexts>({ required: true })

const props = defineProps<{
  tried: boolean
  errors: OfferErrors
  /** The name the offer gets when its own is left blank. */
  autoName: string
  /** A field under More terms is wrong, which its caption says while the section is closed. */
  moreWrong: boolean
}>()

defineSlots<{
  /** What closes More terms, such as the offer's extra payments. */
  more?: () => unknown
}>()

const loanWords = useLoanWords()
const moreOpen = defineModel<boolean>('moreOpen', { required: true })
const instalments = computed(() => typedTerm(texts.value.years, texts.value.months))
const shown = (error: string | null): string | false => (props.tried && error) || false
</script>

<template>
  <div class="flex flex-col gap-4">
    <FormGrid>
      <UFormField :label="loanWords.loanDialog.principal" :error="shown(errors.principal)">
        <MoneyInput v-model="texts.principal" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="offer-principal" />
      </UFormField>
      <UFormField :label="words.editor.rate" :error="shown(errors.rate)">
        <UInput v-model="texts.rate" inputmode="decimal" :placeholder="loanWords.rateFields.ratePlaceholder" class="w-full" data-testid="offer-rate" />
      </UFormField>
      <UFormField :label="words.editor.years" :error="shown(errors.term)">
        <UInput v-model="texts.years" inputmode="numeric" class="w-full" data-testid="offer-years" />
      </UFormField>
      <UFormField :label="words.editor.months">
        <UInput v-model="texts.months" inputmode="numeric" placeholder="0" class="w-full" data-testid="offer-months" />
      </UFormField>
      <RepaymentChoice v-model="texts.repayment" class="sm:col-span-2" data-testid="offer-repayment" />
    </FormGrid>
    <FoldBlock
      v-model:open="moreOpen"
      :title="words.editor.more"
      :caption="moreWrong ? words.editor.moreWrong : words.editor.moreHelp"
      :warning="moreWrong"
      toggle-test-id="offer-more-toggle"
      data-testid="offer-more"
    >
      <div class="flex flex-col gap-4">
        <FormGrid>
          <UFormField :label="words.editor.name">
            <UInput v-model="texts.name" :placeholder="autoName" class="w-full" data-testid="scenario-name" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.lender">
            <UInput v-model="texts.lender" :placeholder="loanWords.loanDialog.lenderPlaceholder" class="w-full" data-testid="offer-lender" />
          </UFormField>
          <UFormField :label="words.editor.payout" :help="words.editor.payoutHelp" :error="shown(errors.drawdown)">
            <UInput v-model="texts.payout" type="date" class="w-full" data-testid="offer-drawdown" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.firstInstalment" :help="words.editor.firstInstalmentHelp" :error="shown(errors.firstInstalment)">
            <UInput v-model="texts.firstInstalment" type="date" class="w-full" data-testid="offer-first-instalment" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.interim" :help="loanWords.loanDialog.interimHelp" :error="shown(errors.interim)">
            <MoneyInput v-model="texts.interimAmount" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="offer-interim" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.interimDate">
            <UInput v-model="texts.interimDate" type="date" class="w-full" />
          </UFormField>
          <UFormField :label="words.editor.fixedFor" :help="words.editor.fixedForHelp" :error="shown(errors.fixedYears)">
            <UInput v-model="texts.fixedYears" inputmode="numeric" class="w-full" data-testid="offer-fixed-years" />
          </UFormField>
          <UFormField :label="words.editor.thenVariable" :error="shown(errors.thenVariable)">
            <UInput v-model="texts.thenVariable" inputmode="decimal" :placeholder="loanWords.rateFields.ratePlaceholder" class="w-full" data-testid="offer-then-variable" />
          </UFormField>
          <USwitch v-model="texts.subsidised" :label="loanWords.loanDialog.subsidised" :description="loanWords.loanDialog.subsidisedHelp" class="sm:col-span-2" />
          <SubsidyFields v-if="texts.subsidised" v-model="texts.subsidy" :tried="tried" :loan-instalments="instalments" />
          <CostFields v-model="texts.costs" :tried="tried" test-prefix="offer" />
          <UFormField :label="words.editor.bankEks" :error="shown(errors.bankEks)" :help="words.editor.bankEksHelp">
            <UInput v-model="texts.bankEks" inputmode="decimal" :placeholder="loanWords.rateFields.ratePlaceholder" class="w-full" data-testid="offer-bank-eks" />
          </UFormField>
        </FormGrid>
        <slot name="more" />
      </div>
    </FoldBlock>
  </div>
</template>
