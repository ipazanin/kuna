<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import UTextarea from '@nuxt/ui/components/Textarea.vue'

import { amountOf } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { settingsErrors } from '../../settings/domain/settings'
import type { BillingAmountField, BillingItemField, BillingTerms, InvoicingField, Settings } from '../../settings/domain/settings'

/** The billing plan's terms and what an invoice prints, as rows of the settings tab. */
const props = defineProps<{
  settings: Settings
  saving: boolean
  /** The clients the billing plan can fill rows for. */
  clients: readonly { readonly slug: string; readonly name: string }[]
  /** The item kinds the outgoing-plan tab already uses, so a term names one exactly as the tab writes it. */
  billingItems: readonly string[]
}>()

const emit = defineEmits<{
  save: [settings: Settings]
}>()

const draft = ref<Settings>(props.settings)
watch(
  () => props.settings,
  (saved) => {
    draft.value = saved
  },
)

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.settings))
const errors = computed(() => settingsErrors(draft.value))
const valid = computed(() => Object.keys(errors.value).length === 0)

const BILLING_TERMS: readonly { readonly label: string; readonly amount: BillingAmountField; readonly item: BillingItemField; readonly help: string }[] = [
  { label: 'Monthly fee', amount: 'monthlyAmount', item: 'monthlyItem', help: 'Filled for every month to December.' },
  { label: 'Monthly subscriptions', amount: 'subscriptionAmount', item: 'subscriptionItem', help: 'Re-billed every month, filled the same way.' },
  { label: 'Yearly bonus', amount: 'bonusAmount', item: 'bonusItem', help: 'Shown for reference, never filled.' },
]

function updateBilling<Field extends keyof BillingTerms>(field: Field, value: BillingTerms[Field]): void {
  draft.value = { ...draft.value, billing: { ...draft.value.billing, [field]: value } }
}

function textOfAmount(amount: Money | null): string {
  return amount === null ? '' : String(amountOf(amount))
}

/** The amounts as typed. Text that is not an amount goes into the draft as NaN, so the field shows its error. */
const billingAmountTexts = ref<Record<BillingAmountField, string>>({
  monthlyAmount: textOfAmount(props.settings.billing.monthlyAmount),
  subscriptionAmount: textOfAmount(props.settings.billing.subscriptionAmount),
  bonusAmount: textOfAmount(props.settings.billing.bonusAmount),
})
watch(
  () => draft.value.billing,
  (terms) => {
    for (const { amount } of BILLING_TERMS) {
      if (!Object.is(amountOfText(billingAmountTexts.value[amount]), terms[amount])) {
        billingAmountTexts.value = { ...billingAmountTexts.value, [amount]: textOfAmount(terms[amount]) }
      }
    }
  },
)

/** A blank field is no amount. */
function amountOfText(text: string): BillingTerms[BillingAmountField] {
  if (text.trim() === '') return null
  return typedAmount(text) ?? (Number.NaN as Money)
}

function updateBillingAmount(field: BillingAmountField, text: string): void {
  billingAmountTexts.value = { ...billingAmountTexts.value, [field]: text }
  updateBilling(field, amountOfText(text))
}

const billingItemChoices = ref<string[]>([])
const itemChoices = computed(() => [...new Set([...props.billingItems, ...BILLING_TERMS.map(({ item }) => draft.value.billing[item]), ...billingItemChoices.value])].filter((item) => item !== ''))

function createBillingItem(field: BillingItemField, text: string): void {
  const typed = text.trim()
  if (typed !== '') {
    billingItemChoices.value = [...billingItemChoices.value, typed]
    updateBilling(field, typed)
  }
}

const clientItems = computed(() => props.clients.map((client) => ({ label: client.name || client.slug, value: client.slug })))

/** A field with `lines` is a text box that grows, so a long path or subject wraps instead of scrolling inside the card. */
const INVOICING_FIELDS: readonly { readonly field: InvoicingField; readonly label: string; readonly help?: string; readonly lines?: number; readonly wide?: boolean }[] = [
  { field: 'name', label: 'Company name on the invoice' },
  { field: 'address', label: 'Address', help: 'Street and town.' },
  { field: 'country', label: 'Country' },
  { field: 'vatId', label: 'VAT ID' },
  { field: 'phone', label: 'Phone' },
  { field: 'mail', label: 'Mail' },
  { field: 'iban', label: 'IBAN', help: 'The account the client pays into.' },
  { field: 'swift', label: 'SWIFT' },
  { field: 'bank', label: 'Bank', help: 'For the footer, such as Example Bank d.d.' },
  { field: 'courtRegister', label: 'Court register number' },
  { field: 'shareCapital', label: 'Share capital', help: 'As the footer prints it, such as EUR 2,500.00 (fully paid-up).' },
  { field: 'place', label: 'Place of issue', help: 'Printed before the date.' },
  { field: 'issueTime', label: 'Issuing time', help: 'Such as 17:00h. Blank leaves the line out.' },
  { field: 'signatory', label: 'Signatory', help: 'Prepares and signs the invoice.' },
  { field: 'signatoryTitle', label: 'Signatory’s role', help: 'Such as director.' },
  { field: 'numberPattern', label: 'Number pattern', help: '{n} is the sequence, which restarts each year. {yy} and {yyyy} are the year.' },
  { field: 'filePath', label: 'File path', help: 'Under the invoice folder, with {yyyy}, {yy}, {mm}, {client} and {number}.', lines: 1, wide: true },
  { field: 'folderId', label: 'Invoice folder', help: 'The Drive folder id. Make invoice asks you to pick it the first time.', lines: 1, wide: true },
  { field: 'mailSubject', label: 'Mail subject', help: 'With {month}, {number}, {client}, {company} and {signatory}.', lines: 1, wide: true },
  { field: 'mailBody', label: 'Mail text', lines: 6, wide: true },
  { field: 'reverseChargeNote', label: 'Reverse-charge note', help: 'Printed under the totals, after an asterisk.', lines: 2, wide: true },
]

function updateInvoicing(field: InvoicingField, value: string): void {
  draft.value = { ...draft.value, invoicing: { ...draft.value.invoicing, [field]: value } }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="valid && dirty && emit('save', draft)">
    <fieldset class="flex flex-col gap-3" data-testid="billing-terms">
      <legend class="text-sm font-medium text-highlighted">Billing plan</legend>
      <p class="-mt-1 text-xs text-muted">
        What a client is billed on terms. "Fill the rest of the year" on the Plan tab adds the monthly rows from them. Name each item exactly as the
        outgoing-plan tab writes it, or the fill adds a second row in a month that already has one.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <template v-for="term in BILLING_TERMS" :key="term.amount">
          <UFormField :label="term.label" :error="errors[term.amount] ?? false" :help="term.help">
            <UInput
              :model-value="billingAmountTexts[term.amount]"
              inputmode="decimal"
              placeholder="Not set"
              class="w-full"
              @update:model-value="updateBillingAmount(term.amount, String($event))"
            />
          </UFormField>
          <UFormField :label="`${term.label}, item`" :error="errors[term.item] ?? false">
            <USelectMenu
              :model-value="draft.billing[term.item]"
              :items="itemChoices"
              create-item
              placeholder="Not set"
              :search-input="{ placeholder: 'Search or type an item' }"
              class="w-full"
              @update:model-value="updateBilling(term.item, String($event ?? ''))"
              @create="createBillingItem(term.item, $event)"
            />
          </UFormField>
        </template>
        <UFormField label="Client the rows are for" help="Its name on the clients tab." class="sm:col-span-2">
          <USelectMenu
            :model-value="draft.billing.client"
            :items="clientItems"
            value-key="value"
            placeholder="Not set"
            clear
            class="w-full"
            @update:model-value="updateBilling('client', String($event ?? ''))"
          />
        </UFormField>
      </div>
    </fieldset>

    <fieldset class="flex flex-col gap-3" data-testid="invoicing-terms">
      <legend class="text-sm font-medium text-highlighted">Invoices</legend>
      <p class="-mt-1 text-xs text-muted">
        What an invoice prints about your company, and how it is numbered, filed and mailed. The client’s address and mail are on the clients tab above.
      </p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          v-for="entry in INVOICING_FIELDS"
          :key="entry.field"
          :label="entry.label"
          :help="entry.help ?? ''"
          :error="errors[entry.field] ?? false"
          :class="{ 'sm:col-span-2': entry.wide }"
        >
          <UTextarea
            v-if="entry.lines"
            :model-value="draft.invoicing[entry.field]"
            :rows="entry.lines"
            autoresize
            placeholder="Not set"
            class="w-full"
            :class="{ identifier: entry.field === 'folderId' }"
            @update:model-value="updateInvoicing(entry.field, String($event))"
          />
          <UInput
            v-else
            :model-value="draft.invoicing[entry.field]"
            placeholder="Not set"
            class="w-full"
            :class="{ identifier: entry.field === 'iban' }"
            @update:model-value="updateInvoicing(entry.field, String($event))"
          />
        </UFormField>
      </div>
    </fieldset>

    <div class="flex flex-wrap items-center gap-2">
      <UButton type="submit" label="Save terms" icon="i-lucide-save" :loading="saving" :disabled="!dirty || !valid || saving" data-testid="terms-save" />
      <UButton label="Discard changes" color="neutral" variant="ghost" :disabled="!dirty || saving" @click="draft = settings" />
    </div>
  </form>
</template>
