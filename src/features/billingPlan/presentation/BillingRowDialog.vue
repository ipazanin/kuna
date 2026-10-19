<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { amountOf, moneyFromAmount } from '../../../shared/money/money'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { billingCellsOf, billingCellsOfRow } from '../infrastructure/billingPlanWrites'
import type { BillingCells } from '../infrastructure/billingPlanWrites'
import type { BillingRowLine } from './billingView'
import { useBillingRowWrites } from './useBillingRowWrites'

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
const writes = useBillingRowWrites()
const phone = usePhoneLayout()

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
  amount.value = row === null ? '' : amountOf(row.amount).toFixed(2)
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

/** A decimal comma is read as a point, so 12,50 is twelve fifty. */
const parsedAmount = computed(() => {
  const text = amount.value.trim().replace(',', '.')
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null
  const cents = moneyFromAmount(Number(text))
  return cents > 0 ? cents : null
})

const errors = computed(() => ({
  item: item.value.trim() === '' ? 'Choose the kind of item, or type a new one' : null,
  date: parseCivilDate(date.value) === null ? 'A date, such as 2026-10-31' : null,
  amount: parsedAmount.value === null ? 'An amount above zero with at most two decimals' : null,
  client: client.value === '' ? 'Choose the client' : null,
}))

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

/** The row's cells as the app read them, raw, so a formula amount left alone is never rewritten. */
function readCells(sheetRow: number): BillingCells | null {
  const read = store.state.snapshot?.['outgoing-plan'].find((candidate) => candidate.sheetRow === sheetRow)
  return read === undefined ? null : billingCellsOfRow(read)
}

async function save(): Promise<void> {
  tried.value = true
  const day = parseCivilDate(date.value)
  if (!valid.value || day === null || parsedAmount.value === null) {
    return
  }
  const typed = billingCellsOf({ item: item.value, date: day, amount: parsedAmount.value, client: client.value, description: description.value })
  const row = props.row
  if (row === null) {
    if (await writes.add([typed])) open.value = false
    return
  }
  const before = readCells(row.sheetRow)
  if (before === null) return
  const after: BillingCells = {
    item: typed.item === row.item ? before.item : typed.item,
    date: day === row.date ? before.date : typed.date,
    amount: parsedAmount.value === row.amount ? before.amount : typed.amount,
    client: typed.client === row.client ? before.client : typed.client,
    description: typed.description === row.description ? before.description : typed.description,
  }
  if (await writes.change({ sheetRow: row.sheetRow, before, after })) open.value = false
}

async function remove(): Promise<void> {
  const row = props.row
  const cells = row === null ? null : readCells(row.sheetRow)
  if (row === null || cells === null) return
  if (await writes.remove({ sheetRow: row.sheetRow, cells })) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="row === null ? 'Add a plan row' : 'Edit the plan row'"
    :description="row === null ? 'Something to invoice a client, from the day it becomes billable.' : `Row ${row.sheetRow} of the outgoing-plan tab. Only the cells you change are written.`"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="billing-row" class="grid gap-4 sm:grid-cols-2" data-testid="billing-row-form" @submit.prevent="save">
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
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="row !== null"
          label="Delete row"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="writes.busy.value"
          data-testid="billing-row-delete"
          @click="remove"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton type="submit" form="billing-row" :label="row === null ? 'Add row' : 'Save row'" :icon="row === null ? 'i-lucide-plus' : 'i-lucide-save'" :loading="writes.busy.value" :disabled="writes.busy.value" />
        </div>
      </div>
    </template>
  </UModal>
</template>
