<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../../shared/calendar/dayLabel'
import { folderPathOf } from '../../../../../shared/text/folderPath'
import { mailAddressesOf, missingTerms, missingWords } from '../../../mail/domain/mailSource'
import type { MailTermPiece } from '../../../mail/domain/mailSource'
import AppCard from '../../../../../shared/ui/AppCard.vue'
import type { CitReturn, CompanyFacts, CompanyFactsField, VatPrinciple } from '../domain/companyFacts'

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
const LINKED_FACTS = ['company-registered', 'owner-loan-interest', 'accountant-mail']

type FolderFact = 'payrollFolder' | 'vatReturnsFolder' | 'incomingInvoicesFolder'

/** The accountant's three kinds of mail, each with its switch, its subject and its folder. */
const MAIL_KINDS = [
  {
    id: 'payroll',
    on: 'payrollMailSync',
    subject: 'payrollMailSubject',
    folder: 'payrollFolder',
    label: 'Read the payroll mail',
    subjectLabel: 'Payroll subject starts with',
    subjectHelp: 'The words before the month, such as Plaća za.',
    folderLabel: 'Payroll folder',
    folderHelp: 'Where it goes in Google Drive, as a path from My Drive, with a folder for each year and month inside.',
  },
  {
    id: 'vat',
    on: 'vatMailSync',
    subject: 'vatMailSubject',
    folder: 'vatReturnsFolder',
    label: 'Read the VAT return mail',
    subjectLabel: 'VAT return subject starts with',
    subjectHelp: 'The words before the period, such as PDV za.',
    folderLabel: 'VAT returns folder',
    folderHelp: 'Where it goes in Google Drive, as a path from My Drive, with a folder for each year inside.',
  },
  {
    id: 'invoices',
    on: 'invoicesMailSync',
    subject: 'invoicesMailSubject',
    folder: 'incomingInvoicesFolder',
    label: "Read the accountant's invoice mail",
    subjectLabel: 'Invoice subject starts with',
    subjectHelp: "The words the accountant's own invoice mail starts with, such as Račun za.",
    folderLabel: "Accountant's invoices folder",
    folderHelp: 'Where it goes in Google Drive, as a path from My Drive, with a folder for each year and month inside.',
  },
] as const

type MailKind = (typeof MAIL_KINDS)[number]

/** What a kind switched on lacks before a sync can read it, or nothing while it is off. */
function missingFor(kind: MailKind): MailTermPiece[] {
  const facts = props.facts
  return facts[kind.on] ? missingTerms({ senders: facts.accountantMailFrom, subject: facts[kind.subject].trim(), folder: facts[kind.folder] }) : []
}

const route = useRoute()
const revealed = computed(
  () =>
    LINKED_FACTS.includes(route.hash.slice(1)) ||
    Object.keys(props.errors).length > 0 ||
    MAIL_KINDS.some((kind) => missingFor(kind).length > 0),
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
const folderTexts = reactive<Record<FolderFact, string>>({
  payrollFolder: props.facts.payrollFolder.join('/'),
  vatReturnsFolder: props.facts.vatReturnsFolder.join('/'),
  incomingInvoicesFolder: props.facts.incomingInvoicesFolder.join('/'),
})
watch(
  () => MAIL_KINDS.map((kind) => props.facts[kind.folder]),
  (folders) => {
    for (const [index, kind] of MAIL_KINDS.entries()) {
      const folder = folders[index] ?? []
      if (JSON.stringify(folderPathOf(folderTexts[kind.folder])) !== JSON.stringify(folder)) folderTexts[kind.folder] = folder.join('/')
    }
  },
)

function updateFolder(fact: FolderFact, text: string): void {
  folderTexts[fact] = text
  updateFact(fact, folderPathOf(text))
}

/** The accountant's addresses as typed, so a trailing comma survives until the next address is written. */
const accountantMailText = ref(props.facts.accountantMailFrom.join(', '))
watch(
  () => props.facts.accountantMailFrom,
  (senders) => {
    if (JSON.stringify(mailAddressesOf(accountantMailText.value)) !== JSON.stringify(senders)) accountantMailText.value = senders.join(', ')
  },
)

function updateAccountantMail(text: string): void {
  accountantMailText.value = text
  updateFact('accountantMailFrom', mailAddressesOf(text))
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
      <div id="accountant-mail" class="flex flex-col gap-4 border-t border-default pt-4" data-testid="accountant-mail">
        <div class="flex flex-col gap-1">
          <h3 class="text-sm font-medium text-highlighted">The accountant's mail</h3>
          <p class="text-sm text-muted">
            Each sync looks in Gmail for the kinds switched on and files what is new into their folders, which the Mail card lists. Nothing in the app reads those files.
          </p>
        </div>
        <UFormField
          label="The accountant mails from"
          :error="errors.accountantMailFrom ?? false"
          help="Mail addresses, comma separated, which every kind below searches for."
          data-testid="accountant-mail-from"
        >
          <UInput :model-value="accountantMailText" inputmode="email" autocapitalize="off" :spellcheck="false" placeholder="Not read" class="w-full" @update:model-value="updateAccountantMail(String($event))" />
        </UFormField>
        <div class="flex flex-col divide-y divide-default">
          <section v-for="kind in MAIL_KINDS" :key="kind.id" class="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" :data-testid="`${kind.id}-mail-kind`">
            <USwitch
              :model-value="facts[kind.on]"
              :label="kind.label"
              description="Off makes no Gmail or Drive call for it."
              :data-testid="`${kind.id}-mail-sync`"
              @update:model-value="updateFact(kind.on, $event)"
            />
            <p v-if="missingFor(kind).length > 0" class="text-sm text-warning" data-testid="mail-kind-missing">It is on, but has {{ missingWords(missingFor(kind)) }}.</p>
            <div class="grid gap-4 sm:grid-cols-2">
              <UFormField :label="kind.subjectLabel" :error="errors[kind.subject] ?? false" :help="kind.subjectHelp" :data-testid="`${kind.id}-mail-subject`">
                <UInput :model-value="facts[kind.subject]" placeholder="Not set" class="w-full" @update:model-value="updateFact(kind.subject, String($event))" />
              </UFormField>
              <UFormField :label="kind.folderLabel" :help="kind.folderHelp" :data-testid="`${kind.id}-mail-folder`">
                <UInput :model-value="folderTexts[kind.folder]" class="identifier w-full" :ui="{ base: 'text-ellipsis' }" @update:model-value="updateFolder(kind.folder, String($event))" />
              </UFormField>
            </div>
          </section>
        </div>
      </div>
    </div>
  </AppCard>
</template>
