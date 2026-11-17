<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { setLimit } from '../application/budgetWrites'
import { budgetIn, nextDue } from '../domain/budgetCarry'
import { spendingFigures } from '../../analytics/domain/spendingFigures'
import { categoryTree } from '../../categories/domain/categoryTree'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import { BUDGET_RECORDS } from '../../workbook/domain/spendingKinds'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { addMonths, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, plainAmount } from '../../../../shared/money/money'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import { useRates } from '../../../../shared/rates/application/pageRates'
import { everydayRates } from '../../../../shared/rates/domain/ratesState'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { newRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** Sets a monthly limit or a yearly cost on a spending group or category from a month on, or ends the one it has. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The category whose limit to change, or null to pick one. */
  category: Category | null
  /** Where the dialog's month starts. */
  month: MonthKey
  /** This month, around which the months on offer lie. */
  current: MonthKey
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const rates = useRates()

/** How far before and after this month a limit can start. */
const MONTHS_AROUND = 12

/** The picked category's id, blank until one is picked, since a select item never holds a blank value. */
const picked = ref('')
const amount = ref('')
const from = ref<MonthKey>(props.month)
const every = ref<'month' | 'year'>('month')
const due = ref<MonthKey>(props.month)
const tried = ref(false)
const yearly = computed(() => every.value === 'year')

const budgets = computed(() => store.state.workbook?.budgets ?? [])
const pickedId = computed<RecordId | null>(() => store.state.workbook?.categories.find((category) => category.id === picked.value)?.id ?? null)

interface CategoryItem {
  readonly label: string
  readonly value: string
  readonly class?: string
}

/** Each visible spending group with its visible children under it, and the category being changed even when hidden. */
const categoryItems = computed(() =>
  categoryTree(store.state.workbook?.categories ?? [], ['spending'])
    .filter((entry) => !entry.group.hidden || entry.group.id === props.category?.id || entry.children.some((child) => child.id === props.category?.id))
    .map((entry): CategoryItem[] => [
      { label: entry.group.name, value: entry.group.id },
      ...entry.children.filter((child) => !child.hidden || child.id === props.category?.id).map((child) => ({ label: child.name, value: child.id, class: 'ps-6' })),
    ]),
)

const monthItems = computed(() => monthsFrom(addMonths(props.current, -MONTHS_AROUND), addMonths(props.current, MONTHS_AROUND)).map((month) => ({ label: monthLabel(month), value: month })))

const EVERY_OPTIONS = [
  { value: 'month' as const, label: words.dialog.everyMonth },
  { value: 'year' as const, label: words.dialog.onceAYear },
]

/** The months a yearly cost starting in the picked month can first fall due in: that month and the eleven after it. */
const dueItems = computed(() => monthsFrom(from.value, addMonths(from.value, 11)).map((month) => ({ label: monthLabel(month), value: month })))

/** The budget the picked category has in the picked month, and its amount, zero without one. */
const held = computed(() => (pickedId.value === null ? undefined : budgetIn(budgets.value, pickedId.value, from.value)))
const heldLimit = computed<Money>(() => held.value?.amount ?? ZERO)

watch(open, (opened) => {
  if (!opened) return
  picked.value = props.category?.id ?? ''
  from.value = props.month
  tried.value = false
})

// How often follows the picked category's budget when the dialog opens or the category changes, and a later change of month keeps what the person chose.
watch(
  [open, pickedId],
  ([opened]) => {
    if (opened) every.value = held.value?.due !== undefined && held.value.amount > 0 ? 'year' : 'month'
  },
  { immediate: true },
)

// The amount shown is always the picked category's limit in the picked month, so Save never writes one category's figure onto another.
watch(
  [open, heldLimit],
  ([opened, held]) => {
    if (opened) amount.value = held > 0 ? plainAmount(held) : ''
  },
  { immediate: true },
)

// A yearly cost keeps its due month as the picked month moves, falling due in the same month of the year.
watch(
  [open, held, from],
  ([opened, budget, month]) => {
    if (opened) due.value = nextDue(budget?.due !== undefined && budget.amount > 0 ? budget.due : due.value, month)
  },
  { immediate: true },
)

const typed = computed(() => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

const DRAFT = recordIdOf(BUDGET_RECORDS, newRecordId())

/** What the yearly cost as typed sets aside in its first month, with what an earlier run of it carries in. */
const setAside = computed(() => {
  const book = store.state.workbook
  const category = pickedId.value
  if (!yearly.value || book === null || category === null || typed.value === null) return null
  const kept = book.budgets.filter((budget) => !(budget.category === category && budget.from === from.value))
  const draft = { id: held.value?.id ?? DRAFT, category, from: from.value, amount: typed.value, due: due.value }
  return (
    spendingFigures({ ...book, budgets: [...kept, draft] }, everydayRates(rates.value))
      .limitsIn(from.value)
      .find((month) => month.category === category)?.limit ?? null
  )
})

const errors = computed(() => ({
  category: pickedId.value === null ? words.dialog.aCategory : null,
  amount: typed.value === null ? words.dialog.anAmount : null,
}))

async function write(title: string, limit: Money, key: string, dueIn: MonthKey | null): Promise<void> {
  const records = store.state.records
  const category = pickedId.value
  const month = from.value
  if (records === null || category === null) return
  if (await writes.write(title, (unit) => setLimit(unit, records, category, month, limit, dueIn), { key, failedTitle: spendingWords.form.notSaved })) open.value = false
}

async function save(): Promise<void> {
  tried.value = true
  if (errors.value.category !== null || typed.value === null) return
  await write(words.dialog.set, typed.value, 'save', yearly.value ? due.value : null)
}

async function end(): Promise<void> {
  await write(words.dialog.ended, ZERO, 'end', null)
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="heldLimit > 0 ? words.dialog.changeTitle : words.dialog.title" :description="yearly ? words.dialog.yearlyDescription : words.dialog.description">
    <FormGrid id="spending-limit" as="form" data-testid="spending-limit-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.category" :error="(tried && errors.category) || false" class="sm:col-span-2">
        <USelect v-model="picked" :items="categoryItems" :placeholder="words.dialog.aCategory" class="w-full" data-testid="spending-limit-category" />
      </UFormField>
      <UFormField :label="words.dialog.every" class="sm:col-span-2">
        <ChoiceButtons v-model="every" :options="EVERY_OPTIONS" :label="words.dialog.every" data-testid="spending-limit-every" />
      </UFormField>
      <UFormField :label="yearly ? words.dialog.yearlyAmount : words.dialog.amount" :error="(tried && errors.amount) || false">
        <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-limit-amount" />
      </UFormField>
      <UFormField :label="words.dialog.from" :help="words.dialog.fromHelp">
        <USelect v-model="from" :items="monthItems" class="w-full" data-testid="spending-limit-from" />
      </UFormField>
      <UFormField v-if="yearly" :label="words.dialog.due" :help="setAside === null ? '' : words.dialog.dueHelp(formatMoney(setAside), monthLabel(from))" class="sm:col-span-2">
        <USelect v-model="due" :items="dueItems" class="w-full" data-testid="spending-limit-due" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="heldLimit > 0"
        :label="words.dialog.end"
        icon="i-lucide-circle-stop"
        color="error"
        variant="ghost"
        :loading="writes.saving('end')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-limit-end"
        @click="end"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-limit"
        :label="words.dialog.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-limit-save"
      />
    </template>
  </AppDialog>
</template>
