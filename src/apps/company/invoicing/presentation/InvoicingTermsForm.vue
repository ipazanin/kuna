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
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { settingsErrors } from '../../settings/domain/settings'
import type { BillingAmountField, BillingItemField, BillingTerms, InvoicingField, Settings } from '../../settings/domain/settings'
import { words } from './words'

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
  { label: words.terms.monthlyFee, amount: 'monthlyAmount', item: 'monthlyItem', help: words.terms.monthlyFeeHelp },
  { label: words.terms.subscriptions, amount: 'subscriptionAmount', item: 'subscriptionItem', help: words.terms.subscriptionsHelp },
  { label: words.terms.bonus, amount: 'bonusAmount', item: 'bonusItem', help: words.terms.bonusHelp },
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
const INVOICING_FIELDS: readonly { readonly field: InvoicingField; readonly lines?: number; readonly wide?: boolean }[] = [
  { field: 'name' },
  { field: 'address' },
  { field: 'country' },
  { field: 'vatId' },
  { field: 'phone' },
  { field: 'mail' },
  { field: 'iban' },
  { field: 'swift' },
  { field: 'bank' },
  { field: 'courtRegister' },
  { field: 'shareCapital' },
  { field: 'place' },
  { field: 'issueTime' },
  { field: 'signatory' },
  { field: 'signatoryTitle' },
  { field: 'numberPattern' },
  { field: 'filePath', lines: 1, wide: true },
  { field: 'folderId', lines: 1, wide: true },
  { field: 'mailSubject', lines: 1, wide: true },
  { field: 'mailBody', lines: 6, wide: true },
  { field: 'reverseChargeNote', lines: 2, wide: true },
]

function updateInvoicing(field: InvoicingField, value: string): void {
  draft.value = { ...draft.value, invoicing: { ...draft.value.invoicing, [field]: value } }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="valid && dirty && emit('save', draft)">
    <fieldset class="flex flex-col gap-3" data-testid="billing-terms">
      <legend class="text-sm font-medium text-highlighted">{{ words.terms.billingPlan }}</legend>
      <p class="-mt-1 text-xs text-muted">{{ words.terms.billingIntro }}</p>
      <FormGrid>
        <template v-for="term in BILLING_TERMS" :key="term.amount">
          <UFormField :label="term.label" :error="errors[term.amount] ?? false" :help="term.help">
            <UInput
              :model-value="billingAmountTexts[term.amount]"
              inputmode="decimal"
              :placeholder="words.terms.notSet"
              class="w-full"
              @update:model-value="updateBillingAmount(term.amount, String($event))"
            />
          </UFormField>
          <UFormField :label="words.terms.item(term.label)" :error="errors[term.item] ?? false">
            <USelectMenu
              :model-value="draft.billing[term.item]"
              :items="itemChoices"
              create-item
              :placeholder="words.terms.notSet"
              :search-input="{ placeholder: words.terms.searchItem }"
              class="w-full"
              @update:model-value="updateBilling(term.item, String($event ?? ''))"
              @create="createBillingItem(term.item, $event)"
            />
          </UFormField>
        </template>
        <UFormField :label="words.terms.client" :help="words.terms.clientHelp" class="sm:col-span-2">
          <USelectMenu
            :model-value="draft.billing.client"
            :items="clientItems"
            value-key="value"
            :placeholder="words.terms.notSet"
            clear
            class="w-full"
            @update:model-value="updateBilling('client', String($event ?? ''))"
          />
        </UFormField>
      </FormGrid>
    </fieldset>

    <fieldset class="flex flex-col gap-3" data-testid="invoicing-terms">
      <legend class="text-sm font-medium text-highlighted">{{ words.terms.invoices }}</legend>
      <p class="-mt-1 text-xs text-muted">{{ words.terms.invoicesIntro }}</p>
      <FormGrid>
        <UFormField
          v-for="entry in INVOICING_FIELDS"
          :key="entry.field"
          :label="words.terms.fields[entry.field].label"
          :help="words.terms.fields[entry.field].help ?? ''"
          :error="errors[entry.field] ?? false"
          :class="{ 'sm:col-span-2': entry.wide }"
        >
          <UTextarea
            v-if="entry.lines"
            :model-value="draft.invoicing[entry.field]"
            :rows="entry.lines"
            autoresize
            :placeholder="words.terms.notSet"
            class="w-full"
            :class="{ identifier: entry.field === 'folderId' }"
            @update:model-value="updateInvoicing(entry.field, String($event))"
          />
          <UInput
            v-else
            :model-value="draft.invoicing[entry.field]"
            :placeholder="words.terms.notSet"
            class="w-full"
            :class="{ identifier: entry.field === 'iban' }"
            @update:model-value="updateInvoicing(entry.field, String($event))"
          />
        </UFormField>
      </FormGrid>
    </fieldset>

    <div class="flex flex-wrap items-center gap-2">
      <UButton type="submit" :label="words.terms.save" icon="i-lucide-save" :loading="saving" :disabled="!dirty || !valid || saving" data-testid="terms-save" />
      <UButton :label="words.terms.discard" color="neutral" variant="ghost" :disabled="!dirty || saving" @click="draft = settings" />
    </div>
  </form>
</template>
