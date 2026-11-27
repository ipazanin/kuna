<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { negateMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { partsOfWhole } from '../../../../shared/money/partsOfWhole'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import SplitEditor from '../../../../shared/ui/SplitEditor.vue'
import { givenParts, splitField } from '../../../../shared/ui/splitFields'
import { words as splitWords } from '../../../../shared/ui/words'
import type { SplitField } from '../../../../shared/ui/splitFields'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { storedSplitsOf } from '../../workbook/domain/storedSplits'
import { NOTHING_STORED } from '../../workbook/domain/splits'
import type { SplitPart } from '../../workbook/domain/splits'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { useBookedWorkbook } from '../application/useBookedWorkbook'
import { invoicesSplitOff, removeSplit, splitRefusal, writeSplit } from '../application/splitWrites'
import type { SplitPartDraft } from '../application/splitWrites'
import CategoryPicker from './CategoryPicker.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'
import UFormField from '@nuxt/ui/components/FormField.vue'
import { labelsOf } from '../../../../shared/categorising/domain/labels'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import LabelsSelect from '../../../../shared/ui/LabelsSelect.vue'
import { useTypedLabels } from '../../labels/presentation/useTypedLabels'
import { storedItemsOfRow, storesItems } from '../../workbook/domain/rowItems'
import { useTried } from '../../../../shared/ui/useTried'

/** Settings, General, where the problem list names each record Kuna cannot read. */
const PROBLEMS_LINK = { path: '/company/settings', query: { tab: 'general' } }

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The bank row as booked. */
  row: Transaction
  categories: readonly Category[]
}>()

const store = useWorkbook()
const booked = useBookedWorkbook()
const writes = useRecordWrites(store)
const names = useDisplayNames()

/** The row's split as the figures count it, or null to split it. */
const split = computed(() => booked.value?.splits.find((candidate) => candidate.row.id === props.row.id) ?? null)
/** What the books hold of the row's split as the app read it, a refused split's parts too. A change writes only the fields that differ, so a field left alone is never rewritten. */
const stored = computed(() => {
  const { records } = store.state
  return records === null || records === undefined ? NOTHING_STORED : storedSplitsOf(records)(props.row)
})

/** Each part holds the stored part it opened, whose share it keeps while it keeps its category. */
const parts = ref<SplitField<SplitPart>[]>([])
const { tried, markTried } = useTried(open)

/** Whether the books keep labels, which books from before items do not. */
const labelled = computed(() => store.state.records !== null && storesItems(store.state.records))
const typed = useTypedLabels()
/** The labels of each part by its field, a part's own as the books hold it. */
const partLabels = ref<Readonly<Record<number, readonly RecordId[]>>>({})
/** Every label the row's items carry, which a part added in the editor starts with. */
const rowLabels = computed(() => {
  const records = store.state.records
  return records === null || records === undefined ? [] : labelsOf(storedItemsOfRow(records.items, props.row))
})

function labelsOfField(field: SplitField<SplitPart>): readonly RecordId[] {
  return partLabels.value[field.id] ?? rowLabels.value
}

function labelField(field: SplitField<SplitPart>, labels: readonly RecordId[]): void {
  partLabels.value = { ...partLabels.value, [field.id]: labels }
}

watch(
  open,
  (opened) => {
    if (!opened) return
    const held = split.value?.parts ?? []
    parts.value =
      held.length === 0
        ? [splitField<SplitPart>('', props.row.category, '', false), splitField<SplitPart>('', '', '', true)]
        : held.map((part, place) => {
            const rest = place === held.length - 1
            return splitField(rest ? '' : amountForTyping(part.amount < 0 ? negateMoney(part.amount) : part.amount), part.category, part.note, rest, part)
          })
    const itemLabels = store.state.workbook?.itemLabels
    partLabels.value = Object.fromEntries(parts.value.flatMap((field) => (field.held === null ? [] : [[field.id, itemLabels?.get(field.held.id) ?? []]])))
    typed.forget()
  },
  { immediate: true },
)

/** The row read positive, since every part takes its sign. */
const whole = computed(() => (props.row.amount < 0 ? negateMoney(props.row.amount) : props.row.amount))

/** Why a pack keeps the row whole, or null when it may be split. */
const keptWhole = computed(() => booked.value?.rowsKeptWhole.get(props.row.id) ?? null)

function categoryError(part: SplitField<SplitPart>): string | null {
  return part.category === '' ? words.splitDialog.chooseCategory : null
}

/** The parts placed in the row, or why they cannot be, or null while a part lacks an amount or a category, which its field says. */
const outcome = computed(() => {
  const given = givenParts(parts.value, typedAmount)
  return given === null || parts.value.some((part) => categoryError(part) !== null) ? null : partsOfWhole(whole.value, given)
})

/** The parts as the write takes them, signed as the row, or null while they cannot be placed. */
const drafts = computed((): SplitPartDraft[] | null => {
  const placed = outcome.value
  if (placed === null || 'refused' in placed) return null
  const signed = (amount: Money): Money => (props.row.amount < 0 ? negateMoney(amount) : amount)
  return parts.value.map((part, index) => ({
    amount: signed(placed.parts[index]!),
    category: part.category,
    note: part.note,
    opened: part.held,
    ...(labelled.value ? { labels: labelsOfField(part) } : {}),
  }))
})

/** Why the books refuse the split as given, or its removal with none, or null, so the dialog says so before Save. */
function booksRefusal(given: readonly SplitPartDraft[] | null): string | null {
  const { records, workbook } = store.state
  return records === null || records === undefined || workbook === null || workbook === undefined ? null : splitRefusal({ records, workbook }, props.row, stored.value, given)
}

const refusal = computed(() => {
  if (outcome.value !== null && 'refused' in outcome.value) return splitWords.split.refusals[outcome.value.refused]
  return drafts.value === null ? null : booksRefusal(drafts.value)
})

/** Why the split cannot be taken off, or null. */
const deleteRefusal = computed(() => (stored.value.parts.length === 0 ? null : booksRefusal(null)))

/** Why Delete split is off, unless the refusal under the parts already says the same once Save was tried. */
const deleteReason = computed(() => (tried.value && refusal.value === deleteRefusal.value ? null : deleteRefusal.value))

/** Whether a stored part cannot be read, which keeps any split of the row from counting until it is fixed in the workbook, so the dialog offers no split. */
const unreadable = computed(() => keptWhole.value === null && stored.value.unreadable > 0)

/** How many stored parts a save replaces although they do not count, since the guards refused their split. */
const refusedParts = computed(() => (stored.value.refused ? stored.value.parts.length : 0))

async function save(): Promise<void> {
  markTried()
  const given = drafts.value
  const records = store.state.records
  const workbook = store.state.workbook
  if (given === null || refusal.value !== null || records === null || records === undefined || workbook === null || workbook === undefined) return
  const title = split.value === null ? plural(words.splitInParts(given.length), given.length) : words.splitDialog.saved
  const freed = invoicesSplitOff({ records, workbook }, props.row, stored.value, given)
  const carried = new Set(given.flatMap((draft) => draft.labels ?? []))
  const work = (unit: Parameters<typeof writeSplit>[0]) => {
    typed.addCarried(unit, carried)
    writeSplit(unit, records, props.row, stored.value, given, props.categories)
  }
  const saved = await writes.write(freed.length === 0 ? title : words.splitDialog.takenOff(title, freed), work, {
    description: [words.splitDialog.paymentOf(props.row.counterparty, props.row.amount), ...(stored.value.refused ? [words.splitDialog.noUndo] : [])].join(' '),
    failedTitle: words.splitDialog.notSaved,
  })
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  if (stored.value.parts.length === 0 || deleteRefusal.value !== null) return
  const { records, workbook } = store.state
  if (records === null || records === undefined || workbook === null || workbook === undefined) return
  const deleted = await writes.write(words.splitDialog.deleted, (unit) => removeSplit(unit, { records, workbook }, props.row, stored.value), {
    description: words.splitDialog.countsWhole,
    key: 'delete',
    failedTitle: words.splitDialog.notDeleted,
  })
  if (deleted) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    width="2xl"
    :title="split === null ? words.splitDialog.addTitle : words.splitDialog.changeTitle"
    :description="words.splitDialog.description(row.counterparty, dayLabel(row.date), names.account(row.account))"
  >
    <form id="split-row" class="flex flex-col gap-4" data-testid="split-form" @submit.prevent="save">
      <UAlert v-if="keptWhole !== null" icon="i-lucide-info" color="neutral" variant="subtle" :title="words.splitDialog.keptWhole(keptWhole)" data-testid="split-claimed" />
      <UAlert
        v-else-if="unreadable"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="plural(words.splitDialog.unreadableParts(stored.unreadable), stored.unreadable)"
        :actions="[{ label: words.splitDialog.openProblems, to: PROBLEMS_LINK, color: 'neutral', variant: 'outline' }]"
        data-testid="split-unreadable"
      />
      <UAlert
        v-else-if="refusedParts > 0"
        icon="i-lucide-triangle-alert"
        color="warning"
        variant="subtle"
        :title="plural(words.splitDialog.replacesRefused(refusedParts), refusedParts)"
        data-testid="split-replaces-refused"
      />
      <UAlert
        v-if="deleteRefusal !== null"
        icon="i-lucide-info"
        color="neutral"
        variant="subtle"
        :title="words.splitDialog.deleteOff"
        :description="deleteReason ?? ''"
        data-testid="split-delete-refused"
      />
      <SplitEditor
        v-if="!unreadable"
        v-model="parts"
        :whole-label="words.splitDialog.payment(row.amount >= 0)"
        :whole="whole"
        :typed="typedAmount"
        :tried="tried"
        :category-error="categoryError"
        :refusal="refusal"
      >
        <template #whole>
          <MoneyText :cents="row.amount" tone="flow" />
        </template>
        <template #category="{ field }">
          <CategoryPicker v-model="field.category" :categories="categories" class="w-full" data-testid="split-part-category" />
        </template>
        <template #rest="{ cents }">
          <MoneyText :cents="cents" />
        </template>
        <template v-if="labelled" #part="{ field, place }">
          <UFormField :label="words.splitDialog.labels" :error="typed.refused.value ?? false">
            <LabelsSelect
              :model-value="labelsOfField(field)"
              :labels="typed.choices.value"
              :name="words.splitDialog.labelsOf(place)"
              class="w-full"
              data-testid="split-part-labels"
              @update:model-value="labelField(field, $event)"
              @create="labelField(field, typed.withTyped(labelsOfField(field), $event))"
            />
          </UFormField>
        </template>
      </SplitEditor>
      <p v-if="!unreadable" class="type-caption">{{ words.splitDialog.sign }}</p>
    </form>
    <template #start>
      <UButton
        v-if="split !== null"
        :label="words.splitDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value || deleteRefusal !== null"
        data-testid="split-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="words.splitDialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        v-if="!unreadable"
        type="submit"
        form="split-row"
        :label="split === null ? words.splitDialog.split : words.splitDialog.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || keptWhole !== null || writes.refused.value"
        data-testid="split-save"
      />
    </template>
  </AppDialog>
</template>
