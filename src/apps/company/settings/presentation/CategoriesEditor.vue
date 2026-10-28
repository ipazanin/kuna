<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { bucketTone } from '../../../../shared/charts/chartTokens'
import { listInWords } from '../../../../shared/text/listInWords'
import ColourSwatchPicker from '../../../../shared/ui/ColourSwatchPicker.vue'
import SortableHeader from '../../../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../../../shared/ui/SortableHeader.vue'
import { BUCKETS } from '../../workbook/domain/bucket'
import { SWATCHES, swatchOf } from '../../workbook/domain/categoryColour'
import type { SlugUses } from '../../workbook/domain/slug'
import { VAT_TREATMENTS } from '../../workbook/domain/vatTreatment'
import { displayName } from '../../workbook/domain/displayName'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { categoriesOfDrafts, categoryDraftErrors, categoryDraftsOf, keepsItsName, pickedColour } from '../domain/categoryDrafts'
import type { CategoryDraft } from '../domain/categoryDrafts'
import { NO_FILTERS, categoryListing, matchesFilters } from '../domain/categoryListing'
import type { CategoryFilters, CategorySort, CategorySortColumn } from '../domain/categoryListing'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import { swatchToken } from '../../workbook/presentation/categoryColours'
import CategoryFilterBar from './CategoryFilterBar.vue'
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
const baseline = computed(() => categoryDraftsOf(stored.value))
const drafts = ref<CategoryDraft[]>([...baseline.value])

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(baseline.value))
const errors = computed(() => categoryDraftErrors(drafts.value, usedNames.value, props.roles, props.shares))

const filters = ref<CategoryFilters>(NO_FILTERS)
const sort = ref<CategorySort | null>(null)

/**
 * The positions of the drafts on screen, in their order. Typing never moves or hides a row. Only a
 * change of the filters or the sort, or a reload of the tab, lists the drafts again.
 */
const listed = ref<number[]>([])

function unsaved(draft: CategoryDraft): boolean {
  return draft.saved === null || JSON.stringify(draft) !== JSON.stringify(baseline.value[draft.saved])
}

function relist(): void {
  listed.value = categoryListing(
    drafts.value.map((draft, position) => ({ draft, unsaved: unsaved(draft), inError: errors.value.has(position) })),
    filters.value,
    sort.value,
  )
}

relist()
watch([filters, sort], relist)
watch(baseline, (reloaded) => {
  drafts.value = [...reloaded]
  relist()
})

/** A row that another row's change puts in error while the filters hide it, such as a name taken twice, joins the foot of the list. */
watch(errors, (found) => {
  const hidden = [...found.keys()].filter((position) => !listed.value.includes(position))
  if (hidden.length > 0) listed.value = [...listed.value, ...hidden]
})

const rows = computed(() => listed.value.map((index) => ({ index, draft: drafts.value[index]! })))

/** The rows on screen that no longer match the filters, shown for their unsaved change or error. */
const kept = computed(() => rows.value.filter(({ draft }) => !matchesFilters({ draft, unsaved: unsaved(draft), inError: false }, filters.value)).length)

function directionOf(column: CategorySortColumn): SortDirection | null {
  return sort.value?.column !== column ? null : sort.value.descending ? 'descending' : 'ascending'
}

function sortBy(column: CategorySortColumn, direction: SortDirection | null): void {
  sort.value = direction === null ? null : { column, descending: direction === 'descending' }
}

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

const body = useTemplateRef<HTMLElement>('body')

/** A new row joins the foot of the list, scrolled into view with its name field focused. */
async function addCategory(): Promise<void> {
  drafts.value = [...drafts.value, { saved: null, savedName: '', category: '', label: '', family: '', bucket: 'operating', colour: '', roles: '', vat: '', ownerShare: '' }]
  const added = drafts.value.length - 1
  listed.value = [...listed.value, added]
  await nextTick()
  const row = body.value?.querySelector<HTMLElement>(`[data-position="${added}"]`)
  row?.scrollIntoView({ block: 'nearest' })
  row?.querySelector('input')?.focus({ preventScroll: true })
}

function remove(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
  listed.value = listed.value.filter((position) => position !== index).map((position) => (position > index ? position - 1 : position))
}

function discard(): void {
  drafts.value = [...baseline.value]
  relist()
}

function save(): void {
  const made = categoriesOfDrafts(stored.value, drafts.value)
  const records = made.flatMap((draft) => ('record' in draft ? [draft] : []))
  // A draft its kind refuses is shown with its error, so a save never leaves it out.
  if (records.length === made.length) emit('save', records)
}
</script>

<template>
  <CategoryFilterBar v-model="filters" :roles="roles" :shares="shares" :shown="rows.length" :total="drafts.length" :kept="kept" />
  <div class="table-frame relative mx-1 my-2 sm:mx-2" data-testid="categories-frame">
    <table class="data-table editor-table w-full text-sm" data-testid="categories-editor">
      <thead>
        <tr>
          <SortableHeader label="Category" :model-value="directionOf('category')" @update:model-value="sortBy('category', $event)" />
          <SortableHeader label="Shown as" :model-value="directionOf('label')" @update:model-value="sortBy('label', $event)" />
          <SortableHeader label="Family" :model-value="directionOf('family')" @update:model-value="sortBy('family', $event)" />
          <SortableHeader label="Bucket" :model-value="directionOf('bucket')" @update:model-value="sortBy('bucket', $event)" />
          <th scope="col" class="text-start">Colour</th>
          <SortableHeader label="Roles" :model-value="directionOf('roles')" @update:model-value="sortBy('roles', $event)" />
          <SortableHeader label="VAT" :model-value="directionOf('vat')" @update:model-value="sortBy('vat', $event)" />
          <SortableHeader v-if="shares" label="Owner share" :model-value="directionOf('ownerShare')" @update:model-value="sortBy('ownerShare', $event)" />
          <th scope="col"><span class="sr-only">Delete</span></th>
        </tr>
      </thead>
      <tbody ref="body">
        <tr v-if="rows.length === 0 && drafts.length > 0">
          <td :colspan="shares ? 9 : 8" class="py-6 text-muted" data-testid="no-category-matches">
            No category matches these filters.
            <UButton label="Clear filters" color="neutral" variant="link" size="sm" class="inline-target" @click="filters = NO_FILTERS" />
          </td>
        </tr>
        <tr v-for="{ index, draft } in rows" :key="draft.saved ?? `new-${index}`" :data-position="index" data-testid="category-row">
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
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="discard" />
    <UButton label="Save categories" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || errors.size > 0 || saving" data-testid="save-categories" @click="save" />
  </div>
</template>

<style scoped>
/*
 * The table scrolls inside the card under its own header, so a long tab never grows the page. The
 * page header, the tabs, the card's header and the filters take about 21rem above it and Save 4rem
 * below, so the whole card fits the window at the top of the page. On a 900 px laptop screen that
 * leaves the 24rem floor, seven rows. On a phone the top bar and the tab row stay on screen, so
 * the table takes what the window leaves under them and above Add and Save, its header in view.
 */
.table-frame {
  max-height: max(24rem, calc(100dvh - 25rem));
  overflow: auto;
  overscroll-behavior: contain;
}

@media (max-width: 639px) {
  .table-frame {
    max-height: max(18rem, calc(100dvh - 22rem));
  }
}

.editor-table thead th {
  position: sticky;
  top: 0;
  z-index: 2;
  background: var(--surface-raised);
  border-bottom: 0;
  box-shadow: inset 0 -1px 0 var(--border-default);
}

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
