<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { civilDateFromSerial, parseCivilDate } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { amountOf, moneyFromAmount } from '../../../shared/money/money'
import { typedAmount } from '../../../shared/money/typedAmount'
import { cellText } from '../../../shared/text/cellText'
import { storedCellsOf } from '../../workbook/application/tabRowWrites'
import type { RecordId } from '../../workbook/domain/recordId'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { RowCells } from '../../workbook/domain/rowChanges'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { INVOICE_ROWS, invoiceCellsOf } from '../application/invoiceRows'
import { newInvoiceDates } from '../../invoicing/domain/invoiceDates'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  /** Draw the invoice's PDF again, file it over the old one and save a fresh draft. */
  reexport: [id: RecordId]
}>()

const props = defineProps<{
  /** The invoice to edit, or null to add one. */
  id: RecordId | null
  clients: readonly { readonly slug: string; readonly name: string }[]
  /** Where a new invoice starts: the newest booking. */
  defaultIssued: CivilDate
  /** The number of the newest invoice, shown as a hint for the next one. */
  latestNumber: string
}>()

type Field = 'number' | 'client' | 'item' | 'amount' | 'issued' | 'due' | 'period_from' | 'period_to'

const store = useWorkbook()
const writes = useRowWrites(INVOICE_ROWS)
const phone = usePhoneLayout()

const fields = ref<Record<Field, string>>(blankFields())
const opened = ref<Record<Field, string>>(blankFields())
const tried = ref(false)

function blankFields(): Record<Field, string> {
  return { number: '', client: '', item: '', amount: '', issued: '', due: '', period_from: '', period_to: '' }
}

/** The row's cells as the app read them, raw, so a formula left alone is never rewritten. */
const readCells = computed((): RowCells | null => {
  return props.id === null ? null : storedCellsOf(store.state.snapshot?.invoices ?? [], INVOICE_ROWS, props.id)
})

function dateText(cell: RowCells[string] | undefined): string {
  return typeof cell === 'number' && Number.isFinite(cell) ? civilDateFromSerial(cell) : cellText(cell)
}

function fieldsOf(cells: RowCells): Record<Field, string> {
  const amount = cells.amount
  return {
    number: cellText(cells.number),
    client: cellText(cells.client).toLowerCase(),
    item: cellText(cells.item),
    amount: typeof amount === 'number' ? amountOf(moneyFromAmount(amount)).toFixed(2) : cellText(amount),
    issued: dateText(cells.issued),
    due: dateText(cells.due),
    period_from: dateText(cells.period_from),
    period_to: dateText(cells.period_to),
  }
}

watch(open, (opening) => {
  if (!opening) return
  const cells = readCells.value
  if (cells === null) {
    const dates = newInvoiceDates(props.defaultIssued)
    const client = props.clients.length === 1 ? props.clients[0]!.slug : ''
    fields.value = { ...blankFields(), client, issued: props.defaultIssued, due: dates.due, period_from: dates.periodFrom, period_to: dates.periodTo }
  } else {
    fields.value = fieldsOf(cells)
  }
  opened.value = { ...fields.value }
  tried.value = false
})

const clientItems = computed(() => props.clients.map((client) => ({ label: client.name || client.slug, value: client.slug })))

const parsedAmount = computed(() => {
  const cents = typedAmount(fields.value.amount)
  return cents !== null && cents > 0 ? cents : null
})

function optionalDate(text: string): CivilDate | null | undefined {
  return text.trim() === '' ? null : (parseCivilDate(text.trim()) ?? undefined)
}

const errors = computed(() => {
  const issued = parseCivilDate(fields.value.issued.trim())
  const due = optionalDate(fields.value.due)
  const from = optionalDate(fields.value.period_from)
  const to = optionalDate(fields.value.period_to)
  return {
    number: fields.value.number.trim() === '' ? 'The invoice number, such as it is printed' : null,
    client: fields.value.client === '' ? 'Choose the client' : null,
    amount: parsedAmount.value === null ? 'An amount above zero with at most two decimals' : null,
    issued: issued === null ? 'A date, such as 2026-10-31' : null,
    due: due === undefined ? 'A date, or blank for none' : due !== null && issued !== null && due < issued ? 'Not before the issue date' : null,
    period:
      from === undefined || to === undefined
        ? 'Dates, such as 2026-10-01 and 2026-10-31'
        : (from === null) !== (to === null)
          ? 'Both dates, or neither'
          : from !== null && to !== null && to < from
            ? 'The end comes after the start'
            : null,
  }
})

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

async function save(): Promise<void> {
  tried.value = true
  const issued = parseCivilDate(fields.value.issued.trim())
  if (!valid.value || issued === null || parsedAmount.value === null) return
  const typed = invoiceCellsOf({
    number: fields.value.number,
    client: fields.value.client,
    item: fields.value.item,
    amount: parsedAmount.value,
    issued,
    due: optionalDate(fields.value.due) ?? null,
    periodFrom: optionalDate(fields.value.period_from) ?? null,
    periodTo: optionalDate(fields.value.period_to) ?? null,
  })
  const before = readCells.value
  if (props.id === null || before === null) {
    if (await writes.write({ added: [typed], changed: [], removed: [] }, { title: 'Invoice added' }, 'Not added')) open.value = false
    return
  }
  const after: RowCells = Object.fromEntries(
    INVOICE_ROWS.columns.map((column) => [column, (fields.value[column as Field] === opened.value[column as Field] ? before[column] : typed[column]) ?? '']),
  )
  const saved = await writes.write(
    { added: [], changed: [{ before, after }], removed: [] },
    { title: 'Invoice saved', description: `Invoice ${opened.value.number}, written to ${writes.where()}.` },
    'Not saved',
  )
  if (saved) open.value = false
}

async function remove(): Promise<void> {
  const cells = readCells.value
  if (props.id === null || cells === null) return
  const deleted = await writes.write(
    { added: [], changed: [], removed: [cells] },
    { title: 'Invoice deleted', description: `Invoice ${opened.value.number} is taken out of ${writes.where()}.` },
    'Not deleted',
  )
  if (deleted) open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="id === null ? 'Add an invoice' : `Edit invoice ${opened.number}`"
    :description="id === null ? 'One row of the invoices tab, for an invoice made elsewhere. Make invoice draws, files and records a new one.' : 'On the invoices tab. Only the cells you change are written.'"
    :fullscreen="phone"
    :ui="{ header: 'pe-16 sm:pe-6' }"
  >
    <template #body>
      <form id="invoice-row" class="grid gap-4 sm:grid-cols-2" data-testid="invoice-form" @submit.prevent="save">
        <UFormField label="Number" :error="(tried && errors.number) || false" :help="id === null && latestNumber ? `Each once. The newest is ${latestNumber}.` : 'Each number once.'">
          <UInput v-model="fields.number" class="w-full" data-testid="invoice-number" />
        </UFormField>
        <UFormField label="Client" :error="(tried && errors.client) || false" help="From Invoicing, Clients.">
          <USelect v-model="fields.client" :items="clientItems" placeholder="Choose a client" class="w-full" data-testid="invoice-client" />
        </UFormField>
        <UFormField label="Item" help="What the invoice is for.">
          <UInput v-model="fields.item" class="w-full" data-testid="invoice-item" />
        </UFormField>
        <UFormField label="Amount" :error="(tried && errors.amount) || false" help="The invoice total.">
          <UInput v-model="fields.amount" inputmode="decimal" placeholder="0.00" class="w-full" data-testid="invoice-amount" />
        </UFormField>
        <UFormField label="Issued" :error="(tried && errors.issued) || false" help="The date on the invoice.">
          <UInput v-model="fields.issued" type="date" class="w-full" data-testid="invoice-issued" />
        </UFormField>
        <UFormField label="Due" :error="(tried && errors.due) || false" help="Blank when it gives none.">
          <UInput v-model="fields.due" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Work from" :error="(tried && errors.period) || false">
          <UInput v-model="fields.period_from" type="date" class="w-full" />
        </UFormField>
        <UFormField label="Work to">
          <UInput v-model="fields.period_to" type="date" class="w-full" />
        </UFormField>
        <p class="-mt-2 text-xs text-muted sm:col-span-2">The work the invoice is for, which its revenue counts in. Both dates or neither.</p>
      </form>
    </template>
    <template #footer>
      <div class="flex w-full flex-wrap items-center gap-2">
        <UButton
          v-if="id !== null"
          label="Delete invoice"
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          :disabled="writes.busy.value"
          data-testid="invoice-delete"
          @click="remove"
        />
        <UButton
          v-if="id !== null"
          label="Re-export"
          icon="i-lucide-file-output"
          color="neutral"
          variant="ghost"
          title="Draw the PDF again, replace it in Drive and save a fresh mail draft"
          :disabled="writes.busy.value"
          data-testid="invoice-reexport"
          @click="emit('reexport', id)"
        />
        <div class="ms-auto flex flex-wrap gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
          <UButton
            type="submit"
            form="invoice-row"
            :label="id === null ? 'Add invoice' : 'Save invoice'"
            :icon="id === null ? 'i-lucide-plus' : 'i-lucide-save'"
            :loading="writes.busy.value"
            :disabled="writes.busy.value"
            data-testid="invoice-save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
