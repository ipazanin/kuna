<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { LOCAL_UNITS, findLocalUnit } from '../../../packs/hr-doo/ruleset/localUnits'
import { parseCivilDate } from '../../../shared/calendar/civilDate'
import { amountOf, moneyFromAmount } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import { fold } from '../../../shared/text/fold'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { currencyProblem, ibanListOf, settingsErrors } from '../domain/settings'
import type { BillingAmountField, BillingItemField, BillingTerms, CitReturn, CompanyFacts, Settings, VatPrinciple } from '../domain/settings'

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
/** The workbook keeps the city as text, so a name typed there can be one the lookup refuses. Blank stays allowed. */
const residenceCityError = computed(() => {
  const city = draft.value.companyFacts.residenceCity.trim()
  return draft.value.ownerPayModule && city !== '' ? findLocalUnit(city).problem : null
})
const errors = computed(() => {
  const found = settingsErrors(draft.value)
  return residenceCityError.value === null ? found : { ...found, residenceCity: residenceCityError.value }
})
const valid = computed(() => Object.keys(errors.value).length === 0)

/** Every currency the browser knows that counts in at most hundredths, by name. */
const currencyNames = new Intl.DisplayNames('en', { type: 'currency' })
const currencies = Intl.supportedValuesOf('currency')
  .filter((code) => currencyProblem(code) === null)
  .map((code) => ({ value: code, label: `${currencyNames.of(code) ?? code} (${code})` }))

const unitItems = LOCAL_UNITS.map((unit) => ({ value: unit.label, label: unit.label, description: unit.county, searchText: fold(`${unit.label} ${unit.county}`) }))
const unitSearch = ref('')
const unitsFound = computed(() => {
  const words = fold(unitSearch.value).split(' ').filter((word) => word !== '')
  return unitItems.filter((item) => words.every((word) => item.searchText.includes(word)))
})

const preview = computed(() => {
  if (errors.value.currency !== undefined || errors.value.numberLocale !== undefined) return null
  const format = new Intl.NumberFormat(draft.value.numberLocale, { style: 'currency', currency: draft.value.currency })
  return `${format.format(1234.56)} and −${format.format(98.7)}`
})

function update<Field extends keyof Settings>(field: Field, value: Settings[Field]): void {
  draft.value = { ...draft.value, [field]: value }
}

/** The IBANs as typed, so a trailing comma survives until the next IBAN is written. */
const cardIbansText = ref(props.settings.cardSettlementIbans.join(', '))
watch(
  () => draft.value.cardSettlementIbans,
  (ibans) => {
    if (JSON.stringify(ibanListOf(cardIbansText.value)) !== JSON.stringify(ibans)) {
      cardIbansText.value = ibans.join(', ')
    }
  },
)

function updateCardIbans(text: string): void {
  cardIbansText.value = text
  update('cardSettlementIbans', ibanListOf(text))
}

function updateLabel(bucket: DefinedBucket, label: string): void {
  draft.value = { ...draft.value, bucketLabels: { ...draft.value.bucketLabels, [bucket]: label } }
}

function updateFact<Fact extends keyof CompanyFacts>(fact: Fact, value: CompanyFacts[Fact]): void {
  draft.value = { ...draft.value, companyFacts: { ...draft.value.companyFacts, [fact]: value } }
}

/** The two number fields as typed. Text that is not a number goes into the draft as NaN, so the field shows its error. */
const birthYearText = ref(textOfBirthYear(props.settings.companyFacts.birthYear))
const dependantsText = ref(String(props.settings.companyFacts.dependants))
watch(
  () => draft.value.companyFacts,
  (facts) => {
    if (!Object.is(numberOfBirthYear(birthYearText.value), facts.birthYear)) birthYearText.value = textOfBirthYear(facts.birthYear)
    if (!Object.is(numberOfDependants(dependantsText.value), facts.dependants)) dependantsText.value = String(facts.dependants)
  },
)

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

/** A blank field is no amount, and a decimal comma reads as a point. */
function amountOfText(text: string): BillingTerms[BillingAmountField] {
  const typed = text.trim().replace(',', '.')
  if (typed === '') return null
  const amount = Number(typed)
  return Number.isFinite(amount) ? moneyFromAmount(amount) : (Number.NaN as Money)
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
  <form class="flex flex-col gap-6" @submit.prevent="valid && dirty && emit('save', draft)">
    <div class="grid gap-4 sm:grid-cols-2">
      <UFormField label="Company name" help="Shown under the app name and used in the name of an exported file.">
        <UInput :model-value="draft.companyName" placeholder="Not set" class="w-full" @update:model-value="update('companyName', String($event))" />
      </UFormField>
      <UFormField label="Currency" :error="errors.currency ?? false" help="The money in the ledger. One currency per workbook.">
        <USelectMenu
          :model-value="draft.currency"
          :items="currencies"
          value-key="value"
          :search-input="{ placeholder: 'Search currencies' }"
          virtualize
          class="w-full"
          @update:model-value="update('currency', String($event))"
        />
      </UFormField>
      <UFormField
        label="Number locale"
        :error="errors.numberLocale ?? false"
        :help="preview ? `Amounts read ${preview}. Dates and text stay in English.` : 'A tag such as en-GB, de-DE or en-US.'"
      >
        <UInput :model-value="draft.numberLocale" class="w-full" @update:model-value="update('numberLocale', String($event).trim())" />
      </UFormField>
      <UFormField
        label="Review label"
        :error="errors.reviewLabel ?? false"
        help="What flagged_by will say on a row a person confirms in the app. rule and ai are the categoriser's."
      >
        <UInput :model-value="draft.reviewLabel" class="w-full" @update:model-value="update('reviewLabel', String($event).trim().toLowerCase())" />
      </UFormField>
      <UFormField
        label="Card settlement IBANs"
        :error="errors.cardSettlementIbans ?? false"
        help="The bank's card settlement accounts, comma separated. A row paid to one of them reads as a card purchase."
        class="sm:col-span-2"
      >
        <UInput :model-value="cardIbansText" placeholder="None" class="identifier w-full" @update:model-value="updateCardIbans(String($event))" />
      </UFormField>
    </div>

    <USwitch
      :model-value="draft.ownerPayModule"
      label="Owner-pay module"
      description="Shows owner pay and owner earns. Off hides them, and rows in the owner-pay bucket then count as operating cost, so every total stays the same."
      @update:model-value="update('ownerPayModule', $event)"
    />

    <fieldset v-if="draft.ownerPayModule" class="flex flex-col gap-3" data-testid="company-facts">
      <legend class="text-sm font-medium text-highlighted">Company and owner facts</legend>
      <p class="-mt-1 text-xs text-muted">What the tax and payroll figures need to know beyond the law. They stay in this workbook.</p>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Owner lives in" :error="errors.residenceCity ?? false" help="The city or municipality, which sets the local income tax rates.">
          <USelectMenu
            v-model:search-term="unitSearch"
            :model-value="draft.companyFacts.residenceCity"
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
        <UFormField label="Company registered on" help="Starts the first tax period.">
          <UInput
            :model-value="draft.companyFacts.companyRegistered ?? ''"
            type="date"
            class="w-full"
            @update:model-value="updateFact('companyRegistered', parseCivilDate(String($event ?? '')))"
          />
        </UFormField>
        <UFormField label="Corporate tax return">
          <USelect :model-value="draft.companyFacts.citReturn" :items="citReturnItems" class="w-full" @update:model-value="updateFact('citReturn', $event as CitReturn)" />
        </UFormField>
        <UFormField label="VAT falls due">
          <USelect :model-value="draft.companyFacts.vatPrinciple" :items="vatPrincipleItems" class="w-full" @update:model-value="updateFact('vatPrinciple', $event as VatPrinciple)" />
        </UFormField>
      </div>
      <USwitch
        :model-value="draft.companyFacts.pensionPillarTwo"
        label="Owner pays into the second pension pillar"
        description="Off sends the whole pension contribution to the first pillar."
        @update:model-value="updateFact('pensionPillarTwo', $event)"
      />
      <USwitch
        :model-value="draft.companyFacts.depreciationDoubled"
        label="Depreciation rates are doubled"
        description="The default for assets. An asset row can still say otherwise."
        @update:model-value="updateFact('depreciationDoubled', $event)"
      />
    </fieldset>

    <fieldset class="flex flex-col gap-3" data-testid="billing-terms">
      <legend class="text-sm font-medium text-highlighted">Billing plan</legend>
      <p class="-mt-1 text-xs text-muted">
        What a client is billed on terms. "Fill the rest of the year" on Billing plan adds the monthly rows from them. Name each item exactly as the
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

    <fieldset class="flex flex-col gap-3">
      <legend class="text-sm font-medium text-highlighted">Bucket labels</legend>
      <p class="-mt-1 text-xs text-muted">What each bucket is called on screen. The categories tab keeps the bucket names on the right.</p>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UFormField v-for="bucket in BUCKETS" :key="bucket" :error="errors[bucket] ?? false">
          <template #label>
            <span class="inline-flex items-center gap-1.5">
              <span class="size-2 rounded-[2px]" :style="{ background: `var(--bucket-${bucket})` }" aria-hidden="true" />
              <span class="identifier">{{ bucket }}</span>
            </span>
          </template>
          <UInput :model-value="draft.bucketLabels[bucket]" class="w-full" @update:model-value="updateLabel(bucket, String($event))" />
        </UFormField>
      </div>
    </fieldset>

    <div class="flex flex-wrap items-center gap-2">
      <UButton type="submit" label="Save settings" icon="i-lucide-save" :loading="saving" :disabled="!dirty || !valid || saving" />
      <UButton label="Discard changes" color="neutral" variant="ghost" :disabled="!dirty || saving" @click="draft = settings" />
    </div>
  </form>
</template>
