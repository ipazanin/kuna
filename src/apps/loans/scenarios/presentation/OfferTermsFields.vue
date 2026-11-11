<script setup lang="ts">
import { computed } from 'vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import CostFields from './CostFields.vue'
import { words } from './words'
import type { OfferErrors } from './words'
import type { OfferTexts } from '../domain/offerTexts'
import FoldBlock from '../../bankLoans/presentation/FoldBlock.vue'
import RepaymentChoice from '../../bankLoans/presentation/RepaymentChoice.vue'
import SubsidyFields from '../../bankLoans/presentation/SubsidyFields.vue'
import { typedTerm } from '../../bankLoans/domain/typedTerm'
import { useLoanWords } from '../../bankLoans/presentation/useLoanWords'
import { words as loansWords } from '../../words'
import DayField from '../../../../shared/ui/DayField.vue'
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
            <DayField v-model="texts.payout" class="w-full" data-testid="offer-drawdown" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.firstInstalment" :help="words.editor.firstInstalmentHelp" :error="shown(errors.firstInstalment)">
            <DayField v-model="texts.firstInstalment" class="w-full" data-testid="offer-first-instalment" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.interim" :help="loanWords.loanDialog.interimHelp" :error="shown(errors.interim)">
            <MoneyInput v-model="texts.interimAmount" :placeholder="loansWords.form.amountPlaceholder" class="w-full" data-testid="offer-interim" />
          </UFormField>
          <UFormField :label="loanWords.loanDialog.interimDate">
            <DayField v-model="texts.interimDate" class="w-full" />
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
