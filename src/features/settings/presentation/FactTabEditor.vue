<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import type { RecordId } from '../../workbook/domain/recordId'
import type { TabRowsChange } from '../../workbook/domain/rowChanges'
import { recordOutcome } from '../../workbook/infrastructure/cellReading'
import type { TabReading } from '../../workbook/infrastructure/cellReading'
import type { SheetRow, WorkbookTab } from '../../workbook/infrastructure/workbookSnapshot'
import { ID_COLUMN, rowsFrom } from '../../workbook/infrastructure/workbookTemplate'
import { cellsOfDrafts, draftsOfRows, kindOfColumn, rowsChangeOf } from '../domain/tabRowDrafts'
import type { DraftCellKind, FieldReader, TabRowDraft } from '../domain/tabRowDrafts'
import type { ChoiceItem, EditorColumn } from './factTabColumns'

// A select item cannot carry an empty value, so the blank choice travels as this.
const BLANK_CHOICE = '-'

const props = defineProps<{
  tab: WorkbookTab
  /** The tab as stored, rows the reader leaves out included, so they can be fixed here. */
  rows: readonly SheetRow[]
  columns: readonly EditorColumn[]
  /** The tab's own reader, so the editor reports exactly what reading the workbook would. */
  read: (rows: readonly SheetRow[]) => TabReading<{ readonly id: RecordId }>
  saving: boolean
  /** Such as `asset`, for "Add asset". */
  rowNoun: string
  /** Such as `assets`, for "Save assets". */
  tabNoun: string
  /** The fields a new row starts with. */
  newRow: () => Readonly<Record<string, string>>
}>()

const emit = defineEmits<{
  save: [change: TabRowsChange]
}>()

const drafts = ref<TabRowDraft[]>(draftsOfRows(props.rows, props.columns))
watch(
  () => props.rows,
  (rows) => {
    drafts.value = draftsOfRows(rows, props.columns)
  },
)

const savedCells = computed(() => new Map(props.rows.map((row, saved) => [saved, row.cells])))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(draftsOfRows(props.rows, props.columns)))

/** What the reader says of each draft, by position, the drafts read as the rows they would be saved as. A new row gets its id when it is saved, so it reads with one here. */
const reading = computed(() => {
  const cells = cellsOfDrafts(drafts.value, props.columns, savedCells.value).map((rowCells, index) =>
    drafts.value[index]!.saved === null ? { ...rowCells, [ID_COLUMN]: `new-${index}` } : rowCells,
  )
  const read = props.read(rowsFrom(cells))
  return cells.map((rowCells) => recordOutcome(props.tab, read, rowCells))
})

const leftOut = computed(() => reading.value.some((outcome) => !outcome.kept))

function fieldReader(draft: TabRowDraft): FieldReader {
  return (column) => (draft.fields[column] ?? '').trim().toLowerCase()
}

function kindOf(column: EditorColumn, draft: TabRowDraft): DraftCellKind {
  return kindOfColumn(column, fieldReader(draft))
}

/** The select's items, with the blank choice first when the column allows it, and a value the list lacks kept so it shows. */
function choicesOf(column: EditorColumn, draft: TabRowDraft): ChoiceItem[] | null {
  const choices = column.choicesOf?.(fieldReader(draft)) ?? column.choices ?? null
  if (choices === null) return null
  const current = draft.fields[column.name] ?? ''
  const unknown = current !== '' && !choices.some((choice) => choice.value === current) ? [{ value: current, label: current }] : []
  return [...(column.blankLabel === undefined ? [] : [{ value: BLANK_CHOICE, label: column.blankLabel }]), ...choices, ...unknown]
}

/** An empty value shows the placeholder. */
function choiceValue(column: EditorColumn, draft: TabRowDraft): string {
  const current = draft.fields[column.name] ?? ''
  return current === '' && column.blankLabel !== undefined ? BLANK_CHOICE : current
}

function update(index: number, column: string, text: string): void {
  drafts.value = drafts.value.map((draft, position) => (position === index ? { ...draft, fields: { ...draft.fields, [column]: text } } : draft))
}

function choose(index: number, column: string, choice: unknown): void {
  update(index, column, choice === BLANK_CHOICE ? '' : String(choice ?? ''))
}

function addRow(): void {
  drafts.value = [...drafts.value, { saved: null, fields: props.newRow() }]
}

function removeRow(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  const opened = draftsOfRows(props.rows, props.columns)
  const openedCells = cellsOfDrafts(opened, props.columns, savedCells.value)
  const draftedCells = cellsOfDrafts(drafts.value, props.columns, savedCells.value)
  emit(
    'save',
    rowsChangeOf(
      props.rows,
      props.columns.map((column) => column.name),
      drafts.value.map((draft, index) => ({ saved: draft.saved, cells: draftedCells[index]! })),
      new Map(opened.map((_, saved) => [saved, openedCells[saved]!])),
    ),
  )
}
</script>

<template>
  <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full text-sm">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.name" scope="col" class="text-start">{{ column.label }}</th>
          <th scope="col"><span class="sr-only">Delete</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="drafts.length === 0">
          <td :colspan="columns.length + 1" class="text-muted">No {{ tabNoun }} yet.</td>
        </tr>
        <template v-for="(draft, index) in drafts" :key="draft.saved ?? `new-${index}`">
          <tr data-testid="fact-row">
            <td v-for="column in columns" :key="column.name">
              <USelect
                v-if="choicesOf(column, draft)"
                :model-value="choiceValue(column, draft)"
                :items="choicesOf(column, draft) ?? []"
                :placeholder="column.placeholderOf?.(fieldReader(draft)) || 'Choose'"
                :aria-label="column.label"
                size="sm"
                :class="column.width"
                @update:model-value="choose(index, column.name, $event)"
              />
              <UCheckbox
                v-else-if="kindOf(column, draft) === 'flag'"
                :model-value="draft.fields[column.name] === 'TRUE'"
                :label="column.label"
                :class="column.width"
                @update:model-value="update(index, column.name, $event === true ? 'TRUE' : '')"
              />
              <UInput
                v-else
                :model-value="draft.fields[column.name] ?? ''"
                :type="kindOf(column, draft) === 'date' ? 'date' : 'text'"
                :inputmode="['amount', 'whole-number', 'percent'].includes(kindOf(column, draft)) ? 'decimal' : undefined"
                :placeholder="column.placeholderOf?.(fieldReader(draft)) ?? ''"
                :aria-label="column.label"
                size="sm"
                :class="column.width"
                @update:model-value="update(index, column.name, String($event ?? ''))"
              >
                <template v-if="kindOf(column, draft) === 'percent'" #trailing>
                  <span class="text-xs text-muted">%</span>
                </template>
              </UInput>
            </td>
            <td>
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="xs"
                :aria-label="draft.saved === null ? `Remove this new ${rowNoun}` : `Delete this ${rowNoun}`"
                data-testid="remove-row"
                @click="removeRow(index)"
              />
            </td>
          </tr>
          <tr v-if="reading[index]!.reasons.length > 0" class="problem-row">
            <td :colspan="columns.length + 1">
              <p
                v-for="reason in reading[index]!.reasons"
                :key="reason"
                :class="reading[index]!.kept ? 'row-warning' : 'row-error'"
              >
                {{ reading[index]!.kept ? reason : `Left out: ${reason}` }}
              </p>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
  <div class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton :label="`Add ${rowNoun}`" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="add-row" @click="addRow" />
    <span class="flex-1" />
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = draftsOfRows(rows, columns)" />
    <UButton :label="`Save ${tabNoun}`" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || leftOut || saving" data-testid="save-rows" @click="save" />
  </div>
</template>

<style scoped>
.editor-table td {
  vertical-align: top;
}

.problem-row td {
  padding-top: 0;
  white-space: normal;
  font-size: 0.75rem;
}

/* The table scrolls sideways on a phone, and the message stays where the row starts. */
.problem-row p {
  position: sticky;
  left: 0.75rem;
  max-width: min(40rem, calc(100vw - 4rem));
}

.row-error {
  color: var(--tone-negative);
}

.row-warning {
  color: var(--tone-warning);
}
</style>
