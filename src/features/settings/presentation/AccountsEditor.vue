<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { displayName } from '../../workbook/domain/displayName'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { listInWords } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { ACCOUNT_ROWS } from '../application/workbookTabRows'
import { accountCellsOf, accountDraftErrors } from '../domain/accountDrafts'
import type { AccountDraft } from '../domain/accountDrafts'
import { rowsChangeOf } from '../domain/tabRowDrafts'

const props = defineProps<{
  rows: readonly SheetRow[]
  /** What names each account outside the tab. An account in use keeps its name and its row. */
  uses: SlugUses
  /** The workbook's currency, which a blank account currency means. */
  currency: string
  saving: boolean
}>()

const emit = defineEmits<{
  save: [change: TabRowsChange]
}>()

function draftsOf(rows: readonly SheetRow[]): AccountDraft[] {
  return rows.map((row, saved) => {
    const text = (column: string): string => (row.cells[column] === undefined ? '' : String(row.cells[column]))
    return { saved, savedName: text('account'), account: text('account'), label: text('label'), iban: text('iban'), currency: text('currency') }
  })
}

const drafts = ref<AccountDraft[]>(draftsOf(props.rows))
watch(
  () => props.rows,
  (rows) => {
    drafts.value = draftsOf(rows)
  },
)

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(draftsOf(props.rows)))
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
  const savedCells = new Map(props.rows.map((row, saved) => [saved, row.cells]))
  const opened = draftsOf(props.rows)
  const openedCells = accountCellsOf(opened, savedCells)
  const draftedCells = accountCellsOf(drafts.value, savedCells)
  emit(
    'save',
    rowsChangeOf(
      props.rows,
      ACCOUNT_ROWS.columns,
      drafts.value.map((draft, index) => ({ saved: draft.saved, cells: draftedCells[index]! })),
      new Map(opened.map((_, saved) => [saved, openedCells[saved]!])),
    ),
  )
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
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = draftsOf(rows)" />
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
