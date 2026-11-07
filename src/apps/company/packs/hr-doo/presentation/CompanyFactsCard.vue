<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import { writtenPercent } from '../../../../../shared/money/percent'
import type { Percent } from '../../../../../shared/money/percent'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import FormGrid from '../../../../../shared/ui/FormGrid.vue'
import { typedLoanInterest } from '../domain/companyFacts'
import type { CitReturn, CompanyFacts, CompanyFactsDraft, CompanyFactsField, VatPrinciple } from '../domain/companyFacts'
import { words } from './words'

/**
 * The company and owner facts of Settings, General, edited in the settings form's draft and saved
 * by its Save. The card opens when a field is in error, or when a link names one of its fields,
 * such as `#owner-loan-interest`.
 */
const props = defineProps<{
  /** The facts as drafted. */
  facts: CompanyFactsDraft
  /** The facts as the workbook holds them, which the collapsed card sums up. */
  saved: CompanyFacts
  errors: Partial<Record<CompanyFactsField, string>>
}>()

const emit = defineEmits<{
  update: [facts: CompanyFactsDraft]
}>()

/** The facts other screens link to, by the id their link's hash names. */
const LINKED_FACTS = ['company-registered', 'owner-loan-interest']

const route = useRoute()
const revealed = computed(() => LINKED_FACTS.includes(route.hash.slice(1)) || Object.keys(props.errors).length > 0)
const summary = computed(() => {
  const { companyRegistered, ownerLoanInterest } = props.saved
  return words.facts.summary(companyRegistered, ownerLoanInterest)
})

function updateFact<Fact extends keyof CompanyFactsDraft>(fact: Fact, value: CompanyFactsDraft[Fact]): void {
  emit('update', { ...props.facts, [fact]: value })
}

/** The rate as typed. Text that is no rate goes into the draft as null, so the field shows its error. */
const loanInterestText = ref(textOfRate(props.facts.ownerLoanInterest))
watch(
  () => props.facts,
  (facts) => {
    if (typedLoanInterest(loanInterestText.value) !== facts.ownerLoanInterest) loanInterestText.value = textOfRate(facts.ownerLoanInterest)
  },
)

function textOfRate(rate: Percent | null): string {
  return rate === null ? '' : String(writtenPercent(rate))
}

function updateLoanInterest(text: string): void {
  loanInterestText.value = text
  updateFact('ownerLoanInterest', typedLoanInterest(text))
}

const citReturnItems: { value: CitReturn; label: string }[] = [
  { value: 'pd', label: words.facts.pd },
  { value: 'pd-nn', label: words.facts.pdNn },
]

const vatPrincipleItems: { value: VatPrinciple; label: string }[] = [
  { value: 'invoice', label: words.facts.onInvoice },
  { value: 'cash', label: words.facts.onPayment },
]
</script>

<template>
  <AppCard :title="words.facts.title" :subtitle="words.facts.subtitle" collapse-id="settings.facts" start-collapsed :summary="summary" :reveal="revealed" data-testid="company-facts">
    <div class="flex flex-col gap-4 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <FormGrid>
        <UFormField id="company-registered" :label="words.facts.registered" :help="words.facts.registeredHelp">
          <UInput :model-value="facts.companyRegistered ?? ''" type="date" class="w-full" @update:model-value="updateFact('companyRegistered', parseCivilDate(String($event ?? '')))" />
        </UFormField>
        <UFormField id="owner-loan-interest" :label="words.facts.loanInterest" :error="errors.ownerLoanInterest ?? false" :help="words.facts.loanInterestHelp">
          <UInput :model-value="loanInterestText" inputmode="decimal" class="w-full" data-testid="owner-loan-interest" @update:model-value="updateLoanInterest(String($event))" />
        </UFormField>
        <UFormField :label="words.facts.citReturn">
          <USelect :model-value="facts.citReturn" :items="citReturnItems" class="w-full" @update:model-value="updateFact('citReturn', $event as CitReturn)" />
        </UFormField>
        <UFormField :label="words.facts.vatPrinciple">
          <USelect :model-value="facts.vatPrinciple" :items="vatPrincipleItems" class="w-full" @update:model-value="updateFact('vatPrinciple', $event as VatPrinciple)" />
        </UFormField>
      </FormGrid>
      <USwitch :model-value="facts.depreciationDoubled" :label="words.facts.doubled" :description="words.facts.doubledHelp" @update:model-value="updateFact('depreciationDoubled', $event)" />
    </div>
  </AppCard>
</template>
