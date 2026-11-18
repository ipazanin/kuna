<script lang="ts">
import type { Money } from '../../../../shared/money/money'

/** What the dialog starts on for a payment Place opens it with: the payment ticked, and for a new invoice its client and amount. */
export interface InvoicePrefill {
  readonly client: string
  /** The amount a new invoice starts on, read positive. */
  readonly amount: Money
  /** The payment's choice among Paid by's. */
  readonly payment: string
}
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { formatMoney } from '../../../../shared/money/moneyFormat'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { amountForTyping, typedAmount } from '../../../../shared/money/typedAmount'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { useBookedWorkbook } from '../../transactions/application/useBookedWorkbook'
import { inPickingOrder, placedShares } from '../../workbook/domain/rowPayments'
import PaymentsSelect from '../../workbook/presentation/PaymentsSelect.vue'
import { storesItems } from '../../workbook/domain/rowItems'
import { invoiceIdOf } from '../../workbook/domain/invoicesReading'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredField, StoredFields } from '../../../../shared/storage/domain/storedFields'
import type { Invoice } from '../../workbook/domain/workbook'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { removeInvoice } from '../application/invoiceWrites'
import { writeInvoice } from '../application/invoicePaymentWrites'
import { paymentChoices } from '../domain/invoicePayments'
import { invoiceDatesProblems } from '../domain/invoiceGuards'
import { newInvoiceDates } from '../../invoicing/domain/invoiceDates'
import { words } from './words'

const open = defineModel<boolean>('open', { required: true })

const emit = defineEmits<{
  /** Draw the invoice's PDF again, file it over the old one and save a fresh draft. */
  reexport: [id: RecordId]
}>()

const props = withDefaults(
  defineProps<{
    /** The invoice to edit, or null to add one. */
    id: RecordId | null
    clients: readonly { readonly slug: string; readonly name: string }[]
    /** Where a new invoice starts: the newest booking. */
    defaultIssued: CivilDate
    /** The number of the newest invoice, shown as a hint for the next one. */
    latestNumber: string
    /** A payment to place, which the form starts ticked. */
    prefill?: InvoicePrefill | null
  }>(),
  { prefill: null },
)

type Field = 'number' | 'client' | 'item' | 'amount' | 'issued' | 'due' | 'period_from' | 'period_to'

const store = useWorkbook()
const booked = useBookedWorkbook()
const writes = useRecordWrites(store)

const fields = ref<Record<Field, string>>(blankFields())
const opened = ref<Record<Field, string>>(blankFields())
const tried = ref(false)
/** The payments ticked under Paid by, by their choice's key, and those the invoice held when the dialog opened. */
const paidBy = ref<string[]>([])
const openedPaidBy = ref<string[]>([])

function blankFields(): Record<Field, string> {
  return { number: '', client: '', item: '', amount: '', issued: '', due: '', period_from: '', period_to: '' }
}

/** The invoice as the app read it, with its fields as stored, so a field the dialog cannot read still shows. */
const stored = computed(() => (props.id === null ? null : recordWithId(store.state.records?.invoices ?? NO_RECORDS, props.id)))

function dateText(field: StoredField | undefined): string {
  return field?.date ?? textOf(field)
}

function fieldsOf(stored: StoredFields): Record<Field, string> {
  const amount = stored.amount?.money ?? null
  return {
    number: textOf(stored.number),
    client: textOf(stored.client).toLowerCase(),
    item: textOf(stored.item),
    amount: amount === null ? textOf(stored.amount) : amountForTyping(amount),
    issued: dateText(stored.issued),
    due: dateText(stored.due),
    period_from: dateText(stored.period_from),
    period_to: dateText(stored.period_to),
  }
}

watch(open, (opening) => {
  if (!opening) return
  const read = stored.value
  if (read === null) {
    const dates = newInvoiceDates(props.defaultIssued)
    const client = props.prefill?.client ?? (props.clients.length === 1 ? props.clients[0]!.slug : '')
    const amount = props.prefill === null ? '' : amountForTyping(props.prefill.amount)
    fields.value = { ...blankFields(), client, amount, issued: props.defaultIssued, due: dates.due, period_from: dates.periodFrom, period_to: dates.periodTo }
  } else {
    fields.value = fieldsOf(read.fields)
  }
  opened.value = { ...fields.value }
  openedPaidBy.value = choices.value.filter((choice) => choice.named).map((choice) => choice.key)
  paidBy.value = [...openedPaidBy.value, ...(props.prefill === null ? [] : [props.prefill.payment])]
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
  const dates = invoiceDatesProblems(issued, due ?? null, from ?? null, to ?? null)
  return {
    number: fields.value.number.trim() === '' ? words.dialog.numberError : null,
    client: fields.value.client === '' ? words.dialog.clientError : null,
    amount: parsedAmount.value === null ? words.dialog.amountError : null,
    issued: issued === null ? words.dialog.issuedError : null,
    due: due === undefined ? words.dialog.dueError : dates.due === 'before-issue' ? words.dialog.dueBeforeIssue : null,
    paidBy: notNeeded.value === null ? null : words.dialog.notNeeded(dayLabel(notNeeded.value.payment.date)),
    period: from === undefined || to === undefined ? words.dialog.periodError : dates.period === 'one-end' ? words.dialog.periodBoth : dates.period === 'order' ? words.dialog.periodOrder : null,
  }
})

/** The client payments the invoice may take, on books with an items tab: those it holds, and those no invoice holds from its client or from an account no client names. */
const choices = computed(() => {
  const workbook = booked.value
  const records = store.state.records
  const client = fields.value.client
  return workbook === null || records === null || records === undefined || !storesItems(records) || client === '' ? [] : paymentChoices(workbook, props.id, client)
})

const paymentItems = computed(() =>
  inPickingOrder(choices.value).map((choice) => ({
    label: words.dialog.payment(dayLabel(choice.payment.date), formatMoney(choice.amount), choice.payment.counterparty || choice.payment.description || words.dialog.paymentFrom),
    value: choice.key,
  })),
)

/** The payments ticked, in the order they were paid, among those on offer for the client chosen. */
const chosen = computed(() => choices.value.filter((choice) => paidBy.value.includes(choice.key)))

/** The first ticked payment the invoice is paid in full without, or null. */
const notNeeded = computed(() => {
  if (parsedAmount.value === null) return null
  const applied = placedShares(parsedAmount.value, chosen.value)
  return chosen.value.find((_, index) => applied[index]! <= 0) ?? null
})

/** The payments the save places, or null when they are the ones the invoice held when the dialog opened. */
const placement = computed(() => {
  const ticked = chosen.value.map((choice) => choice.key)
  const same = ticked.length === openedPaidBy.value.length && ticked.every((key) => openedPaidBy.value.includes(key))
  return same ? null : chosen.value
})

const valid = computed(() => Object.values(errors.value).every((error) => error === null))

async function save(): Promise<void> {
  tried.value = true
  const issued = parseCivilDate(fields.value.issued.trim())
  if (!valid.value || issued === null || parsedAmount.value === null) return
  const from = optionalDate(fields.value.period_from) ?? null
  const to = optionalDate(fields.value.period_to) ?? null
  const number = fields.value.number.trim()
  const client = fields.value.client.trim().toLowerCase()
  const typed: Invoice = {
    number,
    client,
    item: fields.value.item.trim(),
    amount: parsedAmount.value,
    issued,
    due: optionalDate(fields.value.due) ?? null,
    deliveryPeriod: from === null || to === null ? null : { from, to },
    id: invoiceIdOf({ client, number }),
  }
  const before = stored.value?.record ?? null
  const { records, workbook } = store.state
  if (records === null || records === undefined || workbook === null || workbook === undefined) return
  const books = { records, workbook }
  if (props.id === null || before === null) {
    if (await writes.write(words.dialog.added, (unit) => writeInvoice(unit, books, null, typed, placement.value), { failedTitle: words.dialog.notAdded })) open.value = false
    return
  }
  const changed = (field: Field): boolean => fields.value[field] !== opened.value[field]
  const kept = {
    number: changed('number') ? typed.number : before.number,
    client: changed('client') ? typed.client : before.client,
  }
  const after: Invoice = {
    ...kept,
    item: changed('item') ? typed.item : before.item,
    amount: changed('amount') ? typed.amount : before.amount,
    issued: changed('issued') ? typed.issued : before.issued,
    due: changed('due') ? typed.due : before.due,
    deliveryPeriod: changed('period_from') || changed('period_to') ? typed.deliveryPeriod : before.deliveryPeriod,
    id: invoiceIdOf(kept),
  }
  if (await writes.write(words.dialog.saved, (unit) => writeInvoice(unit, books, before, after, placement.value), { failedTitle: words.dialog.notSaved })) open.value = false
}

async function remove(): Promise<void> {
  const before = stored.value?.record ?? null
  if (props.id === null || before === null) return
  if (await writes.write(words.dialog.deleted, (unit) => removeInvoice(unit, store.state.records?.items ?? NO_RECORDS, before), { key: 'delete', failedTitle: words.dialog.notDeleted }))
    open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="id === null ? words.dialog.addTitle : words.dialog.editTitle(opened.number)"
    :description="id === null ? words.dialog.addDescription : words.dialog.editDescription"
  >
    <FormGrid id="invoice-row" as="form" data-testid="invoice-form" @submit.prevent="save">
      <UFormField :label="words.dialog.number" :error="(tried && errors.number) || false" :help="id === null && latestNumber ? words.dialog.numberNewest(latestNumber) : words.dialog.numberOnce">
        <UInput v-model="fields.number" class="w-full" data-testid="invoice-number" />
      </UFormField>
      <UFormField :label="words.dialog.client" :error="(tried && errors.client) || false" :help="words.dialog.clientHelp">
        <USelect v-model="fields.client" :items="clientItems" :placeholder="words.dialog.clientPlaceholder" class="w-full" data-testid="invoice-client" />
      </UFormField>
      <UFormField :label="words.dialog.item" :help="words.dialog.itemHelp">
        <UInput v-model="fields.item" class="w-full" data-testid="invoice-item" />
      </UFormField>
      <UFormField :label="words.dialog.amount" :error="(tried && errors.amount) || false" :help="words.dialog.amountHelp">
        <UInput v-model="fields.amount" inputmode="decimal" :placeholder="words.dialog.amountPlaceholder" class="w-full" data-testid="invoice-amount" />
      </UFormField>
      <UFormField :label="words.dialog.issued" :error="(tried && errors.issued) || false" :help="words.dialog.issuedHelp">
        <DayField v-model="fields.issued" class="w-full" data-testid="invoice-issued" />
      </UFormField>
      <UFormField :label="words.dialog.due" :error="(tried && errors.due) || false" :help="words.dialog.dueHelp">
        <DayField v-model="fields.due" class="w-full" />
      </UFormField>
      <UFormField :label="words.dialog.workFrom" :error="(tried && errors.period) || false">
        <DayField v-model="fields.period_from" class="w-full" />
      </UFormField>
      <UFormField :label="words.dialog.workTo">
        <DayField v-model="fields.period_to" class="w-full" />
      </UFormField>
      <p class="-mt-2 type-caption">{{ words.dialog.periodHelp }}</p>
      <UFormField v-if="paymentItems.length > 0" :label="words.dialog.paidBy" :help="words.dialog.paidByHelp" :error="(tried && errors.paidBy) || false" class="sm:col-span-2">
        <PaymentsSelect v-model="paidBy" data-testid="invoice-paid-by" :payments="paymentItems" :none="words.dialog.notPaid" :search="words.dialog.searchPayments" />
      </UFormField>
    </FormGrid>
    <template #start>
      <UButton
        v-if="id !== null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="invoice-delete"
        @click="remove"
      />
      <UButton
        v-if="id !== null"
        :label="words.dialog.reexport"
        icon="i-lucide-file-output"
        color="neutral"
        variant="ghost"
        :title="words.dialog.reexportHelp"
        data-testid="invoice-reexport"
        @click="emit('reexport', id)"
      />
    </template>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="invoice-row"
        :label="id === null ? words.dialog.add : words.dialog.save"
        :icon="id === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="invoice-save"
      />
    </template>
  </AppDialog>
</template>
