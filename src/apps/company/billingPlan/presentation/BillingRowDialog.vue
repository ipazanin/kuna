<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plainAmount } from '../../../../shared/money/money'
import { typedAmount } from '../../../../shared/money/typedAmount'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { BillingItem } from '../../workbook/domain/billingPlan'
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { BILLING_WRITES, newBillingItem } from '../application/billingWrites'
import type { BillingRowLine } from './billingView'

const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The row to edit, or null to add one. */
  row: BillingRowLine | null
  /** The item kinds the plan already uses, largest first. */
  items: readonly string[]
  clients: readonly { readonly slug: string; readonly name: string }[]
  /** Where a new row starts: the newest booking and the billing client. */
  defaultDate: CivilDate
  defaultClient: string
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)

const item = ref('')
const date = ref('')
const amount = ref('')
const client = ref('')
const description = ref('')
const created = ref<string[]>([])
const tried = ref(false)

watch(open, (opened) => {
  if (!opened) return
  const row = props.row
  item.value = row?.item ?? ''
  date.value = row?.date ?? props.defaultDate
  amount.value = row === null ? '' : plainAmount(row.amount)
  client.value = row?.client ?? (props.clients.some((entry) => entry.slug === props.defaultClient) ? props.defaultClient : (props.clients[0]?.slug ?? ''))
  description.value = row?.description ?? ''
  created.value = []
  tried.value = false
})

const itemChoices = computed(() => [...new Set([...props.items, ...created.value])])
const clientItems = computed(() => props.clients.map((entry) => ({ label: entry.name || entry.slug, value: entry.slug })))

function createItem(text: string): void {
  const typed = text.trim()
  if (typed !== '') {
    created.value = [...created.value, typed]
    item.value = typed
  }
}

const parsedAmount = computed(() => {
  const cents = typedAmount(amount.value)
  return cents !== null && cents > 0 ? cents : null
})

const errors = computed(() => ({
  item: item.value.trim() === '' ? 'Choose the kind of item, or type a new one' : null,
  date: parseCivilDate(date.value) === null ? 'A date, such as 2026-10-31' : null,
  amount: parsedAmount.value === null ? 'An amount above zero with at most two decimals' : null,
  client: client.value === '' ? 'Choose the client' : null,
}))

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

/** The item as the app read it. A change writes only the fields that differ, so a formula amount left alone is never rewritten. */
function readItem(row: BillingRowLine): BillingItem | null {
  return recordWithId(store.state.records?.['outgoing-plan'] ?? NO_RECORDS, row.id)?.record ?? null
}

/** "Monthly Fee for Northwind, 31 Oct 2026", as the dialog and its toasts name the row. */
function named(row: BillingRowLine): string {
  return `${row.item} for ${row.clientName}, ${dayLabel(row.date)}`
}

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (!valid.value || day === null || parsedAmount.value === null) {
    return
  }
  const typed = newBillingItem({ item: item.value, date: day, amount: parsedAmount.value, client: client.value, description: description.value })
  const row = props.row
  if (row === null) {
    if (await writes.write('Plan row added', (unit) => unit.of(BILLING_WRITES).add(typed), { failedTitle: 'Not added' })) open.value = false
    return
  }
  const before = readItem(row)
  if (before === null) return
  const after: BillingItem = { ...typed, id: before.id }
  if (await writes.write('Plan row saved', (unit) => unit.of(BILLING_WRITES).change(before, after), { description: named(row), failedTitle: 'Not saved' })) open.value = false
}

async function remove(): Promise<void> {
  const row = props.row
  const before = row === null ? null : readItem(row)
  if (row === null || before === null) return
  if (await writes.write('Plan row deleted', (unit) => unit.of(BILLING_WRITES).remove(before), { description: named(row), failedTitle: 'Not deleted' })) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    :title="row === null ? 'Add a plan row' : 'Edit the plan row'"
    :description="row === null ? 'Something to invoice a client, from the day it becomes billable.' : `${named(row)}, on the outgoing-plan tab. Only the cells you change are written.`"
  >
    <FormGrid id="billing-row" as="form" data-testid="billing-row-form" @submit.prevent="save">
      <UFormField label="Item" :error="(tried && errors.item) || false" help="Rows of one kind share this text." class="sm:col-span-2">
        <USelectMenu
          v-model="item"
          :items="itemChoices"
          create-item
          placeholder="Choose or type an item"
          :search-input="{ placeholder: 'Search or type a new item' }"
          class="w-full"
          data-testid="billing-row-item"
          @create="createItem"
        />
      </UFormField>
      <UFormField label="Billable from" :error="(tried && errors.date) || false" help="The last day of the worked month for a monthly fee.">
        <UInput v-model="date" type="date" class="w-full" />
      </UFormField>
      <UFormField label="Amount" :error="(tried && errors.amount) || false">
        <UInput v-model="amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="billing-row-amount" />
      </UFormField>
      <UFormField label="Client" :error="(tried && errors.client) || false" class="sm:col-span-2">
        <USelect v-model="client" :items="clientItems" placeholder="Choose a client" class="w-full" />
      </UFormField>
      <UFormField label="Description" help="What the invoice line says, such as Oct 2026." class="sm:col-span-2">
        <UInput v-model="description" class="w-full" data-testid="billing-row-description" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton v-if="row !== null" label="Delete row" icon="i-lucide-trash-2" color="error" variant="ghost" :disabled="writes.busy.value" data-testid="billing-row-delete" @click="remove" />
    </template>
    <template #end>
      <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="billing-row"
        :label="row === null ? 'Add row' : 'Save row'"
        :icon="row === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
      />
    </template>
  </AppDialog>
</template>
