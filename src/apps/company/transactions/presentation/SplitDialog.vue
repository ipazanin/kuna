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
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { storedSplitOf } from '../../workbook/domain/splitsReading'
import type { SplitPart } from '../../workbook/domain/splits'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { useBookedWorkbook } from '../application/useBookedWorkbook'
import { removeSplit, writeSplit } from '../application/splitWrites'
import CategoryPicker from './CategoryPicker.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

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
/** What the splits tab holds for the row as the app read it, a refused split's parts too. A change writes only the fields that differ, so a field left alone is never rewritten. */
const stored = computed(() => storedSplitOf(store.state.records?.splits ?? NO_RECORDS, booked.value?.splits ?? [], props.row))

/** Each part holds the stored part it opened, whose share it keeps while it keeps its category. */
const parts = ref<SplitField<SplitPart>[]>([])
const tried = ref(false)

watch(
  open,
  (opened) => {
    if (!opened) return
    tried.value = false
    const held = split.value?.parts ?? []
    parts.value =
      held.length === 0
        ? [splitField<SplitPart>('', props.row.category, '', false), splitField<SplitPart>('', '', '', true)]
        : held.map((part, place) => {
            const rest = place === held.length - 1
            return splitField(rest ? '' : amountForTyping(part.amount < 0 ? negateMoney(part.amount) : part.amount), part.category, part.note, rest, part)
          })
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

const refusal = computed(() => (outcome.value !== null && 'refused' in outcome.value ? splitWords.split.refusals[outcome.value.refused] : null))

/** Whether a stored part cannot be read, which keeps any split of the row from counting until it is fixed in the workbook, so the dialog offers no split. */
const unreadable = computed(() => keptWhole.value === null && stored.value.unreadable > 0)

/** How many stored parts a save replaces although they do not count, since the guards refused their split. */
const refusedParts = computed(() => (stored.value.refused ? stored.value.parts.length : 0))

async function save(): Promise<void> {
  tried.value = true
  const placed = outcome.value
  if (placed === null || 'refused' in placed) return
  const amounts = placed.parts
  const signed = (amount: Money): Money => (props.row.amount < 0 ? negateMoney(amount) : amount)
  const drafts = parts.value.map((part, index) => ({ amount: signed(amounts[index]!), category: part.category, note: part.note, opened: part.held }))
  const saved = await writes.write(
    split.value === null ? plural(words.splitInParts(drafts.length), drafts.length) : words.splitDialog.saved,
    (unit) => writeSplit(unit, props.row, stored.value, drafts, props.categories),
    {
      description: [words.splitDialog.paymentOf(props.row.counterparty, props.row.amount), ...(stored.value.refused ? [words.splitDialog.noUndo] : [])].join(' '),
      failedTitle: words.splitDialog.notSaved,
    },
  )
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  if (stored.value.parts.length === 0) return
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
        :disabled="writes.busy.value || writes.refused.value"
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
