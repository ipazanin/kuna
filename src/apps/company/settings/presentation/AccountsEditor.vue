<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { listInWords } from '../../../../shared/text/listInWords'
import { displayName } from '../../workbook/domain/displayName'
import type { SlugUses } from '../../workbook/domain/slug'
import type { AccountRecord } from '../../workbook/domain/accountsReading'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { accountDraftErrors, accountDraftsOf, accountsOfDrafts } from '../domain/accountDrafts'
import type { AccountDraft } from '../domain/accountDrafts'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'

const props = defineProps<{
  /** The accounts as stored, refused ones included, so they can be fixed here. */
  records: RecordsRead<AccountRecord>
  /** What names each account outside the tab. An account in use keeps its name and its row. */
  uses: SlugUses
  /** The workbook's currency, which a blank account currency means. */
  currency: string
  saving: boolean
}>()

const emit = defineEmits<{
  save: [made: readonly { readonly saved: number | null; readonly record: AccountRecord }[]]
}>()


const stored = computed(() => storedOf(props.records))
const drafts = ref<AccountDraft[]>(accountDraftsOf(stored.value))
watch(stored, (records) => {
  drafts.value = accountDraftsOf(records)
})

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(accountDraftsOf(stored.value)))
const errors = computed(() => accountDraftErrors(drafts.value, usedNames.value))

function update(index: number, field: 'account' | 'label' | 'iban' | 'currency', text: string): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, [field]: text } : draft))
}

function locked(draft: AccountDraft): boolean {
  return draft.savedName !== '' && usedNames.value.has(draft.savedName.trim().toLowerCase())
}

function inUse(draft: AccountDraft): string {
  return `Used by ${listInWords(props.uses.get(draft.savedName.trim().toLowerCase()) ?? [])}, so it keeps its name and its row`
}

function addAccount(): void {
  drafts.value = [...drafts.value, { saved: null, savedName: '', account: '', label: '', iban: '', currency: '' }]
}

function remove(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  const made = accountsOfDrafts(stored.value, drafts.value)
  const records = made.flatMap((draft) => ('record' in draft ? [draft] : []))
  // A draft its kind refuses is shown with its error, so a save never leaves it out.
  if (records.length === made.length) emit('save', records)
}
</script>

<template>
  <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full text-sm" data-testid="accounts-editor">
      <thead>
        <tr>
          <th scope="col" class="text-start">Account</th>
          <th scope="col" class="text-start">Shown as</th>
          <th scope="col" class="text-start">IBAN</th>
          <th scope="col" class="text-start">Currency</th>
          <th scope="col"><span class="sr-only">Delete</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="drafts.length === 0">
          <td colspan="5" class="text-muted">No accounts yet. Add the accounts your ledger rows name.</td>
        </tr>
        <tr v-for="(draft, index) in drafts" :key="draft.saved ?? `new-${index}`" data-testid="account-row">
          <td>
            <UInput
              :model-value="draft.account"
              :disabled="locked(draft)"
              :title="locked(draft) ? inUse(draft) : undefined"
              :color="errors.get(index)?.account ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.account)"
              aria-label="Account"
              size="sm"
              class="w-40"
              @update:model-value="update(index, 'account', String($event))"
            />
            <p v-if="errors.get(index)?.account" class="field-error">{{ errors.get(index)?.account }}</p>
          </td>
          <td>
            <UInput
              :model-value="draft.label"
              :placeholder="displayName(draft.account)"
              aria-label="Shown as"
              size="sm"
              class="w-40"
              @update:model-value="update(index, 'label', String($event))"
            />
          </td>
          <td>
            <UInput :model-value="draft.iban" aria-label="IBAN" size="sm" class="identifier w-64" @update:model-value="update(index, 'iban', String($event))" />
          </td>
          <td>
            <UInput
              :model-value="draft.currency"
              :placeholder="currency"
              :color="errors.get(index)?.currency ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.currency)"
              aria-label="Currency"
              size="sm"
              class="w-24"
              @update:model-value="update(index, 'currency', String($event).toUpperCase())"
            />
            <p v-if="errors.get(index)?.currency" class="field-error">{{ errors.get(index)?.currency }}</p>
          </td>
          <td>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="locked(draft)"
              :title="locked(draft) ? inUse(draft) : undefined"
              :aria-label="draft.saved === null ? 'Remove this new account' : `Delete ${draft.savedName || 'this account'}`"
              @click="remove(index)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton label="Add account" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addAccount" />
    <span class="flex-1" />
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = accountDraftsOf(stored)" />
    <UButton label="Save accounts" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || errors.size > 0 || saving" @click="save" />
  </div>
</template>

<style scoped>
.editor-table td {
  vertical-align: top;
}

.field-error {
  margin-top: 0.25rem;
  max-width: 16rem;
  white-space: normal;
  font-size: 0.75rem;
  color: var(--tone-negative);
}
</style>
