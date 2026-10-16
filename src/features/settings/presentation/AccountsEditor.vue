<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { accountCellsOf, accountDraftErrors } from '../domain/accountDrafts'
import type { AccountDraft } from '../domain/accountDrafts'

type Cells = SheetRow['cells']

const props = defineProps<{
  rows: readonly SheetRow[]
  /** Account names ledger rows use, which keep their name. */
  usedNames: ReadonlySet<string>
  /** The workbook's currency, which a blank account currency means. */
  currency: string
  editable: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [cells: Cells[]]
}>()

function draftsOf(rows: readonly SheetRow[]): AccountDraft[] {
  return [...rows]
    .sort((upper, lower) => upper.sheetRow - lower.sheetRow)
    .map((row) => {
      const text = (column: string): string => (row.cells[column] === undefined ? '' : String(row.cells[column]))
      return { sheetRow: row.sheetRow, savedName: text('account'), account: text('account'), iban: text('iban'), currency: text('currency') }
    })
}

const drafts = ref<AccountDraft[]>(draftsOf(props.rows))
watch(
  () => props.rows,
  (rows) => {
    drafts.value = draftsOf(rows)
  },
)

const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(draftsOf(props.rows)))
const errors = computed(() => accountDraftErrors(drafts.value, props.usedNames))

function update(index: number, field: 'account' | 'iban' | 'currency', text: string): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, [field]: text } : draft))
}

function locked(draft: AccountDraft): boolean {
  return draft.savedName !== '' && props.usedNames.has(draft.savedName.trim().toLowerCase())
}

function addAccount(): void {
  drafts.value = [...drafts.value, { sheetRow: null, savedName: '', account: '', iban: '', currency: '' }]
}

function removeNew(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  emit('save', accountCellsOf(drafts.value, new Map(props.rows.map((row) => [row.sheetRow, row.cells]))))
}
</script>

<template>
  <p v-if="!editable && drafts.length === 0" class="px-4 pb-4 text-sm text-muted sm:px-5">The accounts tab is empty.</p>
  <div v-else class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full text-sm">
      <thead>
        <tr>
          <th scope="col" class="text-start">Account</th>
          <th scope="col" class="text-start">IBAN</th>
          <th scope="col" class="text-start">Currency</th>
          <th v-if="editable" scope="col"><span class="sr-only">Remove</span></th>
        </tr>
      </thead>
      <tbody v-if="!editable">
        <tr v-for="draft in drafts" :key="draft.sheetRow ?? draft.account">
          <th scope="row" class="text-start font-normal text-highlighted">{{ draft.account }}</th>
          <td class="identifier text-toned">{{ draft.iban || '–' }}</td>
          <td class="text-muted">{{ draft.currency || currency }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-if="drafts.length === 0">
          <td colspan="4" class="text-muted">No accounts yet. Add the accounts your ledger rows name.</td>
        </tr>
        <tr v-for="(draft, index) in drafts" :key="draft.sheetRow ?? `new-${index}`">
          <td>
            <UInput
              :model-value="draft.account"
              :disabled="locked(draft)"
              :title="locked(draft) ? 'Ledger rows use this account, so it keeps its name' : undefined"
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
              v-if="draft.sheetRow === null"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Remove this new account"
              @click="removeNew(index)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-if="editable" class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
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
