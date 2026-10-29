<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { DATE_FORMATS, profileDraftProblem } from '../domain/importProfile'
import type { ImportProfile } from '../domain/importProfile'

const props = defineProps<{
  /** The header texts of the file's header row. */
  headers: readonly string[]
  accounts: readonly { readonly label: string; readonly value: string }[]
  /** Whether a saved profile of this name is being changed rather than a new one made. */
  editing: boolean
  saving: boolean
}>()

const profile = defineModel<ImportProfile>({ required: true })

const emit = defineEmits<{
  save: []
}>()

/** A select's value for "the file has no such column". Headers are trimmed, so none is a single space. */
const NO_COLUMN = ' '

const columnItems = computed(() => props.headers.map((header) => ({ label: header, value: header })))
const optionalItems = computed(() => [{ label: 'None', value: NO_COLUMN }, ...columnItems.value])
const dateFormatItems = DATE_FORMATS.map((format) => ({ label: format, value: format }))
const decimalItems = [
  { label: 'Comma, 1.234,56', value: 'comma' },
  { label: 'Point, 1,234.56', value: 'point' },
]
const amountKinds = [
  { label: 'One column, money out negative', value: 'signed' },
  { label: 'A debit and a credit column', value: 'split' },
]

const amountKind = computed(() => ('signed' in profile.value.amount ? 'signed' : 'split'))

function update(changes: Partial<ImportProfile>): void {
  profile.value = { ...profile.value, ...changes }
}

function setAmountKind(kind: string): void {
  const current = profile.value.amount
  const first = 'signed' in current ? current.signed : current.debit
  update({ amount: kind === 'signed' ? { signed: first } : { debit: first, credit: 'credit' in current ? current.credit : '' } })
}

type OptionalColumn = 'balance' | 'counterparty' | 'counterpartyIban' | 'description' | 'reference'

const optionalFields: { readonly field: OptionalColumn; readonly label: string }[] = [
  { field: 'balance', label: 'Balance' },
  { field: 'counterparty', label: 'Counterparty' },
  { field: 'counterpartyIban', label: 'Counterparty IBAN' },
  { field: 'description', label: 'Description' },
  { field: 'reference', label: 'Bank reference' },
]

function setOptional(field: OptionalColumn, value: unknown): void {
  update({ [field]: value === NO_COLUMN ? '' : String(value) })
}

const problem = computed(() => profileDraftProblem(profile.value))
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="profile-editor">
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField label="Profile name" help="Saved on the settings tab, so it follows the workbook.">
        <UInput
          :model-value="profile.name"
          :disabled="editing"
          placeholder="otp-business"
          class="w-full"
          data-testid="profile-name"
          @update:model-value="update({ name: String($event).trim().toLowerCase() })"
        />
      </UFormField>
      <UFormField label="Account">
        <USelect
          :model-value="profile.account"
          :items="[...accounts]"
          placeholder="Choose an account"
          class="w-full"
          data-testid="profile-account"
          @update:model-value="update({ account: String($event) })"
        />
      </UFormField>
      <UFormField label="Date column">
        <USelect :model-value="profile.date" :items="columnItems" placeholder="Choose a column" class="w-full" data-testid="profile-date" @update:model-value="update({ date: String($event) })" />
      </UFormField>
      <UFormField label="Dates written as" help="A date cell reads as a date whatever this says.">
        <USelect :model-value="profile.dateFormat" :items="dateFormatItems" class="w-full" @update:model-value="update({ dateFormat: $event as ImportProfile['dateFormat'] })" />
      </UFormField>
      <UFormField label="Decimal mark" help="For amounts written as text.">
        <USelect :model-value="profile.decimal" :items="decimalItems" class="w-full" @update:model-value="update({ decimal: $event as ImportProfile['decimal'] })" />
      </UFormField>
      <UFormField label="Amounts">
        <URadioGroup :model-value="amountKind" :items="amountKinds" @update:model-value="setAmountKind(String($event))" />
      </UFormField>
      <template v-if="'signed' in profile.amount">
        <UFormField label="Amount column">
          <USelect :model-value="profile.amount.signed" :items="columnItems" placeholder="Choose a column" class="w-full" @update:model-value="update({ amount: { signed: String($event) } })" />
        </UFormField>
      </template>
      <template v-else>
        <UFormField label="Debit column, money out">
          <USelect
            :model-value="profile.amount.debit"
            :items="columnItems"
            placeholder="Choose a column"
            class="w-full"
            @update:model-value="update({ amount: { debit: String($event), credit: 'credit' in profile.amount ? profile.amount.credit : '' } })"
          />
        </UFormField>
        <UFormField label="Credit column, money in">
          <USelect
            :model-value="profile.amount.credit"
            :items="columnItems"
            placeholder="Choose a column"
            class="w-full"
            @update:model-value="update({ amount: { debit: 'debit' in profile.amount ? profile.amount.debit : '', credit: String($event) } })"
          />
        </UFormField>
      </template>
      <UFormField v-for="optional in optionalFields" :key="optional.field" :label="optional.label">
        <USelect :model-value="profile[optional.field] || NO_COLUMN" :items="optionalItems" class="w-full" @update:model-value="setOptional(optional.field, $event)" />
      </UFormField>
    </div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <p class="text-sm" :class="problem ? 'text-warning' : 'text-muted'" data-testid="profile-problem">
        {{ problem ?? 'The dry run below reads the file with this profile.' }}
      </p>
      <UButton :label="editing ? 'Save profile' : 'Save new profile'" icon="i-lucide-save" :loading="saving" :disabled="problem !== null || saving" data-testid="profile-save" @click="emit('save')" />
    </div>
  </div>
</template>
