<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { BUCKETS } from '../../workbook/domain/bucket'
import { displayName } from '../../workbook/domain/displayName'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { categoryCellsOf, categoryDraftErrors, keepsItsName } from '../domain/categoryDrafts'
import type { CategoryDraft } from '../domain/categoryDrafts'

type Cells = SheetRow['cells']

const props = defineProps<{
  /** The categories tab as stored, broken rows included, so they can be fixed here. */
  rows: readonly SheetRow[]
  /** Category names ledger rows use, which keep their name. */
  usedNames: ReadonlySet<string>
  editable: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [cells: Cells[]]
}>()

function draftsOf(rows: readonly SheetRow[]): CategoryDraft[] {
  return [...rows]
    .sort((upper, lower) => upper.sheetRow - lower.sheetRow)
    .map((row) => {
      const text = (column: string): string => (row.cells[column] === undefined ? '' : String(row.cells[column]))
      return { sheetRow: row.sheetRow, savedName: text('category'), category: text('category'), label: text('label'), family: text('family'), bucket: text('bucket').toLowerCase(), colour: text('colour'), roles: text('roles') }
    })
}

const drafts = ref<CategoryDraft[]>(draftsOf(props.rows))
watch(
  () => props.rows,
  (rows) => {
    drafts.value = draftsOf(rows)
  },
)

const saved = computed(() => JSON.stringify(draftsOf(props.rows)))
const dirty = computed(() => JSON.stringify(drafts.value) !== saved.value)
const errors = computed(() => categoryDraftErrors(drafts.value, props.usedNames))

const bucketItems = BUCKETS.map((bucket): { value: string; label: string } => ({ value: bucket, label: bucket }))

function update(index: number, field: keyof Omit<CategoryDraft, 'sheetRow' | 'savedName'>, text: string): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, [field]: text } : draft))
}

function locked(draft: CategoryDraft): boolean {
  return keepsItsName(draft, drafts.value, props.usedNames)
}

function addCategory(): void {
  drafts.value = [...drafts.value, { sheetRow: null, savedName: '', category: '', label: '', family: '', bucket: 'operating', colour: '', roles: '' }]
}

function removeNew(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  const savedCells = new Map(props.rows.map((row) => [row.sheetRow, row.cells]))
  emit('save', categoryCellsOf(drafts.value, savedCells))
}
</script>

<template>
  <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full text-sm">
      <thead>
        <tr>
          <th scope="col" class="text-start">Category</th>
          <th scope="col" class="text-start">Shown as</th>
          <th scope="col" class="text-start">Family</th>
          <th scope="col" class="text-start">Bucket</th>
          <th scope="col" class="text-start">Colour</th>
          <th scope="col" class="text-start">Roles</th>
          <th v-if="editable" scope="col"><span class="sr-only">Remove</span></th>
        </tr>
      </thead>
      <tbody v-if="!editable">
        <tr v-for="draft in drafts" :key="draft.sheetRow ?? draft.category">
          <th scope="row" class="identifier text-start font-normal text-highlighted">{{ draft.category }}</th>
          <td class="text-toned">{{ displayName(draft.category, draft.label) }}</td>
          <td class="text-toned">{{ draft.family }}</td>
          <td>
            <span class="inline-flex items-center gap-1.5 text-toned">
              <span class="size-2 rounded-[2px]" :style="{ background: `var(--bucket-${draft.bucket})` }" aria-hidden="true" />
              {{ draft.bucket }}
            </span>
          </td>
          <td>
            <span v-if="draft.colour" class="identifier inline-flex items-center gap-1.5 text-muted">
              <span class="size-2.5 rounded-[2px] border border-default" :style="{ background: draft.colour }" aria-hidden="true" />
              {{ draft.colour }}
            </span>
          </td>
          <td class="text-muted">{{ draft.roles }}</td>
        </tr>
      </tbody>
      <tbody v-else>
        <tr v-for="(draft, index) in drafts" :key="draft.sheetRow ?? `new-${index}`">
          <td>
            <UInput
              :model-value="draft.category"
              :disabled="locked(draft)"
              :title="locked(draft) ? 'Ledger rows use this category, so it keeps its name' : undefined"
              :color="errors.get(index)?.category ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.category)"
              aria-label="Category"
              size="sm"
              class="w-44"
              @update:model-value="update(index, 'category', String($event))"
            />
            <p v-if="errors.get(index)?.category" class="field-error">{{ errors.get(index)?.category }}</p>
          </td>
          <td>
            <UInput
              :model-value="draft.label"
              :placeholder="displayName(draft.category)"
              aria-label="Shown as"
              size="sm"
              class="w-44"
              @update:model-value="update(index, 'label', String($event))"
            />
          </td>
          <td>
            <UInput
              :model-value="draft.family"
              :color="errors.get(index)?.family ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.family)"
              aria-label="Family"
              size="sm"
              class="w-32"
              @update:model-value="update(index, 'family', String($event))"
            />
            <p v-if="errors.get(index)?.family" class="field-error">{{ errors.get(index)?.family }}</p>
          </td>
          <td>
            <USelect
              :model-value="draft.bucket"
              :items="bucketItems"
              :color="errors.get(index)?.bucket ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.bucket)"
              :placeholder="draft.bucket || 'Choose'"
              aria-label="Bucket"
              size="sm"
              class="w-52"
              @update:model-value="update(index, 'bucket', String($event))"
            />
            <p v-if="errors.get(index)?.bucket" class="field-error">{{ errors.get(index)?.bucket }}</p>
          </td>
          <td>
            <UInput :model-value="draft.colour" placeholder="#hex" aria-label="Colour" size="sm" class="w-28" @update:model-value="update(index, 'colour', String($event))">
              <template #leading>
                <span class="size-3 rounded-[2px] border border-default" :style="{ background: draft.colour || 'transparent' }" aria-hidden="true" />
              </template>
            </UInput>
          </td>
          <td>
            <UInput :model-value="draft.roles" aria-label="Roles, comma separated" size="sm" class="w-40" @update:model-value="update(index, 'roles', String($event))" />
          </td>
          <td>
            <UButton
              v-if="draft.sheetRow === null"
              icon="i-lucide-x"
              color="neutral"
              variant="ghost"
              size="xs"
              aria-label="Remove this new category"
              @click="removeNew(index)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div v-if="editable" class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton label="Add category" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addCategory" />
    <span class="flex-1" />
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = draftsOf(rows)" />
    <UButton label="Save categories" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || errors.size > 0 || saving" @click="save" />
  </div>
</template>

<style scoped>
.editor-table td {
  vertical-align: top;
}

.field-error {
  margin-top: 0.25rem;
  max-width: 13rem;
  white-space: normal;
  font-size: 0.75rem;
  color: var(--tone-negative);
}
</style>
