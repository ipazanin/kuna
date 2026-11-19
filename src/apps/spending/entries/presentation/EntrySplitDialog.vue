<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { entryCategoryChoices } from './categoryChoices'
import { useLabelsAndEvents } from './useLabelsAndEvents'
import { words } from './words'
import { writeEntrySplit } from '../application/entryWrites'
import { entrySplit, newPartChoices } from '../domain/entrySplit'
import type { ItemDraft } from '../domain/entrySplit'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { isSplit, rowItemsOf } from '../../workbook/domain/rowItems'
import { BY_DAYS } from '../../workbook/domain/event'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { absAccountMoney, negateAccountMoney, typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import LabelsSelect from '../../../../shared/ui/LabelsSelect.vue'
import SplitEditor from '../../../../shared/ui/SplitEditor.vue'
import { givenParts, splitField } from '../../../../shared/ui/splitFields'
import type { SplitField } from '../../../../shared/ui/splitFields'

/** The parts you split an entry into, each with an amount, a category, an optional note, labels and an event, and one part that takes the rest. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  entry: Transaction
  currency: CurrencyCode
}>()

const emit = defineEmits<{ saved: [] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

/** Each part holds the id of the entry's part it opened, which it keeps. */
const parts = ref<SplitField<RecordId>[]>([])
const tried = ref(false)

const heldItems = computed(() => rowItemsOf({ items: store.state.workbook?.items ?? [] })(props.entry))
/** Whether the entry is split already, so the dialog changes the split rather than making one. */
const changing = computed(() => isSplit(heldItems.value))
const { labelChoices, labelling, labelRefused, partLabels, partEvents, events, withTyped, labelPart, eventItems, start, addParts, addCarried } = useLabelsAndEvents(() => props.entry.date)
const labelsOf = (part: SplitField<RecordId>) => partLabels.value[part.id] ?? []

watch(open, (opened) => {
  if (!opened) return
  tried.value = false
  const held = heldItems.value
  const [whole] = held
  parts.value =
    !changing.value && whole !== undefined
      ? [splitField<RecordId>('', whole.category ?? '', whole.note, false, whole.id), splitField<RecordId>('', '', '', true)]
      : held.map((part, place) => {
          const rest = place === held.length - 1
          return splitField(rest ? '' : amountForTyping(absAccountMoney(part.amount)), part.category ?? '', part.note, rest, part.id)
        })
  start(
    parts.value.flatMap((field) => {
      const part = held.find((candidate) => candidate.id === field.held)
      return part === undefined ? [] : [{ part: field.id, labels: part.labels, event: part.event }]
    }),
  )
})

/** A part added in the editor, or the rest of an entry not split yet, starts with what `newPartChoices` gives it. */
watch(parts, (fields) => addParts(fields.map((field) => ({ part: field.id, ...newPartChoices(heldItems.value) }))))

const categories = computed(() => store.state.workbook?.categories ?? [])
const side = computed(() => (props.entry.amount < 0 ? 'out' : 'in'))
/** The entry read above zero, as each part is typed. */
const whole = computed(() => absAccountMoney(props.entry.amount))

/** The category a part names, or null while it names none. */
function categoryOf(part: SplitField<RecordId>): RecordId | null {
  return categories.value.find((category) => category.id === part.category)?.id ?? null
}

const choicesOf = (part: SplitField<RecordId>) => entryCategoryChoices(categories.value, side.value, categoryOf(part))

function categoryError(part: SplitField<RecordId>): string | null {
  return categoryOf(part) === null ? words.split.refusals['unknown-category'] : null
}

const signed = (amount: AccountMoney): AccountMoney => (props.entry.amount < 0 ? negateAccountMoney(amount) : amount)

const outcome = computed(() => {
  const book = store.state.workbook
  const given = givenParts(parts.value, typedAccountAmount)
  if (book === null || given === null || parts.value.some((part) => categoryError(part) !== null)) return null
  const drafts = parts.value.map((part, place): ItemDraft => {
    const amount = given[place]!
    return {
      id: part.held,
      amount: amount === 'rest' ? 'rest' : signed(amount),
      category: categoryOf(part)!,
      note: part.note,
      choices: { labels: labelsOf(part), event: partEvents.value[part.id] ?? BY_DAYS },
    }
  })
  return entrySplit(book, props.entry, drafts)
})

const refusal = computed(() => (outcome.value !== null && 'refused' in outcome.value ? words.split.refusals[outcome.value.refused] : null))

async function save(): Promise<void> {
  tried.value = true
  const records = store.state.records
  const split = outcome.value
  if (records === null || split === null || 'refused' in split) return
  const carried = new Set(split.parts.flatMap((part) => part.labels))
  const work = (unit: UnitOfWork) => {
    addCarried(unit, carried)
    writeEntrySplit(unit, records, split)
  }
  if (await writes.write(changing.value ? words.split.changed : words.split.saved, work, { key: 'split', failedTitle: spendingWords.form.notSaved })) {
    open.value = false
    emit('saved')
  }
}
</script>

<template>
  <AppDialog v-model:open="open" changes width="xl" :title="changing ? words.split.changeTitle : words.split.title" :description="words.split.description(entry.payee, dayLabel(entry.date))">
    <form id="spending-split" class="flex flex-col gap-4" data-testid="spending-split-dialog" @submit.prevent="save">
      <SplitEditor v-model="parts" :whole-label="words.split.whole" :whole="whole" :typed="typedAccountAmount" :tried="tried" :category-error="categoryError" :refusal="refusal">
        <template #whole>
          <AccountMoneyText :cents="entry.amount" :currency="currency" tone="flow" />
        </template>
        <template #category="{ field }">
          <USelectMenu v-model="field.category" :items="choicesOf(field)" value-key="value" :placeholder="words.dialog.pickCategory" class="w-full" data-testid="split-part-category" />
        </template>
        <template #rest="{ cents }">
          <AccountMoneyText :cents="cents" :currency="currency" />
        </template>
        <template v-if="labelling" #part="{ field, place }">
          <div class="grid gap-x-3 gap-y-2" :class="events.length > 0 ? 'sm:grid-cols-2' : ''">
            <UFormField :label="words.dialog.labels" :error="labelRefused !== null && labelRefused.part === field.id ? labelRefused.text : false">
              <LabelsSelect
                :model-value="labelsOf(field)"
                :labels="labelChoices"
                :name="words.split.partLabels(place)"
                class="w-full"
                data-testid="split-part-labels"
                @update:model-value="labelPart(field.id, $event)"
                @create="labelPart(field.id, withTyped(labelsOf(field), $event, field.id))"
              />
            </UFormField>
            <UFormField v-if="events.length > 0" :label="words.dialog.event">
              <USelect v-model="partEvents[field.id]" :items="eventItems(field.category)" :aria-label="words.split.partEvent(place)" class="w-full" data-testid="split-part-event" />
            </UFormField>
          </div>
        </template>
      </SplitEditor>
      <p class="type-caption">{{ words.split.sign }}</p>
    </form>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-split"
        :label="changing ? words.split.save : words.split.split"
        :icon="changing ? 'i-lucide-save' : 'i-lucide-split'"
        :loading="writes.saving('split')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-split-save"
      />
    </template>
  </AppDialog>
</template>
