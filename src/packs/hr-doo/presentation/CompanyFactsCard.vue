<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { parseCivilDate } from '../../../shared/calendar/civilDate'
import { fold } from '../../../shared/text/fold'
import AppCard from '../../../shared/ui/AppCard.vue'
import type { CitReturn, CompanyFacts, SettingsField, VatPrinciple } from '../../../features/settings/domain/settings'
import { LOCAL_UNITS } from '../ruleset/localUnits'

/**
 * The company and owner facts of Settings, General, edited in the settings form's draft and saved
 * by its Save. The card opens when a field is in error, or when a link names one of its fields,
 * such as `#owner-loan-interest`.
 */
const props = defineProps<{
  /** The facts as drafted. */
  facts: CompanyFacts
  /** The facts as the workbook holds them, which the collapsed card sums up. */
  saved: CompanyFacts
  errors: Partial<Record<SettingsField, string>>
}>()

const emit = defineEmits<{
  update: [facts: CompanyFacts]
}>()

/** The facts other screens link to, by the id their link's hash names. */
const LINKED_FACTS = ['residence-city', 'company-registered', 'owner-loan-interest']

const route = useRoute()
const revealed = computed(
  () => LINKED_FACTS.includes(route.hash.slice(1)) || (['residenceCity', 'birthYear', 'dependants', 'ownerLoanInterest'] as const).some((field) => props.errors[field] !== undefined),
)
const summary = computed(() => {
  const { residenceCity, ownerLoanInterest } = props.saved
  return `${residenceCity === '' ? 'Where the owner lives is not set' : `The owner lives in ${residenceCity}`}. Loans to the owner carry ${ownerLoanInterest / 100}%.`
})

const unitItems = LOCAL_UNITS.map((unit) => ({ value: unit.label, label: unit.label, description: unit.county, searchText: fold(`${unit.label} ${unit.county}`) }))
const unitSearch = ref('')
const unitsFound = computed(() => {
  const words = fold(unitSearch.value).split(' ').filter((word) => word !== '')
  return unitItems.filter((item) => words.every((word) => item.searchText.includes(word)))
})

function updateFact<Fact extends keyof CompanyFacts>(fact: Fact, value: CompanyFacts[Fact]): void {
  emit('update', { ...props.facts, [fact]: value })
}

/** The number fields as typed. Text that is not a number goes into the draft as NaN, so the field shows its error. */
const birthYearText = ref(textOfBirthYear(props.facts.birthYear))
const dependantsText = ref(String(props.facts.dependants))
const loanInterestText = ref(textOfBasisPoints(props.facts.ownerLoanInterest))
watch(
  () => props.facts,
  (facts) => {
    if (!Object.is(numberOfBirthYear(birthYearText.value), facts.birthYear)) birthYearText.value = textOfBirthYear(facts.birthYear)
    if (!Object.is(numberOfDependants(dependantsText.value), facts.dependants)) dependantsText.value = String(facts.dependants)
    if (!Object.is(basisPointsOf(loanInterestText.value), facts.ownerLoanInterest)) loanInterestText.value = textOfBasisPoints(facts.ownerLoanInterest)
  },
)

/** A rate typed as a percent, so 2.5 is 250 basis points. A blank field is 0%. */
function basisPointsOf(text: string): number {
  const typed = text.trim().replace(',', '.')
  return typed === '' ? 0 : Math.round(Number(typed) * 100 * 1_000) / 1_000
}

function textOfBasisPoints(basisPoints: number): string {
  return String(basisPoints / 100)
}

function updateLoanInterest(text: string): void {
  loanInterestText.value = text
  updateFact('ownerLoanInterest', basisPointsOf(text))
}

function textOfBirthYear(year: number | null): string {
  return year === null ? '' : String(year)
}

/** A blank field is no birth year. */
function numberOfBirthYear(text: string): number | null {
  return text.trim() === '' ? null : Number(text.trim())
}

function numberOfDependants(text: string): number {
  return text.trim() === '' ? 0 : Number(text.trim())
}

function updateBirthYear(text: string): void {
  birthYearText.value = text
  updateFact('birthYear', numberOfBirthYear(text))
}

function updateDependants(text: string): void {
  dependantsText.value = text
  updateFact('dependants', numberOfDependants(text))
}

const citReturnItems: { value: CitReturn; label: string }[] = [
  { value: 'pd', label: 'PD, on the accrual profit' },
  { value: 'pd-nn', label: 'PD-NN, on cash received and paid' },
]

const vatPrincipleItems: { value: VatPrinciple; label: string }[] = [
  { value: 'invoice', label: 'On the invoice date' },
  { value: 'cash', label: 'When it is paid' },
]
</script>

<template>
  <AppCard
    title="Company and owner facts"
    subtitle="What the tax and payroll figures need to know beyond the law. They stay in this workbook."
    collapse-id="settings.facts"
    start-collapsed
    :summary="summary"
    :reveal="revealed"
    data-testid="company-facts"
  >
    <div class="flex flex-col gap-4 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField id="residence-city" label="Owner lives in" :error="errors.residenceCity ?? false" help="The city or municipality, which sets the local income tax rates.">
          <USelectMenu
            v-model:search-term="unitSearch"
            :model-value="facts.residenceCity"
            :items="unitsFound"
            value-key="value"
            ignore-filter
            :search-input="{ placeholder: 'Search cities and municipalities' }"
            placeholder="Not set"
            clear
            virtualize
            class="w-full"
            data-testid="residence-city"
            @update:model-value="updateFact('residenceCity', String($event ?? ''))"
          />
        </UFormField>
        <UFormField label="Owner's year of birth" :error="errors.birthYear ?? false" help="For the youth income tax relief. Blank assumes none.">
          <UInput
            :model-value="birthYearText"
            inputmode="numeric"
            placeholder="Not set"
            class="w-full"
            @update:model-value="updateBirthYear(String($event))"
          />
        </UFormField>
        <UFormField label="Dependants" :error="errors.dependants ?? false" help="How many dependants raise the personal allowance.">
          <UInput :model-value="dependantsText" inputmode="numeric" class="w-full" @update:model-value="updateDependants(String($event))" />
        </UFormField>
        <UFormField id="company-registered" label="Company registered on" help="Starts the first tax period.">
          <UInput
            :model-value="facts.companyRegistered ?? ''"
            type="date"
            class="w-full"
            @update:model-value="updateFact('companyRegistered', parseCivilDate(String($event ?? '')))"
          />
        </UFormField>
        <UFormField
          id="owner-loan-interest"
          label="Interest the owner's loans carry, % a year"
          :error="errors.ownerLoanInterest ?? false"
          help="Below the income tax law's rate, the difference on each day's balance is a benefit in kind, which Owner and Year work out."
        >
          <UInput :model-value="loanInterestText" inputmode="decimal" class="w-full" data-testid="owner-loan-interest" @update:model-value="updateLoanInterest(String($event))" />
        </UFormField>
        <UFormField label="Corporate tax return">
          <USelect :model-value="facts.citReturn" :items="citReturnItems" class="w-full" @update:model-value="updateFact('citReturn', $event as CitReturn)" />
        </UFormField>
        <UFormField label="VAT falls due">
          <USelect :model-value="facts.vatPrinciple" :items="vatPrincipleItems" class="w-full" @update:model-value="updateFact('vatPrinciple', $event as VatPrinciple)" />
        </UFormField>
      </div>
      <USwitch
        :model-value="facts.pensionPillarTwo"
        label="Owner pays into the second pension pillar"
        description="Off sends the whole pension contribution to the first pillar."
        @update:model-value="updateFact('pensionPillarTwo', $event)"
      />
      <USwitch
        :model-value="facts.depreciationDoubled"
        label="Depreciation rates are doubled"
        description="The default for assets. An asset row can still say otherwise."
        @update:model-value="updateFact('depreciationDoubled', $event)"
      />
    </div>
  </AppCard>
</template>
