<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { parseCivilDate } from '../../../shared/calendar/civilDate'
import { folderPathOf } from '../../../shared/text/folderPath'
import AppCard from '../../../shared/ui/AppCard.vue'
import type { CitReturn, CompanyFacts, CompanyFactsField, VatPrinciple } from '../domain/companyFacts'
import { dayLabel } from '../ruleset/presentation/ruleWording'

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
  errors: Partial<Record<CompanyFactsField, string>>
}>()

const emit = defineEmits<{
  update: [facts: CompanyFacts]
}>()

/** The facts other screens link to, by the id their link's hash names. */
const LINKED_FACTS = ['company-registered', 'owner-loan-interest', 'accountant-folders']

const route = useRoute()
const revealed = computed(
  () =>
    LINKED_FACTS.includes(route.hash.slice(1)) ||
    props.errors.ownerLoanInterest !== undefined,
)
const summary = computed(() => {
  const { companyRegistered, ownerLoanInterest } = props.saved
  return `${companyRegistered === null ? 'The registration day is not set' : `Registered on ${dayLabel(companyRegistered)}`}. Loans to the owner carry ${ownerLoanInterest / 100}%.`
})

function updateFact<Fact extends keyof CompanyFacts>(fact: Fact, value: CompanyFacts[Fact]): void {
  emit('update', { ...props.facts, [fact]: value })
}

/** The number fields as typed. Text that is not a number goes into the draft as NaN, so the field shows its error. */
const loanInterestText = ref(textOfBasisPoints(props.facts.ownerLoanInterest))
watch(
  () => props.facts,
  (facts) => {
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

/** The folder paths as typed, so a trailing slash survives until the next folder name is written. */
const vatReturnsFolderText = ref(props.facts.vatReturnsFolder.join('/'))
const payrollFolderText = ref(props.facts.payrollFolder.join('/'))
watch(
  () => [props.facts.vatReturnsFolder, props.facts.payrollFolder] as const,
  ([vatReturns, payroll]) => {
    if (JSON.stringify(folderPathOf(vatReturnsFolderText.value)) !== JSON.stringify(vatReturns)) vatReturnsFolderText.value = vatReturns.join('/')
    if (JSON.stringify(folderPathOf(payrollFolderText.value)) !== JSON.stringify(payroll)) payrollFolderText.value = payroll.join('/')
  },
)

function updateVatReturnsFolder(text: string): void {
  vatReturnsFolderText.value = text
  updateFact('vatReturnsFolder', folderPathOf(text))
}

function updatePayrollFolder(text: string): void {
  payrollFolderText.value = text
  updateFact('payrollFolder', folderPathOf(text))
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
    subtitle="What the tax figures need to know beyond the law. They stay in this workbook. The owner's facts for the payroll are on the director's row on Salaries."
    collapse-id="settings.facts"
    start-collapsed
    :summary="summary"
    :reveal="revealed"
    data-testid="company-facts"
  >
    <div class="flex flex-col gap-4 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
      <div class="grid gap-4 sm:grid-cols-2">
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
          help="Below the income tax law's rate, the difference on each day's balance is a benefit in kind, which Year works out."
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
        :model-value="facts.depreciationDoubled"
        label="Depreciation rates are doubled"
        description="The default for assets. An asset row can still say otherwise."
        @update:model-value="updateFact('depreciationDoubled', $event)"
      />
      <USwitch
        :model-value="facts.accountantSync"
        label="Read the accountant's files on sync"
        description="Each sync reads the VAT returns and salary workbooks of the folders below that are named, for Year, Taxes. Off keeps the last read on this device."
        data-testid="accountant-sync"
        @update:model-value="updateFact('accountantSync', $event)"
      />
      <div id="accountant-folders" class="grid gap-4 sm:grid-cols-2">
        <UFormField
          label="VAT returns folder"
          help="Where Year, Taxes reads the accountant's VAT returns in Google Drive, as a path from My Drive. Blank reads none."
          data-testid="vat-returns-folder"
        >
          <UInput :model-value="vatReturnsFolderText" class="identifier w-full" :ui="{ base: 'text-ellipsis' }" @update:model-value="updateVatReturnsFolder(String($event))" />
        </UFormField>
        <UFormField
          label="Payroll folder"
          help="Where Year, Taxes reads the accountant's salary workbooks, with a folder for each year and month inside. Blank reads none."
          data-testid="payroll-folder"
        >
          <UInput :model-value="payrollFolderText" class="identifier w-full" :ui="{ base: 'text-ellipsis' }" @update:model-value="updatePayrollFolder(String($event))" />
        </UFormField>
      </div>
    </div>
  </AppCard>
</template>
