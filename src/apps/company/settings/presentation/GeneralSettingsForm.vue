<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import { shownPack } from '../../packs/packContribution'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import { folderPathOf } from '../../../../shared/text/folderPath'
import MailSettingsCard from '../../mail/presentation/MailSettingsCard.vue'
import { settingsErrors } from '../domain/settings'
import type { Settings, SettingsField } from '../domain/settings'
import IbanTagsField from './IbanTagsField.vue'
import { CURRENCY_ITEMS } from './moneyChoices'

/**
 * The settings tab as cards, the workbook's basics open and the rest collapsed, with one Save under
 * them. A card with a field in error opens. The mail card follows the basics. While the owner-pay
 * switch is on in the draft, the pack's facts card sits between the mail and the bucket labels,
 * and Save waits for its checks too.
 */
const props = defineProps<{
  settings: Settings
  /** The pack's facts as the workbook holds them, which its card edits. */
  facts: unknown
  saving: boolean
}>()

const emit = defineEmits<{
  save: [settings: Settings, facts: unknown]
}>()

const draft = ref<Settings>(props.settings)
const factsDraft = ref<unknown>(props.facts)
watch(
  () => [props.settings, props.facts] as const,
  ([saved, facts]) => {
    draft.value = saved
    factsDraft.value = facts
  },
)

const dirty = computed(() => JSON.stringify(draft.value) !== JSON.stringify(props.settings) || JSON.stringify(factsDraft.value) !== JSON.stringify(props.facts))
const packFacts = computed(() => shownPack(draft.value).companyFacts)
const errors = computed(() => settingsErrors(draft.value))
const factErrors = computed(() => packFacts.value?.errors(factsDraft.value) ?? {})
const valid = computed(() => Object.keys(errors.value).length === 0 && Object.keys(factErrors.value).length === 0)
const savable = computed(() => valid.value && dirty.value)

const inError = (fields: readonly SettingsField[]): boolean => fields.some((field) => errors.value[field] !== undefined)
const basicsRevealed = computed(() => inError(['currency', 'numberLocale', 'reviewLabel', 'cardSettlementIbans']))
const labelsRevealed = computed(() => inError(BUCKETS))
const labelsSummary = computed(() => BUCKETS.map((bucket) => props.settings.bucketLabels[bucket]).join(', '))


const preview = computed(() => {
  if (errors.value.currency !== undefined || errors.value.numberLocale !== undefined) return null
  const format = new Intl.NumberFormat(draft.value.numberLocale, { style: 'currency', currency: draft.value.currency })
  return `${format.format(1234.56)} and −${format.format(98.7)}`
})

function update<Field extends keyof Settings>(field: Field, value: Settings[Field]): void {
  draft.value = { ...draft.value, [field]: value }
}

/** The path as typed, so a trailing slash survives until the next folder name is written. */
const statementsFolderText = ref(props.settings.statementsFolder.join('/'))
watch(
  () => draft.value.statementsFolder,
  (folders) => {
    if (JSON.stringify(folderPathOf(statementsFolderText.value)) !== JSON.stringify(folders)) {
      statementsFolderText.value = folders.join('/')
    }
  },
)

function updateStatementsFolder(text: string): void {
  statementsFolderText.value = text
  update('statementsFolder', folderPathOf(text))
}

function updateLabel(bucket: DefinedBucket, label: string): void {
  draft.value = { ...draft.value, bucketLabels: { ...draft.value.bucketLabels, [bucket]: label } }
}
</script>

<template>
  <form class="flex flex-col gap-6" @submit.prevent="savable && emit('save', draft, factsDraft)">
    <AppCard
      title="The workbook"
      subtitle="Its name, money, review label and statements folder, from the settings tab."
      collapse-id="settings.workbook"
      summary="The company, the currency, the review label and the statements folder"
      :reveal="basicsRevealed"
    >
      <div class="flex flex-col gap-6 px-4 pt-4 pb-4 sm:px-5 sm:pb-5">
        <div class="grid gap-4 sm:grid-cols-2">
          <UFormField label="Company name" help="Shown under the app name and used in the name of an exported file.">
            <UInput :model-value="draft.companyName" placeholder="Not set" class="w-full" @update:model-value="update('companyName', String($event))" />
          </UFormField>
          <UFormField label="Currency" :error="errors.currency ?? false" help="The money in the ledger. One currency per workbook.">
            <USelectMenu
              :model-value="draft.currency"
              :items="[...CURRENCY_ITEMS]"
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
            help="The bank's card settlement accounts. A row paid to one of them reads as a card purchase."
            class="sm:col-span-2"
            data-testid="card-settlement-ibans"
          >
            <IbanTagsField :model-value="draft.cardSettlementIbans" class="w-full" @update:model-value="update('cardSettlementIbans', $event)" />
          </UFormField>
          <UFormField
            label="Statements folder"
            help="Where Sync looks in Google Drive for the bank’s camt statements, as a path from My Drive with a folder for each year inside. Blank names none, and statements come in through Import."
            class="sm:col-span-2"
            data-testid="statements-folder"
          >
            <UInput
              :model-value="statementsFolderText"
              class="identifier w-full"
              :ui="{ base: 'text-ellipsis' }"
              @update:model-value="updateStatementsFolder(String($event))"
            />
          </UFormField>
        </div>

        <USwitch
          :model-value="draft.statementsSync"
          label="File new statements on sync"
          description="Each sync files the statements of the folder that the ledger lacks. Off, or no folder, leaves statements to Import."
          data-testid="statements-sync"
          @update:model-value="update('statementsSync', $event)"
        />

        <USwitch
          :model-value="draft.ownerPayModule"
          label="Owner-pay module"
          description="Shows owner pay and owner earns. Off hides them, and rows in the owner-pay bucket then count as operating cost, so every total stays the same."
          @update:model-value="update('ownerPayModule', $event)"
        />
      </div>
    </AppCard>

    <MailSettingsCard :settings="draft" :saved="settings" :errors="errors" @update="draft = $event" />

    <component
      :is="packFacts.card"
      v-if="packFacts"
      :facts="factsDraft"
      :saved="facts"
      :errors="factErrors"
      @update="factsDraft = $event"
    />

    <AppCard
      title="Bucket labels"
      subtitle="What each bucket is called on screen. The categories tab keeps the bucket names on the right."
      collapse-id="settings.bucket-labels"
      start-collapsed
      :summary="labelsSummary"
      :reveal="labelsRevealed"
    >
      <div class="grid gap-3 px-4 pt-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 lg:grid-cols-3">
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
    </AppCard>

    <div class="flex flex-wrap items-center gap-2">
      <UButton type="submit" label="Save settings" icon="i-lucide-save" :loading="saving" :disabled="!savable || saving" />
      <UButton label="Discard changes" color="neutral" variant="ghost" :disabled="!dirty || saving" @click="draft = settings" />
    </div>
  </form>
</template>
