<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { bucketTone } from '../../../../shared/charts/chartTokens'
import { listInWords } from '../../../../shared/text/listInWords'
import ColourSwatchPicker from '../../../../shared/ui/ColourSwatchPicker.vue'
import DrillLink from '../../../../shared/ui/DrillLink.vue'
import SortableHeader from '../../../../shared/ui/SortableHeader.vue'
import type { SortDirection } from '../../../../shared/ui/SortableHeader.vue'
import type { CategoryClassHelp } from '../../packs/packContribution'
import { BUCKETS } from '../../workbook/domain/bucket'
import type { DefinedBucket } from '../../workbook/domain/bucket'
import type { CategoryClass } from '../../workbook/domain/packPart'
import { SWATCHES, swatchOf, swatchToken } from '../../../../shared/charts/swatches'
import type { SlugUses } from '../../workbook/domain/slug'
import { VAT_TREATMENTS, vatCell } from '../../workbook/domain/vatTreatment'
import type { VatTreatment } from '../../workbook/domain/vatTreatment'
import { displayName } from '../../workbook/domain/displayName'
import type { CategoryRecord } from '../../workbook/domain/categoriesReading'
import type { RecordsRead } from '../../../../shared/storage/domain/recordsRead'
import { classOf } from '../domain/categoryClasses'
import { categoriesOfDrafts, categoryDraftErrors, categoryDraftsOf, keepsItsName, pickedColour, rolesOfText } from '../domain/categoryDrafts'
import { categoryClassMessages } from './categoryClassMessages'
import { vatTreatmentLabel } from './vatTreatmentLabel'
import type { CategoryDraft } from '../domain/categoryDrafts'
import { NO_FILTERS, categoryListing, matchesFilters } from '../domain/categoryListing'
import type { CategoryFilters, CategorySort, CategorySortColumn } from '../domain/categoryListing'
import { storedOf } from '../../../../shared/storage/domain/recordsRead'
import CategoryFilterBar from './CategoryFilterBar.vue'
import RolesSelect from './RolesSelect.vue'
import { words } from './words'

const props = defineProps<{
  /** The categories as stored, refused ones included, so they can be fixed here. */
  records: RecordsRead<CategoryRecord>
  /** What names each category outside the tab. A category in use keeps its name, and deleting it moves what names it to another. */
  uses: SlugUses
  /** The roles core and the pack pick categories by. */
  roles: readonly string[]
  /** The pack's classes, one of which each category carries among its roles. None hides the column. */
  classes: readonly CategoryClass[]
  /** What the editor says under a class: its sentence and the rule it rests on. */
  classHelp: (role: string) => CategoryClassHelp | null
  /** Whether the owner share shows, which it does while the owner-pay module is on. */
  shares: boolean
  saving: boolean
}>()

const emit = defineEmits<{
  save: [made: readonly { readonly saved: number | null; readonly record: CategoryRecord }[]]
  /** A category in use, by its name as saved, to delete with what names it moved to another. */
  moveAndDelete: [slug: string]
}>()

const stored = computed(() => storedOf(props.records))
const baseline = computed(() => categoryDraftsOf(stored.value))
const drafts = ref<CategoryDraft[]>([...baseline.value])

const usedNames = computed(() => new Set(props.uses.keys()))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(baseline.value))
const classMessages = computed(() =>
  categoryClassMessages(drafts.value, baseline.value, props.classes, {
    className: (role) => props.classHelp(role)?.name ?? role,
    treatment: vatTreatmentLabel,
    bucket: words.categories.bucketChoice,
  }),
)
/** The field errors of the rows, a field's own error before what its tax class says. */
const errors = computed(() => {
  const found = categoryDraftErrors(drafts.value, usedNames.value, props.roles, props.shares)
  return new Map(
    drafts.value.flatMap((_, index) => {
      const merged = { ...classMessages.value.errors.get(index), ...found.get(index) }
      return Object.keys(merged).length === 0 ? [] : [[index, merged] as const]
    }),
  )
})
const hints = computed(() => classMessages.value.hints)

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

const rows = computed(() =>
  listed.value.map((index) => {
    const draft = drafts.value[index]!
    const taxClass = classOf(rolesOfText(draft.roles), props.classes)
    return { index, draft, taxClass, help: taxClass === null ? null : props.classHelp(taxClass.role) }
  }),
)

/** The rows on screen that no longer match the filters, shown for their unsaved change or error. */
const kept = computed(() => rows.value.filter(({ draft }) => !matchesFilters({ draft, unsaved: unsaved(draft), inError: false }, filters.value)).length)

function directionOf(column: CategorySortColumn): SortDirection | null {
  return sort.value?.column !== column ? null : sort.value.descending ? 'descending' : 'ascending'
}

function sortBy(column: CategorySortColumn, direction: SortDirection | null): void {
  sort.value = direction === null ? null : { column, descending: direction === 'descending' }
}

const classRoles = computed(() => new Set(props.classes.map((taxClass) => taxClass.role)))
const modifiers = computed(() => props.roles.filter((role) => !classRoles.value.has(role)))

/** The draft's value as one of the choices, a value the choices lack, such as a contradiction the file holds, offered too so the field shows it. */
function withValue(choices: readonly string[], value: string): string[] {
  return value === '' || choices.includes(value) ? [...choices] : [...choices, value]
}

/** The classes that may sit in the row's bucket, and the class the row has. */
function classItems(draft: CategoryDraft, taxClass: CategoryClass | null): { value: string; label: string }[] {
  const bucket = draft.bucket.trim().toLowerCase()
  const fitting = props.classes.filter((taxClass) => (taxClass.buckets as readonly string[]).includes(bucket)).map((taxClass) => taxClass.role)
  return withValue(fitting, taxClass?.role ?? '').map((role) => ({ value: role, label: props.classHelp(role)?.name ?? role }))
}

/** The buckets the row's class allows, or all six while it has none. */
function bucketItems(draft: CategoryDraft, taxClass: CategoryClass | null): { value: string; label: string }[] {
  const allowed: readonly DefinedBucket[] = taxClass?.buckets ?? BUCKETS
  return withValue(allowed, draft.bucket.trim().toLowerCase()).map((bucket) => ({ value: bucket, label: words.categories.bucketChoice(bucket) }))
}

/** The VAT treatments the row's class allows, or all of them while it has none. */
function vatItems(draft: CategoryDraft, taxClass: CategoryClass | null): { value: string; label: string }[] {
  const allowed: readonly VatTreatment[] = taxClass?.vat ?? VAT_TREATMENTS
  return withValue(allowed, draft.vat.trim().toLowerCase() || 'none').map((treatment) => ({ value: treatment, label: vatTreatmentLabel(treatment) }))
}

/** Gives the row the class in place of any other, keeping its other roles, and the one VAT treatment a class with one allows. */
function pickClass(index: number, role: string): void {
  const draft = drafts.value[index]!
  const picked = props.classes.find((taxClass) => taxClass.role === role)
  const kept = rolesOfText(draft.roles).filter((other) => !classRoles.value.has(other))
  drafts.value = drafts.value.map((other, position) =>
    position === index ? { ...other, roles: [role, ...kept].join(', '), vat: picked?.vat.length === 1 ? vatCell(picked.vat[0]!) : other.vat } : other,
  )
}

/** The row's roles that carry no class, which the roles menu edits. */
function modifiersOf(draft: CategoryDraft): string {
  return rolesOfText(draft.roles)
    .filter((role) => !classRoles.value.has(role))
    .join(', ')
}

/** Puts the picked roles beside the row's classes. */
function updateModifiers(index: number, text: string): void {
  const draft = drafts.value[index]!
  const classes = rolesOfText(draft.roles).filter((role) => classRoles.value.has(role))
  update(index, 'roles', [...classes, ...rolesOfText(text)].join(', '))
}

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
    return words.categories.bucketsColour(draft.bucket)
  }
  const others = drafts.value.filter((other, position) => position !== index && other.bucket === draft.bucket && swatchOf(other.colour) === swatch).map(shownName)
  return others.length === 0 ? words.categories.colourAlone(swatch.name, draft.bucket) : words.categories.colourShared(swatch.name, listInWords(others))
}

function locked(draft: CategoryDraft): boolean {
  return keepsItsName(draft, drafts.value, usedNames.value)
}

function inUse(draft: CategoryDraft): string {
  return words.inUse(listInWords(props.uses.get(draft.savedName.trim().toLowerCase()) ?? []))
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

/** A category in use moves what names it to another as it goes, in a write of its own. Any other row leaves with the next save. */
function remove(index: number): void {
  const draft = drafts.value[index]!
  if (locked(draft)) {
    emit('moveAndDelete', draft.savedName.trim().toLowerCase())
    return
  }
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
          <SortableHeader :label="words.categories.columns.category" :model-value="directionOf('category')" @update:model-value="sortBy('category', $event)" />
          <SortableHeader :label="words.categories.columns.label" :model-value="directionOf('label')" @update:model-value="sortBy('label', $event)" />
          <SortableHeader :label="words.categories.columns.family" :model-value="directionOf('family')" @update:model-value="sortBy('family', $event)" />
          <SortableHeader :label="words.categories.columns.bucket" :model-value="directionOf('bucket')" @update:model-value="sortBy('bucket', $event)" />
          <th scope="col" class="text-start">{{ words.categories.columns.colour }}</th>
          <th v-if="classes.length > 0" scope="col" class="text-start">{{ words.categories.columns.countsAs }}</th>
          <SortableHeader :label="words.categories.columns.roles" :model-value="directionOf('roles')" @update:model-value="sortBy('roles', $event)" />
          <SortableHeader :label="words.categories.columns.vat" :model-value="directionOf('vat')" @update:model-value="sortBy('vat', $event)" />
          <SortableHeader v-if="shares" :label="words.categories.columns.ownerShare" :model-value="directionOf('ownerShare')" @update:model-value="sortBy('ownerShare', $event)" />
          <th scope="col">
            <span class="sr-only">{{ words.categories.columns.delete }}</span>
          </th>
        </tr>
      </thead>
      <tbody ref="body">
        <tr v-if="rows.length === 0 && drafts.length > 0">
          <td :colspan="8 + (shares ? 1 : 0) + (classes.length > 0 ? 1 : 0)" class="py-6 text-muted" data-testid="no-category-matches">
            {{ words.categories.noMatch }}
            <UButton :label="words.categories.clearFilters" color="neutral" variant="link" size="sm" class="inline-target" @click="filters = NO_FILTERS" />
          </td>
        </tr>
        <tr v-for="{ index, draft, taxClass, help } in rows" :key="draft.saved ?? `new-${index}`" :data-position="index" data-testid="category-row">
          <td>
            <UInput
              :model-value="draft.category"
              :disabled="locked(draft)"
              :title="locked(draft) ? inUse(draft) : undefined"
              :color="errors.get(index)?.category ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.category)"
              :aria-label="words.categories.columns.category"
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
              :aria-label="words.categories.columns.label"
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
              :aria-label="words.categories.columns.family"
              size="sm"
              class="w-32"
              @update:model-value="update(index, 'family', String($event))"
            />
            <p v-if="errors.get(index)?.family" class="field-error">{{ errors.get(index)?.family }}</p>
          </td>
          <td>
            <USelect
              :model-value="draft.bucket"
              :items="bucketItems(draft, taxClass)"
              :color="errors.get(index)?.bucket ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.bucket)"
              :placeholder="draft.bucket || words.categories.choose"
              :aria-label="words.categories.columns.bucket"
              size="sm"
              class="w-52"
              @update:model-value="update(index, 'bucket', String($event))"
            />
            <p v-if="errors.get(index)?.bucket" class="field-error">{{ errors.get(index)?.bucket }}</p>
            <p v-else-if="hints.get(index)?.bucket" class="field-hint">{{ hints.get(index)?.bucket }}</p>
          </td>
          <td>
            <ColourSwatchPicker
              :model-value="draft.colour"
              :title="words.categories.colourOf(shownName(draft))"
              :blank="{ name: words.categories.bucketColour, token: `--bucket-${bucketTone(draft.bucket)}` }"
              :swatches="swatchChoices"
              :note="colourNote(index)"
              @update:model-value="update(index, 'colour', pickedColour(draft, $event, stored))"
            />
          </td>
          <td v-if="classes.length > 0">
            <USelect
              :model-value="taxClass?.role ?? ''"
              :items="classItems(draft, taxClass)"
              :color="errors.get(index)?.class ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.class)"
              :placeholder="words.categories.pickClass"
              :aria-label="words.categories.columns.countsAs"
              size="sm"
              class="w-60"
              data-testid="category-class"
              @update:model-value="pickClass(index, String($event))"
            />
            <p v-if="errors.get(index)?.class" class="field-error">{{ errors.get(index)?.class }}</p>
            <p v-else-if="hints.get(index)?.class" class="field-hint" data-testid="category-class-hint">{{ hints.get(index)?.class }}</p>
            <template v-else-if="help !== null">
              <p class="field-hint" data-testid="category-class-sentence">{{ help.sentence }}</p>
              <p class="field-hint">
                <DrillLink :to="help.link.to">{{ help.link.label }}</DrillLink>
              </p>
            </template>
          </td>
          <td>
            <RolesSelect :model-value="modifiersOf(draft)" :known="modifiers" :error="errors.get(index)?.roles" @update:model-value="updateModifiers(index, $event)" />
            <p v-if="errors.get(index)?.roles" class="field-error">{{ errors.get(index)?.roles }}</p>
          </td>
          <td>
            <USelect
              :model-value="draft.vat || 'none'"
              :items="vatItems(draft, taxClass)"
              :disabled="taxClass?.vat.length === 1 && !errors.get(index)?.vat && !hints.get(index)?.vat"
              :color="errors.get(index)?.vat ? 'error' : 'neutral'"
              :highlight="Boolean(errors.get(index)?.vat)"
              :aria-label="words.categories.columns.vat"
              size="sm"
              class="w-44"
              data-testid="category-vat"
              @update:model-value="update(index, 'vat', vatCell(String($event)))"
            />
            <p v-if="errors.get(index)?.vat" class="field-error">{{ errors.get(index)?.vat }}</p>
            <p v-else-if="hints.get(index)?.vat" class="field-hint">{{ hints.get(index)?.vat }}</p>
            <p v-else-if="taxClass?.vat.length === 1" class="field-hint">{{ words.categories.vatSet }}</p>
          </td>
          <td v-if="shares">
            <template v-if="draft.bucket === 'operating' || draft.ownerShare.trim() !== ''">
              <UInput
                :model-value="draft.ownerShare"
                :color="errors.get(index)?.ownerShare ? 'error' : 'neutral'"
                :highlight="Boolean(errors.get(index)?.ownerShare)"
                inputmode="numeric"
                :aria-label="words.categories.shareLabel"
                size="sm"
                class="w-24"
                data-testid="category-owner-share"
                @update:model-value="update(index, 'ownerShare', String($event))"
              >
                <template #trailing><span class="text-muted">%</span></template>
              </UInput>
              <p v-if="errors.get(index)?.ownerShare" class="field-error">{{ errors.get(index)?.ownerShare }}</p>
            </template>
            <span v-else class="inline-block px-2 py-1 text-muted" :title="words.categories.onlyOperating">–</span>
          </td>
          <td>
            <UButton
              icon="i-lucide-trash-2"
              color="neutral"
              variant="ghost"
              size="xs"
              :disabled="locked(draft) && dirty"
              :title="locked(draft) && dirty ? words.saveBeforeDelete : undefined"
              :aria-label="draft.saved === null ? words.categories.removeNew : words.categories.deleteName(shownName(draft))"
              data-testid="remove-category"
              @click="remove(index)"
            />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton :label="words.categories.add" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="add-category" @click="addCategory" />
    <span class="flex-1" />
    <UButton :label="words.categories.discard" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="discard" />
    <UButton :label="words.categories.save" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || errors.size > 0 || saving" data-testid="save-categories" @click="save" />
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

.field-error,
.field-hint {
  margin-top: 0.25rem;
  max-width: 13rem;
  white-space: normal;
  font-size: 0.75rem;
  color: var(--tone-negative);
}

.field-hint {
  max-width: 15rem;
  color: var(--ink-muted);
}
</style>
