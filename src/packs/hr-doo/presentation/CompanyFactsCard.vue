<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { parseCivilDate } from '../../../shared/calendar/civilDate'
import { folderPathOf } from '../../../shared/text/folderPath'
import { mailAddressesOf } from '../../../features/mail/domain/mailSource'
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
const LINKED_FACTS = ['company-registered', 'owner-loan-interest', 'accountant-folders', 'accountant-mail']

const route = useRoute()
const revealed = computed(
  () =>
    LINKED_FACTS.includes(route.hash.slice(1)) ||
    Object.keys(props.errors).length > 0,
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

/** The accountant's addresses and the invoices folder as typed, for the same reason. */
const accountantMailText = ref(props.facts.accountantMailFrom.join(', '))
const invoicesFolderText = ref(props.facts.incomingInvoicesFolder.join('/'))
watch(
  () => [props.facts.accountantMailFrom, props.facts.incomingInvoicesFolder] as const,
  ([senders, invoices]) => {
    if (JSON.stringify(mailAddressesOf(accountantMailText.value)) !== JSON.stringify(senders)) accountantMailText.value = senders.join(', ')
    if (JSON.stringify(folderPathOf(invoicesFolderText.value)) !== JSON.stringify(invoices)) invoicesFolderText.value = invoices.join('/')
  },
)

function updateAccountantMail(text: string): void {
  accountantMailText.value = text
  updateFact('accountantMailFrom', mailAddressesOf(text))
}

function updateInvoicesFolder(text: string): void {
  invoicesFolderText.value = text
  updateFact('incomingInvoicesFolder', folderPathOf(text))
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
      <div id="accountant-mail" class="flex flex-col gap-4 border-t border-default pt-4" data-testid="accountant-mail">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-medium text-highlighted">The accountant's mail</h3>
          <p class="text-sm text-muted">
            Each sync looks in Gmail for the kinds whose subject is set, and the Mail card lists what it would file into the folders above. It files nothing yet.
          </p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField
            label="The accountant mails from"
            :error="errors.accountantMailFrom ?? false"
            help="Mail addresses, comma separated. Blank leaves the accountant's mail unread."
            class="sm:col-span-2"
            data-testid="accountant-mail-from"
          >
            <UInput :model-value="accountantMailText" inputmode="email" autocapitalize="off" :spellcheck="false" placeholder="Not read" class="w-full" @update:model-value="updateAccountantMail(String($event))" />
          </UFormField>
          <UFormField label="Payroll subject starts with" :error="errors.payrollMailSubject ?? false" help="The words before the month, such as Plaća za." data-testid="payroll-mail-subject">
            <UInput :model-value="facts.payrollMailSubject" placeholder="Not read" class="w-full" @update:model-value="updateFact('payrollMailSubject', String($event))" />
          </UFormField>
          <UFormField label="VAT return subject starts with" :error="errors.vatMailSubject ?? false" help="The words before the period, such as PDV za." data-testid="vat-mail-subject">
            <UInput :model-value="facts.vatMailSubject" placeholder="Not read" class="w-full" @update:model-value="updateFact('vatMailSubject', String($event))" />
          </UFormField>
          <UFormField label="Invoice subject starts with" :error="errors.invoicesMailSubject ?? false" help="The accountant's own invoice, such as Račun za." data-testid="invoices-mail-subject">
            <UInput :model-value="facts.invoicesMailSubject" placeholder="Not read" class="w-full" @update:model-value="updateFact('invoicesMailSubject', String($event))" />
          </UFormField>
          <UFormField
            label="Accountant's invoices folder"
            help="Where the accountant's invoices go in Google Drive, as a path from My Drive, with a folder for each year and month inside."
            data-testid="incoming-invoices-folder"
          >
            <UInput :model-value="invoicesFolderText" class="identifier w-full" :ui="{ base: 'text-ellipsis' }" @update:model-value="updateInvoicesFolder(String($event))" />
          </UFormField>
        </div>
      </div>
    </div>
  </AppCard>
</template>
