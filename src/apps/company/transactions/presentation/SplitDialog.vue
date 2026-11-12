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
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { SplitTabRow } from '../../workbook/domain/splitsReading'
import type { LedgerSplit, SplitPart } from '../../workbook/domain/splits'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import { writeSplit } from '../application/splitWrites'
import CategoryPicker from './CategoryPicker.vue'
import { words } from './words'
import { plural } from '../../../../shared/text/translation'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The bank row as booked. */
  row: Transaction
  /** The row's split on the splits tab, or null to split it. */
  split: LedgerSplit | null
  categories: readonly Category[]
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)
const names = useDisplayNames()

/** Each part holds the stored part it opened, whose share it keeps while it keeps its category. */
const parts = ref<SplitField<SplitPart>[]>([])
const tried = ref(false)

watch(
  open,
  (opened) => {
    if (!opened) return
    tried.value = false
    const held = props.split?.parts ?? []
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
const keptWhole = computed(() => store.state.workbook?.rowsKeptWhole.get(props.row.id) ?? null)

function categoryError(part: SplitField<SplitPart>): string | null {
  return part.category === '' ? words.splitDialog.chooseCategory : null
}

/** The parts placed in the row, or why they cannot be, or null while a part lacks an amount or a category, which its field says. */
const outcome = computed(() => {
  const given = givenParts(parts.value, typedAmount)
  return given === null || parts.value.some((part) => categoryError(part) !== null) ? null : partsOfWhole(whole.value, given)
})

const refusal = computed(() => (outcome.value !== null && 'refused' in outcome.value ? splitWords.split.refusals[outcome.value.refused] : null))

/** The parts of the split as the app read them, larger first. A change writes only the fields that differ, so a field left alone is never rewritten. */
function currentParts(): SplitTabRow[] | null {
  const split = props.split
  if (split === null) return []
  const parts = split.parts.map((part) => recordWithId(store.state.records?.splits ?? NO_RECORDS, part.id)?.record ?? null)
  return parts.every((part) => part !== null) ? (parts as SplitTabRow[]) : null
}

async function save(): Promise<void> {
  tried.value = true
  const current = currentParts()
  const placed = outcome.value
  if (placed === null || 'refused' in placed || current === null) return
  const amounts = placed.parts
  const signed = (amount: Money): Money => (props.row.amount < 0 ? negateMoney(amount) : amount)
  const drafts = parts.value.map((part, index) => ({ amount: signed(amounts[index]!), category: part.category, note: part.note, opened: part.held }))
  const saved = await writes.write(
    props.split === null ? plural(words.splitInParts(drafts.length), drafts.length) : words.splitDialog.saved,
    (unit) => writeSplit(unit, props.row, current, drafts, props.categories),
    {
      description: words.splitDialog.paymentOf(props.row.counterparty, props.row.amount),
      failedTitle: words.splitDialog.notSaved,
    },
  )
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const current = currentParts()
  if (current === null || current.length === 0) return
  const deleted = await writes.write(words.splitDialog.deleted, (unit) => writeSplit(unit, props.row, current, [], props.categories), {
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
    width="2xl"
    :title="split === null ? words.splitDialog.addTitle : words.splitDialog.changeTitle"
    :description="words.splitDialog.description(row.counterparty, dayLabel(row.date), names.account(row.account))"
  >
    <form id="split-row" class="flex flex-col gap-4" data-testid="split-form" @submit.prevent="save">
      <UAlert v-if="keptWhole !== null" icon="i-lucide-info" color="neutral" variant="subtle" :title="words.splitDialog.keptWhole(keptWhole)" data-testid="split-claimed" />
      <SplitEditor v-model="parts" :whole-label="words.splitDialog.payment(row.amount >= 0)" :whole="whole" :typed="typedAmount" :tried="tried" :category-error="categoryError" :refusal="refusal">
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
      <p class="type-caption">{{ words.splitDialog.sign }}</p>
    </form>
    <template #start>
      <UButton
        v-if="split !== null"
        :label="words.splitDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="split-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="words.splitDialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="split-row"
        :label="split === null ? words.splitDialog.split : words.splitDialog.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || keptWhole !== null"
        data-testid="split-save"
      />
    </template>
  </AppDialog>
</template>
