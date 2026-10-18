<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { currencyProblem, ibanListOf, settingsErrors } from '../domain/settings'
import type { Settings } from '../domain/settings'

const props = defineProps<{
  settings: Settings
  saving: boolean
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

/** Every currency the browser knows that counts in at most hundredths, by name. */
const currencyNames = new Intl.DisplayNames('en', { type: 'currency' })
const currencies = Intl.supportedValuesOf('currency')
  .filter((code) => currencyProblem(code) === null)
  .map((code) => ({ value: code, label: `${currencyNames.of(code) ?? code} (${code})` }))

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
