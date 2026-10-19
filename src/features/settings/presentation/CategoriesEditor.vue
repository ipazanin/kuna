<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { BUCKETS } from '../../workbook/domain/bucket'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { listInWords } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { VAT_TREATMENTS } from '../../workbook/domain/vatTreatment'
import { displayName } from '../../workbook/domain/displayName'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { CATEGORY_ROWS } from '../application/workbookTabRows'
import { categoryCellsOf, categoryDraftErrors, keepsItsName } from '../domain/categoryDrafts'
import type { CategoryDraft } from '../domain/categoryDrafts'
import { rowsChangeOf } from '../domain/tabRowDrafts'

const props = defineProps<{
  /** The categories tab as stored, broken rows included, so they can be fixed here. */
  rows: readonly SheetRow[]
  /** What names each category outside the tab. A category in use keeps its name and its row. */
  uses: SlugUses
  saving: boolean
}>()

const emit = defineEmits<{
  save: [change: TabRowsChange]
}>()

function draftsOf(rows: readonly SheetRow[]): CategoryDraft[] {
  return [...rows]
    .sort((upper, lower) => upper.sheetRow - lower.sheetRow)
    .map((row) => {
      const text = (column: string): string => (row.cells[column] === undefined ? '' : String(row.cells[column]))
      return { sheetRow: row.sheetRow, savedName: text('category'), category: text('category'), label: text('label'), family: text('family'), bucket: text('bucket').toLowerCase(), colour: text('colour'), roles: text('roles'), vat: text('vat').toLowerCase() }
    })
}

const drafts = ref<CategoryDraft[]>(draftsOf(props.rows))
watch(
  () => props.rows,
  (rows) => {
    drafts.value = draftsOf(rows)
  },
)

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(draftsOf(props.rows)))
const errors = computed(() => categoryDraftErrors(drafts.value, usedNames.value))

const bucketItems = BUCKETS.map((bucket): { value: string; label: string } => ({ value: bucket, label: bucket }))
const vatItems = VAT_TREATMENTS.map((treatment): { value: string; label: string } => ({ value: treatment, label: treatment }))

function update(index: number, field: keyof Omit<CategoryDraft, 'sheetRow' | 'savedName'>, text: string): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, [field]: text } : draft))
}

function locked(draft: CategoryDraft): boolean {
  return keepsItsName(draft, drafts.value, usedNames.value)
}

function inUse(draft: CategoryDraft): string {
  return `Used by ${listInWords(props.uses.get(draft.savedName.trim().toLowerCase()) ?? [])}, so it keeps its name and its row`
}

function addCategory(): void {
  drafts.value = [...drafts.value, { sheetRow: null, savedName: '', category: '', label: '', family: '', bucket: 'operating', colour: '', roles: '', vat: '' }]
}

function remove(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  const savedCells = new Map(props.rows.map((row) => [row.sheetRow, row.cells]))
  const opened = draftsOf(props.rows)
  const openedCells = categoryCellsOf(opened, savedCells)
  const draftedCells = categoryCellsOf(drafts.value, savedCells)
  emit(
    'save',
    rowsChangeOf(
      props.rows,
      CATEGORY_ROWS.columns,
      drafts.value.map((draft, index) => ({ sheetRow: draft.sheetRow, cells: draftedCells[index]! })),
      new Map(opened.map((draft, index) => [draft.sheetRow!, openedCells[index]!])),
    ),
  )
}
</script>

<template>
  <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full text-sm" data-testid="categories-editor">
      <thead>
        <tr>
          <th scope="col" class="text-start">Category</th>
          <th scope="col" class="text-start">Shown as</th>
          <th scope="col" class="text-start">Family</th>
          <th scope="col" class="text-start">Bucket</th>
          <th scope="col" class="text-start">Colour</th>
          <th scope="col" class="text-start">Roles</th>
          <th scope="col" class="text-start">VAT</th>
          <th scope="col"><span class="sr-only">Delete</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(draft, index) in drafts" :key="draft.sheetRow ?? `new-${index}`" data-testid="category-row">
          <td>
            <UInput
              :model-value="draft.category"
              :disabled="locked(draft)"
              :title="locked(draft) ? inUse(draft) : undefined"
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
            <USelect
              :model-value="draft.vat || 'none'"
              :items="vatItems"
              :color="errors.get(index)?.vat ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.vat)"
              aria-label="VAT"
              size="sm"
              class="w-44"
              @update:model-value="update(index, 'vat', String($event))"
            />
            <p v-if="errors.get(index)?.vat" class="field-error">{{ errors.get(index)?.vat }}</p>
          </td>
          <td>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="locked(draft)"
              :title="locked(draft) ? inUse(draft) : undefined"
              :aria-label="draft.sheetRow === null ? 'Remove this new category' : `Delete ${draft.savedName || 'this category'}`"
              data-testid="remove-category"
              @click="remove(index)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton label="Add category" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="add-category" @click="addCategory" />
    <span class="flex-1" />
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = draftsOf(rows)" />
    <UButton label="Save categories" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || errors.size > 0 || saving" data-testid="save-categories" @click="save" />
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
