<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { bucketTone } from '../../../shared/charts/chartTokens'
import ColourSwatchPicker from '../../../shared/ui/ColourSwatchPicker.vue'
import { BUCKETS } from '../../workbook/domain/bucket'
import { SWATCHES, swatchOf } from '../../workbook/domain/categoryColour'
import { listInWords } from '../../workbook/domain/slug'
import type { SlugUses } from '../../workbook/domain/slug'
import { VAT_TREATMENTS } from '../../workbook/domain/vatTreatment'
import { displayName } from '../../workbook/domain/displayName'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { RecordsRead } from '../../workbook/domain/recordsRead'
import { categoriesOfDrafts, categoryDraftErrors, categoryDraftsOf, keepsItsName, pickedColour } from '../domain/categoryDrafts'
import type { CategoryDraft } from '../domain/categoryDrafts'
import { storedOf } from '../../workbook/domain/recordsRead'
import { swatchToken } from '../../workbook/presentation/categoryColours'
import RolesSelect from './RolesSelect.vue'

const props = defineProps<{
  /** The categories as stored, refused ones included, so they can be fixed here. */
  records: RecordsRead<CategoryRecord>
  /** What names each category outside the tab. A category in use keeps its name and its row. */
  uses: SlugUses
  /** The roles core and the pack pick categories by. */
  roles: readonly string[]
  /** Whether the owner share shows, which it does while the owner-pay module is on. */
  shares: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [made: readonly { readonly saved: number | null; readonly record: CategoryRecord }[]]
}>()

const stored = computed(() => storedOf(props.records))
const drafts = ref<CategoryDraft[]>(categoryDraftsOf(stored.value))
watch(stored, (records) => {
  drafts.value = categoryDraftsOf(records)
})

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(categoryDraftsOf(stored.value)))
const errors = computed(() => categoryDraftErrors(drafts.value, usedNames.value, props.roles, props.shares))

const bucketItems = BUCKETS.map((bucket): { value: string; label: string } => ({ value: bucket, label: bucket }))
const vatItems = VAT_TREATMENTS.map((treatment): { value: string; label: string } => ({ value: treatment, label: treatment }))

function update(index: number, field: keyof Omit<CategoryDraft, 'saved' | 'savedName'>, text: string): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, [field]: text } : draft))
}

const swatchChoices = SWATCHES.map((swatch) => ({ value: swatch.hex, name: swatch.name, token: swatchToken(swatch) }))

function shownName(draft: CategoryDraft): string {
  return displayName(draft.category.trim().toLowerCase(), draft.label)
}

/** The other categories of the row's bucket that wear the colour it now has, named so a repeat is a choice. */
function colourNote(index: number): string {
  const draft = drafts.value[index]!
  const swatch = swatchOf(draft.colour)
  if (swatch === null) {
    return `The ${draft.bucket} bucket's colour.`
  }
  const others = drafts.value.filter((other, position) => position !== index && other.bucket === draft.bucket && swatchOf(other.colour) === swatch).map(shownName)
  return others.length === 0 ? `${swatch.name}. No other ${draft.bucket} category uses it.` : `${swatch.name}. Also used by ${listInWords(others)}.`
}

function locked(draft: CategoryDraft): boolean {
  return keepsItsName(draft, drafts.value, usedNames.value)
}

function inUse(draft: CategoryDraft): string {
  return `Used by ${listInWords(props.uses.get(draft.savedName.trim().toLowerCase()) ?? [])}, so it keeps its name and its row`
}

function addCategory(): void {
  drafts.value = [...drafts.value, { saved: null, savedName: '', category: '', label: '', family: '', bucket: 'operating', colour: '', roles: '', vat: '', ownerShare: '' }]
}

function remove(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  const made = categoriesOfDrafts(stored.value, drafts.value)
  const records = made.flatMap((draft) => ('record' in draft ? [draft] : []))
  // A draft its kind refuses is shown with its error, so a save never leaves it out.
  if (records.length === made.length) emit('save', records)
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
          <th v-if="shares" scope="col" class="text-start">Owner share</th>
          <th scope="col"><span class="sr-only">Delete</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(draft, index) in drafts" :key="draft.saved ?? `new-${index}`" data-testid="category-row">
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
            <ColourSwatchPicker
              :model-value="draft.colour"
              :title="`Colour of ${shownName(draft) || 'this category'}`"
              :blank="{ name: 'Bucket colour', token: `--bucket-${bucketTone(draft.bucket)}` }"
              :swatches="swatchChoices"
              :note="colourNote(index)"
              @update:model-value="update(index, 'colour', pickedColour(draft, $event, stored))"
            />
          </td>
          <td>
            <RolesSelect :model-value="draft.roles" :known="roles" :error="errors.get(index)?.roles" @update:model-value="update(index, 'roles', $event)" />
            <p v-if="errors.get(index)?.roles" class="field-error">{{ errors.get(index)?.roles }}</p>
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
          <td v-if="shares">
            <template v-if="draft.bucket === 'operating' || draft.ownerShare.trim() !== ''">
              <UInput
                :model-value="draft.ownerShare"
                :color="errors.get(index)?.ownerShare ? 'error' : 'neutral'"
                :highlight="Boolean(errors.get(index)?.ownerShare)"
                inputmode="numeric"
                aria-label="Owner share, in percent"
                size="sm"
                class="w-24"
                data-testid="category-owner-share"
                @update:model-value="update(index, 'ownerShare', String($event))"
              >
                <template #trailing><span class="text-muted">%</span></template>
              </UInput>
              <p v-if="errors.get(index)?.ownerShare" class="field-error">{{ errors.get(index)?.ownerShare }}</p>
            </template>
            <span v-else class="inline-block px-2 py-1 text-muted" title="Only an operating category holds a share">–</span>
          </td>
          <td>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="locked(draft)"
              :title="locked(draft) ? inUse(draft) : undefined"
              :aria-label="draft.saved === null ? 'Remove this new category' : `Delete ${draft.savedName || 'this category'}`"
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
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = categoryDraftsOf(stored)" />
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
