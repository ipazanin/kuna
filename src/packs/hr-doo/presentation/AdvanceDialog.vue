<script lang="ts">
import type { CivilDate } from '../../../shared/calendar/civilDate'
import type { Money } from '../../../shared/money/money'

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
import UModal from '@nuxt/ui/components/Modal.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { parseCivilDate } from '../../../shared/calendar/civilDate'
import { rangeContains } from '../../../shared/calendar/dateRange'
import type { DateRange } from '../../../shared/calendar/dateRange'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { amountOf } from '../../../shared/money/money'
import { typedAmount } from '../../../shared/money/typedAmount'
import { formatMoney } from '../../../shared/money/moneyFormat'
import { ownerAdvanceOfDraft } from '../application/ownerAdvanceWrites'
import { OWNER_ADVANCE_WRITES } from '../domain/hrDooWrites'
import type { OwnerAdvanceEntry } from '../domain/ownerAdvancesReading'
import { useFilters } from '../../../features/filters/application/filterStore'
import { advanceDrill } from '../../../features/filters/domain/drillTarget'
import { useDisplayNames } from '../../../features/workbook/application/useDisplayNames'
import { ADVANCE_BUCKETS } from '../../../features/workbook/domain/workbook'
import type { Category } from '../../../features/workbook/domain/workbook'
import { useRecordWrites } from '../../../features/workbook/presentation/useRecordWrites'

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

const writes = useRecordWrites()
const names = useDisplayNames()
const router = useRouter()
const { drillLocation } = useFilters()
const phone = usePhoneLayout()

const date = ref<string>(props.defaultDate)
const amount = ref('')
const description = ref('')
const category = ref('')
const tried = ref(false)

watch(open, (opened) => {
  if (opened) {
    const start = props.editing ?? props.prefill
    date.value = start?.date ?? props.defaultDate
    amount.value = start === null ? '' : amountOf(start.amount).toFixed(2)
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
  date: parseCivilDate(date.value) === null ? 'A date, such as 2026-10-14' : null,
  amount: parsedAmount.value === null ? 'A positive amount with at most two decimals' : null,
  category: category.value === '' ? 'Choose the cost it was' : null,
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
    before === null ? 'Advance added' : 'Advance changed',
    (unit) => (before === null ? unit.of(OWNER_ADVANCE_WRITES).add(advance) : unit.of(OWNER_ADVANCE_WRITES).change(before, advance)),
    {
      description: `${formatMoney(advance.amount)} as ${names.value.category(advance.category)}.${outside}`,
      failedTitle: before === null ? 'Not added' : 'Not changed',
      ...(rows === null ? {} : { follow: { label: 'Open it', icon: 'i-lucide-list', run: () => void router.push(rows) } }),
    },
  )
  if (written) open.value = false
}

/** Says that a cost dated outside the period in view is saved but not listed. */
function outsideView(day: CivilDate): string {
  const shown = props.inView
  return shown === null || shown.range === null || rangeContains(shown.range, day) ? '' : ` Outside the period in view, ${shown.words}, so the page does not list it.`
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  const removed = await writes.write('Advance deleted', (unit) => unit.of(OWNER_ADVANCE_WRITES).remove(before), {
    description: `${formatMoney(before.amount)} as ${names.value.category(before.category)}.`,
    failedTitle: 'Not deleted',
  })
  if (removed) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="editing ? 'Change the advance' : 'Add an advance'"
    :description="
      editing
        ? 'A cost the owner paid privately for the company, on the owner-advances tab. Only the cells you change are written.'
        : 'A cost the owner paid privately for the company. It counts as a cost on its date, and reimbursements to the owner repay it.'
    "
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="add-advance" class="grid gap-4 sm:grid-cols-2" data-testid="add-advance" @submit.prevent="save">
        <UFormField label="Date" :error="(tried && errors.date) || false">
          <UInput v-model="date" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Amount" :error="(tried && errors.amount) || false">
          <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" />
        </UFormField>
        <UFormField label="Category" :error="(tried && errors.category) || false" help="Operating costs and taxes only." class="sm:col-span-2">
          <USelectMenu v-model="category" data-testid="advance-category" :items="categoryItems" value-key="value" placeholder="Choose a category" :search-input="{ placeholder: 'Search categories' }" class="w-full" />
        </UFormField>
        <UFormField label="What it was for" class="sm:col-span-2">
          <UInput v-model="description" placeholder="Train tickets to the client" class="w-full" />
        </UFormField>
        <p class="text-xs text-muted sm:col-span-2">Part of a payment the company made was yours? Split that payment on Transactions instead.</p>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap justify-end gap-2">
        <UButton
          v-if="editing"
          label="Delete advance"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          class="me-auto"
          :disabled="writes.busy.value"
          data-testid="advance-delete"
          @click="remove"
        />
        <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
        <UButton
          type="submit"
          form="add-advance"
          :label="editing ? 'Save advance' : 'Add advance'"
          :icon="editing ? 'i-lucide-save' : 'i-lucide-plus'"
          :loading="writes.busy.value"
          :disabled="writes.busy.value"
        />
      </div>
    </template>
  </UModal>
</template>
