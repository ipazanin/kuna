<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { formatMoney } from '../../../shared/money/moneyFormat'
import type { TabReading } from '../../workbook/infrastructure/cellReading'
import type { SheetRow } from '../../workbook/infrastructure/workbookSnapshot'
import { rowsFrom } from '../../workbook/infrastructure/workbookTemplate'
import { cellsOfDrafts, draftsOfRows, kindOfColumn } from '../domain/tabRowDrafts'
import type { DraftCellKind, FieldReader, TabRowDraft } from '../domain/tabRowDrafts'
import type { ChoiceItem, EditorColumn } from './factTabColumns'

type Cells = SheetRow['cells']

// A select item cannot carry an empty value, so the blank choice travels as this.
const BLANK_CHOICE = '-'

const props = defineProps<{
  /** The tab as stored, rows the reader leaves out included, so they can be fixed here. */
  rows: readonly SheetRow[]
  columns: readonly EditorColumn[]
  /** The tab's own reader, so the editor reports exactly what reading the workbook would. */
  read: (rows: readonly SheetRow[]) => TabReading<{ readonly sheetRow: number }>
  editable: boolean
  saving: boolean
  /** Such as `asset`, for "Add asset". */
  rowNoun: string
  /** Such as `assets`, for "Save assets". */
  tabNoun: string
  /** The fields a new row starts with. */
  newRow: () => Readonly<Record<string, string>>
}>()

const emit = defineEmits<{
  save: [cells: Cells[]]
}>()

const drafts = ref<TabRowDraft[]>(draftsOfRows(props.rows, props.columns))
watch(
  () => props.rows,
  (rows) => {
    drafts.value = draftsOfRows(rows, props.columns)
  },
)

const savedCells = computed(() => new Map(props.rows.map((row) => [row.sheetRow, row.cells])))
const dirty = computed(() => JSON.stringify(drafts.value) !== JSON.stringify(draftsOfRows(props.rows, props.columns)))

/**
 * What the reader says of each draft, by position. While editing, the drafts are read as the rows
 * they would be saved as. Read-only, the stored rows are read as they are.
 */
const reading = computed(() => {
  const rows = props.editable ? rowsFrom(cellsOfDrafts(drafts.value, props.columns, savedCells.value)) : props.rows
  const positionOf = new Map(props.editable ? drafts.value.map((_, index) => [index + 2, index]) : drafts.value.map((draft, index) => [draft.sheetRow ?? 0, index]))
  const read = props.read(rows)
  const kept = new Set(read.facts.map((fact) => positionOf.get(fact.sheetRow)))
  const reasons = new Map<number, string[]>()
  for (const problem of read.problems) {
    const index = positionOf.get(problem.sheetRow)
    if (index !== undefined) reasons.set(index, [...(reasons.get(index) ?? []), problem.reason])
  }
  return { kept, reasons }
})

const leftOut = computed(() => drafts.value.some((_, index) => !reading.value.kept.has(index)))

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

function shown(column: EditorColumn, draft: TabRowDraft): string {
  const text = draft.fields[column.name] ?? ''
  if (text === '') return ''
  const kind = kindOf(column, draft)
  const amount = Number(text)
  if (kind === 'amount' && Number.isFinite(amount)) return formatMoney(Math.round(amount * 100))
  return kind === 'percent' ? `${text}%` : kind === 'flag' ? 'Yes' : text
}

/** Amounts and rates line up on the right when read, as in the other tables. */
function alignsRight(kind: DraftCellKind): boolean {
  return kind === 'amount' || kind === 'percent'
}

function addRow(): void {
  drafts.value = [...drafts.value, { sheetRow: null, fields: props.newRow() }]
}

function removeRow(index: number): void {
  drafts.value = drafts.value.filter((_, position) => position !== index)
}

function save(): void {
  emit('save', cellsOfDrafts(drafts.value, props.columns, savedCells.value))
}
</script>

<template>
  <div class="relative overflow-x-auto px-1 pt-2 pb-2 sm:px-2">
    <table class="data-table editor-table w-full text-sm">
      <thead>
        <tr>
          <th v-for="column in columns" :key="column.name" scope="col" :class="!editable && alignsRight(column.kind) ? 'text-end' : 'text-start'">{{ column.label }}</th>
          <th v-if="editable" scope="col"><span class="sr-only">Remove</span></th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="drafts.length === 0">
          <td :colspan="columns.length + (editable ? 1 : 0)" class="text-muted">No {{ tabNoun }} yet.</td>
        </tr>
        <template v-for="(draft, index) in drafts" :key="draft.sheetRow ?? `new-${index}`">
          <tr>
            <td v-for="column in columns" :key="column.name">
              <template v-if="editable">
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
              </template>
              <span v-else :class="[alignsRight(kindOf(column, draft)) ? 'block text-end' : '', ['amount', 'percent', 'whole-number'].includes(kindOf(column, draft)) ? 'figure text-toned' : 'text-toned']">
                {{ shown(column, draft) }}
              </span>
            </td>
            <td v-if="editable">
              <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" :aria-label="`Remove this ${rowNoun}`" @click="removeRow(index)" />
            </td>
          </tr>
          <tr v-if="reading.reasons.has(index)" class="problem-row">
            <td :colspan="columns.length + (editable ? 1 : 0)">
              <p
                v-for="reason in reading.reasons.get(index)"
                :key="reason"
                :class="reading.kept.has(index) ? 'row-warning' : 'row-error'"
              >
                {{ reading.kept.has(index) ? reason : `Left out: ${reason}` }}
              </p>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
  <div v-if="editable" class="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5">
    <UButton :label="`Add ${rowNoun}`" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" @click="addRow" />
    <span class="flex-1" />
    <UButton label="Discard changes" color="neutral" variant="ghost" size="sm" :disabled="!dirty || saving" @click="drafts = draftsOfRows(rows, columns)" />
    <UButton :label="`Save ${tabNoun}`" icon="i-lucide-save" size="sm" :loading="saving" :disabled="!dirty || leftOut || saving" @click="save" />
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
