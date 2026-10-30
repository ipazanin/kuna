<script lang="ts">
import { costTexts, typedCosts } from './changeTexts'
import type { CostTexts, RateTexts } from './changeTexts'
import type { LoanChange, OfferTerms } from '../domain/loanScenario'
import { rateText, typedRate } from '../../bankLoans/domain/yearlyRate'
import { loanTermsTexts, typedLoanTerms } from '../../bankLoans/presentation/LoanTermsFields.vue'
import type { LoanTermsTexts } from '../../bankLoans/presentation/LoanTermsFields.vue'
import { subsidyTexts, typedSubsidy } from '../../bankLoans/presentation/SubsidyFields.vue'
import type { SubsidyTexts } from '../../bankLoans/presentation/SubsidyFields.vue'
import { words as bankWords } from '../../bankLoans/presentation/words'

type RateChange = Extract<LoanChange, { kind: 'rate-change' }>

/** An offer's terms as typed: the bank loan's, its first rate, an optional subsidy, its costs and the bank's EKS. */
export interface OfferTexts {
  terms: LoanTermsTexts
  rate: RateTexts
  subsidised: boolean
  subsidy: SubsidyTexts
  costs: CostTexts
  bankEks: string
}

export function offerTexts(terms: OfferTerms | null, firstRate: RateChange | null): OfferTexts {
  return {
    terms: loanTermsTexts(terms),
    rate: firstRate === null ? { rate: '', rateType: 'fixed' } : { rate: rateText(firstRate.rate), rateType: firstRate.rateType },
    subsidised: (terms?.subsidy ?? null) !== null,
    subsidy: subsidyTexts(terms?.subsidy ?? null),
    costs: costTexts(terms?.costs ?? null),
    bankEks: terms === null || terms.bankEks === null ? '' : rateText(terms.bankEks),
  }
}

/** The offer the fields give with the rate change its first rate is, or nulls while a field is wrong. */
export function typedOffer(texts: OfferTexts): { readonly terms: OfferTerms | null; readonly firstRate: RateChange | null } {
  const loan = typedLoanTerms(texts.terms)
  const subsidy = texts.subsidised ? typedSubsidy(texts.subsidy, loan.instalments).subsidy : null
  const { costs } = typedCosts(texts.costs)
  const bankEks = texts.bankEks.trim() === '' ? null : typedRate(texts.bankEks)
  const eksWrong = texts.bankEks.trim() !== '' && bankEks === null
  const rate = typedRate(texts.rate.rate)
  const terms = loan.terms === null || costs === null || (texts.subsidised && subsidy === null) || eksWrong ? null : { ...loan.terms, subsidy, costs, bankEks }
  return { terms, firstRate: terms === null || rate === null ? null : { kind: 'rate-change', from: terms.firstInstalment, rate, rateType: texts.rate.rateType } }
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import ChangeRateFields from './ChangeRateFields.vue'
import CostFields from './CostFields.vue'
import { words } from './words'
import LoanTermsFields from '../../bankLoans/presentation/LoanTermsFields.vue'
import SubsidyFields from '../../bankLoans/presentation/SubsidyFields.vue'

/** An offer's own terms, with the bank loan form's fields, its first rate, its costs and the EKS the bank printed. */
const texts = defineModel<OfferTexts>({ required: true })

defineProps<{
  tried: boolean
}>()

const instalments = computed(() => typedLoanTerms(texts.value.terms).instalments)
const eksError = computed(() => (texts.value.bankEks.trim() !== '' && typedRate(texts.value.bankEks) === null ? bankWords.rateFields.rateError : null))
</script>

<template>
  <LoanTermsFields v-model="texts.terms" :tried="tried" test-prefix="offer" />
  <p class="text-sm font-medium text-highlighted sm:col-span-2">{{ bankWords.loanDialog.firstRate }}</p>
  <ChangeRateFields v-model="texts.rate" :tried="tried" :current="null" test-prefix="offer" />
  <USwitch v-model="texts.subsidised" :label="bankWords.loanDialog.subsidised" :description="bankWords.loanDialog.subsidisedHelp" class="sm:col-span-2" />
  <SubsidyFields v-if="texts.subsidised" v-model="texts.subsidy" :tried="tried" :loan-instalments="instalments" />
  <CostFields v-model="texts.costs" :tried="tried" test-prefix="offer" />
  <UFormField :label="words.editor.bankEks" :error="(tried && eksError) || false" :help="words.editor.bankEksHelp">
    <UInput v-model="texts.bankEks" inputmode="decimal" :placeholder="bankWords.rateFields.ratePlaceholder" class="w-full" data-testid="offer-bank-eks" />
  </UFormField>
</template>
