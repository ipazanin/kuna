<script lang="ts">
import type { CivilDate } from '../../../../../shared/calendar/civilDate'
import type { Money } from '../../../../../shared/money/money'

/** What the form starts on for a cost already reimbursed, such as a payment to the owner with no cost on file. */
export interface AdvancePrefill {
  readonly date: CivilDate
  /** Read positive. */
  readonly amount: Money
  readonly description: string
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { parseCivilDate } from '../../../../../shared/calendar/civilDate'
import { rangeContains } from '../../../../../shared/calendar/dateRange'
import type { DateRange } from '../../../../../shared/calendar/dateRange'
import { amountForTyping, typedAmount } from '../../../../../shared/money/typedAmount'
import { formatMoney } from '../../../../../shared/money/moneyFormat'
import { ownerAdvanceOfDraft } from '../application/ownerAdvanceWrites'
import { OWNER_ADVANCE_WRITES } from '../domain/hrDooWrites'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'
import { useFilters } from '../../../filters/application/filterStore'
import { advanceDrill } from '../../../filters/domain/drillTarget'
import { useDisplayNames } from '../../../workbook/application/useDisplayNames'
import { ADVANCE_BUCKETS } from '../../../workbook/domain/workbook'
import type { Category } from '../../../workbook/domain/workbook'
import { useWorkbook } from '../../../workbook/application/workbookStore'
import { useRecordWrites } from '../../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../../shared/ui/FormGrid.vue'
import { words } from './words'

const open = defineModel<boolean>('open', { required: true })

const props = withDefaults(
  defineProps<{
    categories: readonly Category[]
    /** The day the form starts on: the newest booking in the ledger. */
    defaultDate: CivilDate
    /** A cost the form starts on instead of a blank one. */
    prefill?: AdvancePrefill | null
    /** The advance the form changes, as the tab holds it. Null adds a new one. */
    editing?: OwnerAdvanceEntry | null
    /** The days the page shows, all of them when the range is null. A cost saved outside them says so. */
    inView?: { readonly range: DateRange | null; readonly words: string } | null
  }>(),
  { prefill: null, editing: null, inView: null },
)

const writes = useRecordWrites(useWorkbook())
const names = useDisplayNames()
const router = useRouter()
const { drillLocation } = useFilters()

const date = ref<string>(props.defaultDate)
const amount = ref('')
const description = ref('')
const category = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (opened) {
    const start = props.editing ?? props.prefill
    date.value = start?.date ?? props.defaultDate
    amount.value = start === null ? '' : amountForTyping(start.amount)
    description.value = start?.description ?? ''
    category.value = props.editing?.category ?? ''
    tried.value = false
  }
})

/** Only the costs an advance can be: categories of the operating and taxes buckets. */
const categoryItems = computed(() =>
  props.categories
    .filter((candidate) => (ADVANCE_BUCKETS as readonly string[]).includes(candidate.bucket))
    .map((candidate) => ({ label: names.value.category(candidate.slug), value: candidate.slug, bucket: candidate.bucket })),
)

const parsedAmount = computed(() => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

const errors = computed(() => ({
  date: parseCivilDate(date.value) === null ? words.advanceDialog.dateError : null,
  amount: parsedAmount.value === null ? words.advanceDialog.amountError : null,
  category: category.value === '' ? words.advanceDialog.categoryError : null,
}))

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (!valid.value || day === null || parsedAmount.value === null) {
    return
  }
  const draft = { date: day, amount: parsedAmount.value, description: description.value, category: category.value }
  const before = props.editing
  const advance = ownerAdvanceOfDraft(draft, props.categories, before)
  const outside = outsideView(advance.date)
  const rows = outside === '' ? null : drillLocation(advanceDrill(advance))
  const written = await writes.write(
    before === null ? words.advanceDialog.added : words.advanceDialog.changed,
    (unit) => (before === null ? unit.of(OWNER_ADVANCE_WRITES).add(advance) : unit.of(OWNER_ADVANCE_WRITES).change(before, advance)),
    {
      description: `${words.advanceDialog.asCategory(formatMoney(advance.amount), names.value.category(advance.category))}${outside}`,
      failedTitle: before === null ? words.advanceDialog.notAdded : words.advanceDialog.notChanged,
      ...(rows === null ? {} : { follow: { label: words.advanceDialog.openIt, icon: 'i-lucide-list', run: () => void router.push(rows) } }),
    },
  )
  if (written) open.value = false
}

/** Says that a cost dated outside the period in view is saved but not listed. */
function outsideView(day: CivilDate): string {
  const shown = props.inView
  return shown === null || shown.range === null || rangeContains(shown.range, day) ? '' : words.advanceDialog.outside(shown.words)
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  const removed = await writes.write(words.advanceDialog.deleted, (unit) => unit.of(OWNER_ADVANCE_WRITES).remove(before), {
    description: words.advanceDialog.asCategory(formatMoney(before.amount), names.value.category(before.category)),
    failedTitle: words.advanceDialog.notDeleted,
  })
  if (removed) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="editing ? words.advanceDialog.changeTitle : words.advanceDialog.addTitle"
    :description="editing ? words.advanceDialog.changeDescription : words.advanceDialog.addDescription"
  >
    <FormGrid id="add-advance" as="form" data-testid="add-advance" @submit.prevent="save">
      <UFormField :label="words.advanceDialog.date" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" />
      </UFormField>
      <UFormField :label="words.advanceDialog.amount" :error="(tried && errors.amount) || false">
        <UInput v-model="amount" inputmode="decimal" :placeholder="words.advanceDialog.amountPlaceholder" class="w-full" />
      </UFormField>
      <UFormField :label="words.advanceDialog.category" :error="(tried && errors.category) || false" :help="words.advanceDialog.categoryHelp" class="sm:col-span-2">
        <USelectMenu
          v-model="category"
          data-testid="advance-category"
          :items="categoryItems"
          value-key="value"
          :placeholder="words.advanceDialog.chooseCategory"
          :search-input="{ placeholder: words.advanceDialog.searchCategories }"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="words.advanceDialog.forWhat" class="sm:col-span-2">
        <UInput v-model="description" :placeholder="words.advanceDialog.forWhatPlaceholder" class="w-full" />
      </UFormField>
      <p class="text-xs text-muted">{{ words.advanceDialog.splitInstead }}</p>
    </FormGrid>
    <template #start>
      <UButton v-if="editing" :label="words.advanceDialog.delete" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="advance-delete" @click="remove" />
    </template>
    <template #end>
      <UButton :label="words.advanceDialog.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="add-advance"
        :label="editing ? words.advanceDialog.save : words.advanceDialog.add"
        :icon="editing ? 'i-lucide-save' : 'i-lucide-plus'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
      />
    </template>
  </AppDialog>
</template>
