<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { ZERO, addMoney, amountOf, negateMoney, subtractMoney, sumMoney } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { typedAmount } from '../../../../shared/money/typedAmount'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
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

interface PartField {
  /** Unique within the dialog, so a removed part takes its fields with it. */
  readonly id: number
  amount: string
  category: string
  note: string
  readonly opened: SplitPart | null
}

const parts = ref<PartField[]>([])
const tried = ref(false)
let nextId = 0

function field(amount: Money | null, category: string, note: string, opened: SplitPart | null = null): PartField {
  nextId += 1
  return { id: nextId, amount: amount === null ? '' : amountOf(amount).toFixed(2), category, note, opened }
}

watch(
  open,
  (opened) => {
    if (!opened) return
    tried.value = false
    parts.value =
      props.split === null
        ? [field(null, props.row.category, ''), field(null, '', '')]
        : props.split.parts.map((part) => field(part.amount < 0 ? negateMoney(part.amount) : part.amount, part.category, part.note, part))
  },
  { immediate: true },
)

/** The row read positive, since every part takes its sign. */
const whole = computed(() => (props.row.amount < 0 ? negateMoney(props.row.amount) : props.row.amount))
const direction = computed(() => (props.row.amount < 0 ? 'money out' : 'money in'))

const typed = computed(() => parts.value.map((part) => typedAmount(part.amount)))
const placed = computed(() => sumMoney(typed.value.map((amount) => amount ?? ZERO)))
const remainder = computed(() => subtractMoney(whole.value, placed.value))

/** Why a pack keeps the row whole, or null when it may be split. */
const keptWhole = computed(() => store.state.workbook?.rowsKeptWhole.get(props.row.id) ?? null)

function amountError(index: number): string | null {
  const amount = typed.value[index]
  return amount === null || amount === 0 ? 'An amount above zero, with at most two decimals' : null
}

const errors = computed(() => {
  const list: string[] = []
  if (parts.value.length < 2) list.push('A split has at least two parts.')
  if (remainder.value !== 0)
    list.push(remainder.value > 0 ? `${formatMoney(remainder.value)} of the payment is not in a part yet.` : `The parts are ${formatMoney(negateMoney(remainder.value))} more than the payment.`)
  return list
})

const valid = computed(() => errors.value.length === 0 && parts.value.every((part, index) => amountError(index) === null && part.category !== ''))

function addPart(): void {
  parts.value = [...parts.value, field(remainder.value > 0 ? remainder.value : null, '', '')]
}

function removePart(id: number): void {
  parts.value = parts.value.filter((part) => part.id !== id)
}

/** Puts what is left of the payment into this part. */
function takeRest(index: number): void {
  const part = parts.value[index]
  if (part === undefined || remainder.value <= 0) return
  part.amount = amountOf(addMoney(typed.value[index] ?? ZERO, remainder.value)).toFixed(2)
}

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
  if (!valid.value || current === null) return
  const signed = (amount: Money): Money => (props.row.amount < 0 ? negateMoney(amount) : amount)
  const drafts = parts.value.map((part, index) => ({ amount: signed(typed.value[index]!), category: part.category, note: part.note, opened: part.opened }))
  const saved = await writes.write(props.split === null ? `Split in ${drafts.length} parts` : 'Split saved', (unit) => writeSplit(unit, props.row, current, drafts, props.categories), {
    description: `${props.row.counterparty || 'The payment'} of ${formatMoney(props.row.amount)}.`,
    failedTitle: 'Not saved',
  })
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const current = currentParts()
  if (current === null || current.length === 0) return
  const deleted = await writes.write('Split deleted', (unit) => writeSplit(unit, props.row, current, [], props.categories), {
    description: 'The payment counts whole again.',
    failedTitle: 'Not deleted',
  })
  if (deleted) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    width="2xl"
    :title="split === null ? 'Split the payment' : 'Edit the split'"
    :description="`${row.counterparty || 'No counterparty'}, ${dayLabel(row.date)}, ${names.account(row.account)}. The ledger keeps the row as the bank booked it, and the parts count in its place.`"
  >
    <form id="split-row" class="flex flex-col gap-4" data-testid="split-form" @submit.prevent="save">
      <p class="flex items-baseline justify-between gap-3 text-sm">
        <span class="text-toned">The payment, {{ direction }}</span>
        <MoneyText :cents="row.amount" tone="flow" class="font-medium text-highlighted" />
      </p>
      <div v-if="keptWhole !== null" class="rounded-control border border-default px-3 py-2 text-sm text-toned" data-testid="split-claimed">This row stays whole, since {{ keptWhole }}.</div>

      <ol class="flex flex-col gap-3" aria-label="Parts">
        <li v-for="(part, index) in parts" :key="part.id" class="part" data-testid="split-part">
          <UFormField :label="`Part ${index + 1}`" :error="(tried && amountError(index)) || false" class="part-amount">
            <div class="flex gap-1">
              <UInput v-model="part.amount" inputmode="decimal" placeholder="0.00" class="w-full" :aria-label="`Amount of part ${index + 1}`" data-testid="split-part-amount" />
              <UButton
                icon="i-lucide-arrow-down-to-line"
                color="neutral"
                variant="ghost"
                :disabled="remainder <= 0"
                :aria-label="`Put the rest of the payment in part ${index + 1}`"
                data-testid="split-part-rest"
                @click="takeRest(index)"
              />
            </div>
          </UFormField>
          <UFormField label="Category" :error="(tried && part.category === '' && 'Choose a category') || false" class="part-category">
            <CategoryPicker v-model="part.category" :categories="categories" class="w-full" data-testid="split-part-category" />
          </UFormField>
          <UFormField label="Note" class="part-note">
            <UInput v-model="part.note" placeholder="What this part paid for" class="w-full" data-testid="split-part-note" />
          </UFormField>
          <UButton icon="i-lucide-x" color="neutral" variant="ghost" class="part-remove" :aria-label="`Remove part ${index + 1}`" data-testid="split-part-remove" @click="removePart(part.id)" />
        </li>
      </ol>
      <div class="flex flex-wrap items-center justify-between gap-3">
        <UButton label="Add a part" icon="i-lucide-plus" color="neutral" variant="outline" size="sm" data-testid="split-add-part" @click="addPart" />
        <p class="text-sm" data-testid="split-remainder">
          <template v-if="remainder === 0"><span class="text-toned">The parts add up to the payment.</span></template>
          <template v-else-if="remainder > 0"><span class="text-muted">Left to place</span> <MoneyText :cents="remainder" class="font-medium text-highlighted" /></template>
          <template v-else><span class="text-muted">Over the payment by</span> <MoneyText :cents="negateMoney(remainder)" class="font-medium text-error" /></template>
        </p>
      </div>
      <ul v-if="tried && errors.length > 0" class="flex flex-col gap-1 text-sm text-error" data-testid="split-errors">
        <li v-for="error in errors" :key="error">{{ error }}</li>
      </ul>
      <p class="text-xs text-muted">Each part takes the row's sign and counts in its own category, with that category's timing, on every figure.</p>
    </form>
    <template #start>
      <UButton v-if="split !== null" label="Delete split" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="split-delete" @click="remove" />
    </template>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="split-row"
        :label="split === null ? 'Split' : 'Save split'"
        icon="i-lucide-save"
        :loading="writes.busy.value"
        :disabled="writes.busy.value || keptWhole !== null"
        data-testid="split-save"
      />
    </template>
  </AppDialog>
</template>

<style scoped>
.part {
  display: grid;
  grid-template-columns: minmax(0, 9rem) minmax(0, 1fr) auto;
  grid-template-areas:
    'amount category remove'
    'note note note';
  align-items: end;
  gap: 0.5rem 0.75rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--border-default);
}

.part-amount {
  grid-area: amount;
}

.part-category {
  grid-area: category;
}

.part-note {
  grid-area: note;
}

.part-remove {
  grid-area: remove;
}

@media (max-width: 639px) {
  .part {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'amount remove'
      'category category'
      'note note';
  }
}
</style>
