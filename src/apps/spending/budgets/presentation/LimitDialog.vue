<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { setLimit } from '../application/budgetWrites'
import { limitIn } from '../domain/budgetCarry'
import { categoryTree } from '../../categories/domain/categoryTree'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import { words as spendingWords } from '../../words'
import { words } from './words'
import { addMonths, monthsFrom } from '../../../../shared/calendar/monthKey'
import type { MonthKey } from '../../../../shared/calendar/monthKey'
import { monthLabel } from '../../../../shared/calendar/monthLabel'
import { ZERO, plainAmount } from '../../../../shared/money/money'
import type { Money } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'

/** Sets a monthly limit on a spending group or category from a month on, or ends the one it has. */
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

/** How far before and after this month a limit can start. */
const MONTHS_AROUND = 12

/** The picked category's id, blank until one is picked, since a select item never holds a blank value. */
const picked = ref('')
const amount = ref('')
const from = ref<MonthKey>(props.month)
const tried = ref(false)

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

/** The limit the picked category has in the picked month, zero without one. */
const heldLimit = computed<Money>(() => (pickedId.value === null ? ZERO : limitIn(budgets.value, pickedId.value, from.value)))

watch(open, (opened) => {
  if (!opened) return
  picked.value = props.category?.id ?? ''
  from.value = props.month
  tried.value = false
})

// The amount shown is always the picked category's limit in the picked month, so Save never writes one category's figure onto another.
watch(
  [open, heldLimit],
  ([opened, held]) => {
    if (opened) amount.value = held > 0 ? plainAmount(held) : ''
  },
  { immediate: true },
)

const typed = computed(() => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

const errors = computed(() => ({
  category: pickedId.value === null ? words.dialog.aCategory : null,
  amount: typed.value === null ? words.dialog.anAmount : null,
}))

async function write(title: string, limit: Money, key: string): Promise<void> {
  const records = store.state.records
  const category = pickedId.value
  const month = from.value
  if (records === null || category === null) return
  if (await writes.write(title, (unit) => setLimit(unit, records, category, month, limit), { key, failedTitle: spendingWords.form.notSaved })) open.value = false
}

async function save(): Promise<void> {
  tried.value = true
  if (errors.value.category !== null || typed.value === null) return
  await write(words.dialog.set, typed.value, 'save')
}

async function end(): Promise<void> {
  await write(words.dialog.ended, ZERO, 'end')
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="heldLimit > 0 ? words.dialog.changeTitle : words.dialog.title" :description="words.dialog.description">
    <FormGrid id="spending-limit" as="form" data-testid="spending-limit-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.category" :error="(tried && errors.category) || false" class="sm:col-span-2">
        <USelect v-model="picked" :items="categoryItems" :placeholder="words.dialog.aCategory" class="w-full" data-testid="spending-limit-category" />
      </UFormField>
      <UFormField :label="words.dialog.amount" :error="(tried && errors.amount) || false">
        <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-limit-amount" />
      </UFormField>
      <UFormField :label="words.dialog.from" :help="words.dialog.fromHelp">
        <USelect v-model="from" :items="monthItems" class="w-full" data-testid="spending-limit-from" />
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
