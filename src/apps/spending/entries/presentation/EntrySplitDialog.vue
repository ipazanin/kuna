<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { entryCategoryChoices } from './categoryChoices'
import LabelsAndEventFields from './LabelsAndEventFields.vue'
import { useLabelsAndEvents } from './useLabelsAndEvents'
import { words } from './words'
import { writeEntrySplit } from '../application/entryWrites'
import { entrySplit, halfAndHalf, newPartChoices } from '../domain/entrySplit'
import type { ItemDraft } from '../domain/entrySplit'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import CountsUnderField from '../../payees/presentation/CountsUnderField.vue'
import { mainCategoryOf } from '../../../../shared/categorising/domain/mainCategory'
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
import SplitEditor from '../../../../shared/ui/SplitEditor.vue'
import { givenParts, splitField } from '../../../../shared/ui/splitFields'
import type { SplitField } from '../../../../shared/ui/splitFields'

/** The parts you split an entry into, each with an amount, a category, who it counts under, an optional note, labels and an event, and one part that takes the rest. */
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
/** Who each part counts under by the field's id, blank for the entry's payee, and the parts whose picker is open. */
const payees = ref<Record<number, string>>({})
const payeesOpen = ref<Record<number, boolean>>({})

const heldItems = computed(() => rowItemsOf({ items: store.state.workbook?.items ?? [] })(props.entry))
/** Whether the entry is split already, so the dialog changes the split rather than making one. */
const changing = computed(() => isSplit(heldItems.value))
const kit = useLabelsAndEvents(() => props.entry.date)
const { labelling, partLabels, partEvents, labelPart, start, addParts, addCarried } = kit
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
  payees.value = Object.fromEntries(parts.value.map((field) => [field.id, held.find((part) => part.id === field.held)?.payee ?? '']))
  payeesOpen.value = {}
  start(
    parts.value.flatMap((field) => {
      const part = held.find((candidate) => candidate.id === field.held)
      return part === undefined ? [] : [{ part: field.id, labels: part.labels, event: part.event }]
    }),
  )
})

/** A part added in the editor, or the rest of an entry not split yet, starts with what `newPartChoices` gives it. */
watch(parts, (fields) => addParts(fields.map((field) => ({ part: field.id, ...newPartChoices(heldItems.value) }))))

/** Two parts in place of any there were, the first taking the odd cent, both under the entry's category, and part 2's payee open to pick. */
function halveEntry(): void {
  const held = heldItems.value
  const category = mainCategoryOf(held) ?? ''
  const [half] = halfAndHalf(whole.value)
  const halves = [splitField<RecordId>(amountForTyping(half), category, changing.value ? '' : (held[0]?.note ?? ''), false, held[0]?.id ?? null), splitField<RecordId>('', category, '', true)]
  parts.value = halves
  payees.value = {}
  payeesOpen.value = { [halves[1]!.id]: true }
}

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
      payee: payees.value[part.id] ?? '',
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
        <template #tools>
          <UButton :label="words.split.halfAndHalf" icon="i-lucide-divide" color="neutral" variant="outline" size="sm" data-testid="split-half-and-half" @click="halveEntry" />
        </template>
        <template #beside="{ field, place }">
          <CountsUnderField
            v-model:open="payeesOpen[field.id]"
            :model-value="payees[field.id] ?? ''"
            :entry-payee="entry.payee"
            :name="words.split.partCountsUnder(place)"
            @update:model-value="payees[field.id] = $event"
          />
        </template>
        <template v-if="labelling" #part="{ field, place }">
          <LabelsAndEventFields
            :labels="labelsOf(field)"
            :event="partEvents[field.id] ?? BY_DAYS"
            :kit="kit"
            :part="field.id"
            :filed-under="field.category"
            :labels-name="words.split.partLabels(place)"
            :event-name="words.split.partEvent(place)"
            testid="split-part"
            @update:labels="labelPart(field.id, $event)"
            @update:event="partEvents[field.id] = $event"
          />
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
