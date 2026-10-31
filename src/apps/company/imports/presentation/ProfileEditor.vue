<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import URadioGroup from '@nuxt/ui/components/RadioGroup.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { DATE_FORMATS, profileDraftProblem } from '../domain/importProfile'
import type { ImportProfile } from '../domain/importProfile'
import { words } from './words'

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
const optionalItems = computed(() => [{ label: words.profile.none, value: NO_COLUMN }, ...columnItems.value])
const dateFormatItems = DATE_FORMATS.map((format) => ({ label: format, value: format }))
const decimalItems = [
  { label: words.profile.comma, value: 'comma' },
  { label: words.profile.point, value: 'point' },
]
const amountKinds = [
  { label: words.profile.signed, value: 'signed' },
  { label: words.profile.split, value: 'split' },
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
  { field: 'balance', label: words.profile.balance },
  { field: 'counterparty', label: words.profile.counterparty },
  { field: 'counterpartyIban', label: words.profile.counterpartyIban },
  { field: 'description', label: words.profile.description },
  { field: 'reference', label: words.profile.reference },
]

function setOptional(field: OptionalColumn, value: unknown): void {
  update({ [field]: value === NO_COLUMN ? '' : String(value) })
}

const problem = computed(() => profileDraftProblem(profile.value))
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="profile-editor">
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField :label="words.profile.name" :help="words.profile.nameHelp">
        <UInput
          :model-value="profile.name"
          :disabled="editing"
          placeholder="otp-business"
          class="w-full"
          data-testid="profile-name"
          @update:model-value="update({ name: String($event).trim().toLowerCase() })"
        />
      </UFormField>
      <UFormField :label="words.profile.account">
        <USelect
          :model-value="profile.account"
          :items="[...accounts]"
          :placeholder="words.profile.chooseAccount"
          class="w-full"
          data-testid="profile-account"
          @update:model-value="update({ account: String($event) })"
        />
      </UFormField>
      <UFormField :label="words.profile.date">
        <USelect
          :model-value="profile.date"
          :items="columnItems"
          :placeholder="words.profile.chooseColumn"
          class="w-full"
          data-testid="profile-date"
          @update:model-value="update({ date: String($event) })"
        />
      </UFormField>
      <UFormField :label="words.profile.dateFormat" :help="words.profile.dateFormatHelp">
        <USelect :model-value="profile.dateFormat" :items="dateFormatItems" class="w-full" @update:model-value="update({ dateFormat: $event as ImportProfile['dateFormat'] })" />
      </UFormField>
      <UFormField :label="words.profile.decimal" :help="words.profile.decimalHelp">
        <USelect :model-value="profile.decimal" :items="decimalItems" class="w-full" @update:model-value="update({ decimal: $event as ImportProfile['decimal'] })" />
      </UFormField>
      <UFormField :label="words.profile.amounts">
        <URadioGroup :model-value="amountKind" :items="amountKinds" @update:model-value="setAmountKind(String($event))" />
      </UFormField>
      <template v-if="'signed' in profile.amount">
        <UFormField :label="words.profile.amount">
          <USelect
            :model-value="profile.amount.signed"
            :items="columnItems"
            :placeholder="words.profile.chooseColumn"
            class="w-full"
            @update:model-value="update({ amount: { signed: String($event) } })"
          />
        </UFormField>
      </template>
      <template v-else>
        <UFormField :label="words.profile.debit">
          <USelect
            :model-value="profile.amount.debit"
            :items="columnItems"
            :placeholder="words.profile.chooseColumn"
            class="w-full"
            @update:model-value="update({ amount: { debit: String($event), credit: 'credit' in profile.amount ? profile.amount.credit : '' } })"
          />
        </UFormField>
        <UFormField :label="words.profile.credit">
          <USelect
            :model-value="profile.amount.credit"
            :items="columnItems"
            :placeholder="words.profile.chooseColumn"
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
        {{ problem ?? words.profile.reads }}
      </p>
      <UButton
        :label="editing ? words.profile.save : words.profile.saveNew"
        icon="i-lucide-save"
        :loading="saving"
        :disabled="problem !== null || saving"
        data-testid="profile-save"
        @click="emit('save')"
      />
    </div>
  </div>
</template>
