<script lang="ts">
import type { Category } from '../../workbook/domain/category'

/** What the dialog is opened for: a category to change, a new group, or a new category in a group. */
export type CategoryEditing = { readonly mode: 'edit'; readonly category: Category } | { readonly mode: 'add-group' } | { readonly mode: 'add-child'; readonly group: Category }
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { CATEGORY_WRITES, deleteInto, newCategory } from '../application/categoryWrites'
import { categoryTree } from '../domain/categoryTree'
import { categoryColours } from './categoryColours'
import { lastOrder, siblingsUnder } from './categoryPlaces'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isFixedKind } from '../../workbook/domain/category'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { SWATCHES, swatchToken } from '../../../../shared/charts/swatches'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ColourSwatchPicker from '../../../../shared/ui/ColourSwatchPicker.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/** A category's name, group, colour and whether it is hidden, or its deletion into another category. A fixed category takes only a name. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  editing: CategoryEditing
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const SWATCH_CHOICES = SWATCHES.map((swatch) => ({ value: swatch.hex, name: swatch.name, token: swatchToken(swatch) }))

const categories = computed(() => store.state.workbook?.categories ?? [])
const before = computed(() => (props.editing.mode === 'edit' ? props.editing.category : null))
const fixed = computed(() => before.value !== null && isFixedKind(before.value.kind))

/** The category the dialog starts from: the one to change, or a new one with an id of its own. */
const start = ref<Category>(newCategory({ name: '', kind: 'spending', parent: null, order: 0, colour: '', hidden: false }))
const name = ref('')
const parent = ref<RecordId | null>(null)
const colour = ref('')
const hidden = ref(false)
const tried = ref(false)
const deleting = ref(false)
/** The category picked to take the entries, or blank while none is, which shows the placeholder. */
const target = ref('')

watch(open, (opened) => {
  if (!opened) return
  const editing = props.editing
  start.value =
    editing.mode === 'edit'
      ? editing.category
      : newCategory({
          name: '',
          kind: editing.mode === 'add-child' ? editing.group.kind : 'spending',
          parent: editing.mode === 'add-child' ? editing.group.id : null,
          order: 0,
          colour: '',
          hidden: false,
        })
  name.value = start.value.name
  parent.value = start.value.parent
  colour.value = start.value.colour
  hidden.value = start.value.hidden
  tried.value = false
  deleting.value = false
  target.value = categories.value.find((group) => group.id === start.value.parent && !group.hidden)?.id ?? ''
})

/** The category as the dialog would write it, last among its new siblings when it is new or changes group. */
const typed = computed((): Category => {
  const moved = before.value === null || parent.value !== before.value.parent
  const order = moved ? lastOrder(siblingsUnder(categories.value, parent.value, start.value.kind).filter((sibling) => sibling.id !== start.value.id)) : start.value.order
  return fixed.value ? { ...start.value, name: name.value.trim() } : { ...start.value, name: name.value.trim(), parent: parent.value, order, colour: colour.value, hidden: hidden.value }
})

const groupItems = computed(() => categoryTree(categories.value, [start.value.kind]).map((entry) => ({ label: entry.group.name, value: entry.group.id })))

/** How the blank colour paints: a child in its group's colour, a group in the next chart slot no group's swatch takes. */
const blankColour = computed(() => {
  const blank = { ...typed.value, colour: '' }
  const token = categoryColours([...categories.value.filter((category) => category.id !== blank.id), blank])(blank)
  return { name: blank.parent === null ? words.dialog.nextFreeColour : words.dialog.groupColour, token }
})

const errors = computed(() => ({
  name: typed.value.name === '' ? words.dialog.nameError : null,
  target: target.value === '' ? words.dialog.targetError : null,
}))

/** The categories of its kind its entries and limits can move to, under their groups, hidden ones left out. */
const targetItems = computed(() => {
  const category = before.value
  if (category === null) return []
  const counts = (other: Category): boolean => other.id !== category.id && !other.hidden
  return categoryTree(categories.value, [category.kind]).flatMap((entry) => {
    const choices = [entry.group, ...entry.children].filter(counts).map((other) => ({ label: other.name, value: other.id }))
    return choices.length === 0 ? [] : [[{ type: 'label' as const, label: entry.group.name }, ...choices]]
  })
})

/** Why the category cannot be deleted, or null when it can. A fixed one says so in the dialog's description. */
const kept = computed(() => {
  const category = before.value
  if (category === null || fixed.value) return null
  if (categories.value.some((child) => child.parent === category.id)) return words.dialog.groupKept
  return targetItems.value.length === 0 ? words.dialog.noTarget : null
})

/** What the deletion moves and what ends with it, as the file holds it. */
const moving = computed(() => {
  const category = before.value
  const records = store.state.records
  if (category === null || records === null) return words.dialog.nothingMoves
  const entries = recordsOf(records.transactions).filter((entry) => entry.category === category.id).length
  const limits = recordsOf(records.budgets).filter((budget) => budget.category === category.id).length
  const receiptLines = recordsOf(records.lines).filter((line) => line.category === category.id).length
  const rules = recordsOf(records.rules).filter((rule) => rule.category === category.id).length
  const lines = [
    ...(entries > 0 ? [words.dialog.moving(plural(words.dialog.entries(entries), entries))] : []),
    ...(receiptLines > 0 ? [plural(words.dialog.linesMove(receiptLines), receiptLines)] : []),
    ...(rules > 0 ? [plural(words.dialog.rulesMove(rules), rules)] : []),
    ...(limits > 0 ? [plural(words.dialog.limitsEnd(limits), limits)] : []),
  ]
  return lines.length === 0 ? words.dialog.nothingMoves : lines.join(' ')
})

const title = computed(() => (props.editing.mode === 'add-group' ? words.dialog.addGroupTitle : props.editing.mode === 'add-child' ? words.dialog.addChildTitle : words.dialog.editTitle))
const description = computed(() => (before.value !== null && isFixedKind(before.value.kind) ? words.dialog.fixedNote(words.fixedKinds[before.value.kind]) : undefined))

async function save(): Promise<void> {
  tried.value = true
  if (errors.value.name !== null) return
  const category = typed.value
  const changed = before.value
  const done =
    changed === null
      ? await writes.write(words.added, (unit) => unit.of(CATEGORY_WRITES).add(category), { failedTitle: spendingWords.form.notAdded })
      : await writes.write(words.saved, (unit) => unit.of(CATEGORY_WRITES).change(changed, category), { failedTitle: spendingWords.form.notSaved })
  if (done) open.value = false
}

async function remove(): Promise<void> {
  tried.value = true
  const category = before.value
  const records = store.state.records
  const into = categories.value.find((other) => other.id === target.value)
  if (category === null || records === null || into === undefined) return
  if (await writes.write(words.deleted, (unit) => deleteInto(unit, records, category, into), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}

function startDeleting(): void {
  tried.value = false
  deleting.value = true
}
</script>

<template>
  <AppDialog v-model:open="open" :title="title" :description="description">
    <div data-testid="spending-category-dialog">
      <form v-if="deleting" id="spending-category-delete" class="flex flex-col gap-3" @submit.prevent="remove">
        <UFormField :label="words.dialog.deleteInto" :help="moving" :error="(tried && errors.target) || false">
          <USelect v-model="target" :items="targetItems" :placeholder="words.dialog.pickTarget" class="w-full" data-testid="spending-category-target" />
        </UFormField>
      </form>
      <FormGrid v-else id="spending-category" as="form" @submit.prevent="save">
        <UFormField :label="words.dialog.name" :error="(tried && errors.name) || false">
          <UInput v-model="name" class="w-full" data-testid="spending-category-name" />
        </UFormField>
        <template v-if="!fixed">
          <UFormField v-if="parent !== null" :label="words.dialog.group">
            <USelect v-model="parent" :items="groupItems" class="w-full" data-testid="spending-category-group" />
          </UFormField>
          <UFormField :label="words.dialog.colour">
            <ColourSwatchPicker v-model="colour" :title="words.dialog.colourOf(typed.name)" :blank="blankColour" :swatches="SWATCH_CHOICES" />
          </UFormField>
          <USwitch v-model="hidden" :label="words.dialog.hide" :description="words.dialog.hideHelp" data-testid="spending-category-hidden" />
          <p v-if="kept !== null" class="text-sm text-muted" data-testid="spending-category-kept">{{ kept }}</p>
        </template>
      </FormGrid>
    </div>
    <template #start>
      <UButton
        v-if="!deleting && before !== null && !fixed && kept === null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        data-testid="spending-category-delete-into"
        @click="startDeleting"
      />
    </template>
    <template #end>
      <template v-if="deleting">
        <UButton :label="words.dialog.back" color="neutral" variant="ghost" @click="deleting = false" />
        <UButton
          type="submit"
          form="spending-category-delete"
          :label="words.dialog.deleteAndMove"
          icon="i-lucide-trash-2"
          color="error"
          :loading="writes.saving('delete')"
          :disabled="writes.busy.value"
          data-testid="spending-category-delete"
        />
      </template>
      <template v-else>
        <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
        <UButton
          type="submit"
          form="spending-category"
          :label="before === null ? words.dialog.add : words.dialog.save"
          :icon="before === null ? 'i-lucide-plus' : 'i-lucide-save'"
          :loading="writes.saving('save')"
          :disabled="writes.busy.value"
          data-testid="spending-category-save"
        />
      </template>
    </template>
  </AppDialog>
</template>
