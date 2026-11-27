<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { today } from '../../../../shared/calendar/civilDate'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { capitalised } from '../../../../shared/text/capitalised'
import { ibanListOf } from '../../../../shared/text/iban'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import { expectedInvoices } from '../../billingPlan/domain/expectedInvoices'
import { planItemsOf } from '../../billingPlan/domain/planItems'
import IbanTagsField from '../../../../shared/ui/IbanTagsField.vue'
import { words as settingsWords } from '../../settings/presentation/words'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { clientFieldsWith, clientOfFields } from '../../workbook/domain/clientsReading'
import type { ClientTextField } from '../../workbook/domain/clientsReading'
import { recordsOfKindIn } from '../../workbook/domain/readWorkbook'
import { CLIENT_WRITES, clientCellsOf, clientChecksOf } from '../application/clientWrites'
import { words as writeWords } from '../application/words'
import { clientChangeRefusals } from '../domain/clientGuards'
import { openRowsFor, templatedLines } from '../domain/invoiceLines'
import { monthInLanguage } from '../domain/invoiceMail'
import { templateOfText, templateProblems } from '../domain/invoiceTemplate'
import type { InvoiceTemplateLine } from '../domain/invoiceTemplate'
import { words as domainWords } from '../domain/words'
import ClientLinesField from './ClientLinesField.vue'
import { words } from './words'
import { useTried } from '../../../../shared/ui/useTried'

/**
 * Every field of one client, its invoice lines among them, saved in one write with Undo. It starts from
 * the client's stored fields, so a field it does not show is kept, and it refuses what the clients grid refuses.
 * Stored lines the reader doubts block Save only once they are changed, so an IBAN can be fixed without them.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The client's short name as the dialog opened on it. */
  slug: string
}>()

const store = useWorkbook()
const writes = useRecordWrites(store)

type TextFields = Record<ClientTextField, string>
const FIELDS: readonly ClientTextField[] = ['client', 'name', 'iban', 'address', 'country', 'tax_id', 'invoice_mail', 'mail_language']

const texts = ref<Omit<TextFields, 'iban'>>({ client: '', name: '', address: '', country: '', tax_id: '', invoice_mail: '', mail_language: '' })
const ibans = ref<string[]>([])
const reverseCharge = ref(false)
const lines = ref<InvoiceTemplateLine[]>([])
const openedLines = ref('')
const { tried, markTried } = useTried(open)

const stored = computed(() => store.state.records?.clients.records.find((candidate) => candidate.record.slug === props.slug) ?? null)

watch(open, (opening) => {
  if (!opening) return
  const fields = stored.value?.fields ?? {}
  const client = stored.value?.record
  texts.value = {
    client: client?.slug ?? props.slug,
    name: client?.name ?? '',
    address: client?.invoicing.address ?? '',
    country: client?.invoicing.country ?? '',
    tax_id: client?.invoicing.taxId ?? '',
    invoice_mail: client?.invoicing.invoiceMail ?? '',
    mail_language: client?.invoicing.mailLanguage ?? '',
  }
  ibans.value = [...(client?.ibans ?? [])]
  reverseCharge.value = client?.invoicing.reverseCharge ?? false
  // Lines the reader doubts still show, so they can be fixed here.
  lines.value = templateOfText(fields.invoice_lines?.text ?? '')
  openedLines.value = JSON.stringify(lines.value)
})

/** The client's stored fields with what the dialog holds. */
const afterFields = computed(() =>
  clientFieldsWith(stored.value?.fields ?? {}, {
    texts: { ...texts.value, iban: ibans.value.join(', ') },
    reverseCharge: reverseCharge.value,
    lines: lines.value.map((line) => ({ text: line.text.trim(), items: line.items })),
  }),
)

const linesChanged = computed(() => JSON.stringify(lines.value) !== openedLines.value)
const lineProblems = computed(() => (linesChanged.value ? templateProblems(lines.value) : []))

/** What the clients grid's write would refuse, by the field it is about. */
const refusals = computed(() => {
  const records = store.state.records
  const before = stored.value
  if (records === null || records === undefined || before === null) return []
  const untouched = records.clients.records.filter((other) => other !== before).map((other) => clientCellsOf(other.fields))
  return clientChangeRefusals([{ before: clientCellsOf(before.fields), after: clientCellsOf(afterFields.value) }], untouched, clientChecksOf({ of: (kind) => recordsOfKindIn(records, kind) }))
})

function refusalOf(field: 'client' | 'iban'): string | null {
  const found = refusals.value.filter((refusal) => refusal.field === field).map(writeWords.clientRefusal)
  return found.length === 0 ? null : found.join(' ')
}

const errors = computed(() => ({
  client: texts.value.client.trim() === '' ? words.clientDialog.needsName : refusalOf('client'),
  iban: ibanListOf(ibans.value.join(', ')).length === 0 ? words.clientDialog.needsIban : refusalOf('iban'),
  lines: lines.value.map((_, index) => {
    const found = lineProblems.value.filter((problem) => problem.line === index).map((problem) => domainWords.templateProblem(problem))
    return found.length === 0 ? null : capitalised(found.join(', '))
  }),
}))

const valid = computed(() => errors.value.client === null && errors.value.iban === null && errors.value.lines.every((error) => error === null))

const previewDay = today()
const preview = computed(() => {
  const workbook = store.state.workbook
  if (workbook === null || workbook === undefined) return []
  const open = openRowsFor(expectedInvoices(workbook.billingPlan, workbook.invoices), props.slug, previewDay)
  return templatedLines(open, lines.value, texts.value.mail_language, previewDay)
})
const previewMonth = computed(() => monthInLanguage(previewDay, texts.value.mail_language))
const planItems = computed(() => planItemsOf(store.state.workbook?.billingPlan ?? [], props.slug))

async function save(): Promise<void> {
  markTried()
  const before = stored.value
  if (!valid.value || before === null) return
  if (await writes.write(words.clientDialog.saved, (unit) => unit.of(CLIENT_WRITES).change(before.record, clientOfFields(afterFields.value)), { failedTitle: words.clientDialog.notSaved }))
    open.value = false
}

async function remove(): Promise<void> {
  const before = stored.value
  if (before === null) return
  if (await writes.write(words.clientDialog.deleted, (unit) => unit.of(CLIENT_WRITES).remove(before.record), { key: 'delete', failedTitle: words.clientDialog.notDeleted })) open.value = false
}

const fieldHelp: Partial<Record<ClientTextField, string>> = {
  client: words.clientDialog.clientHelp,
  name: words.clientDialog.nameHelp,
  mail_language: words.clientDialog.mailLanguageHelp,
}
</script>

<template>
  <AppDialog v-model:open="open" :title="words.clientDialog.title(stored?.record.name || slug)" width="xl" changes>
    <FormGrid id="client-form" as="form" data-testid="client-form" @submit.prevent="save">
      <template v-for="field in FIELDS" :key="field">
        <UFormField v-if="field === 'iban'" :label="settingsWords.clientColumns.iban" :help="words.clientDialog.ibansHelp" :error="(tried && errors.iban) || false" class="sm:col-span-2">
          <IbanTagsField v-model="ibans" class="w-full" data-testid="client-ibans" />
        </UFormField>
        <UFormField
          v-else
          :label="settingsWords.clientColumns[field]"
          v-bind="fieldHelp[field] === undefined ? {} : { help: fieldHelp[field] }"
          :error="(tried && field === 'client' && errors.client) || false"
          :class="{ 'sm:col-span-2': field === 'address' }"
        >
          <UInput v-model="texts[field]" class="w-full" v-bind="field === 'mail_language' ? { placeholder: 'en' } : {}" :data-testid="`client-${field}`" />
        </UFormField>
      </template>
      <UFormField :help="words.clientDialog.reverseChargeHelp" class="sm:col-span-2">
        <USwitch v-model="reverseCharge" :label="settingsWords.clientColumns.reverse_charge" data-testid="client-reverse-charge" />
      </UFormField>
      <ClientLinesField v-model="lines" :plan-items="planItems" :errors="tried ? errors.lines : []" :preview="preview" :month="previewMonth" :disabled="writes.refused.value" />
    </FormGrid>
    <template #start>
      <UButton
        :label="words.clientDialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="client-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="words.clientDialog.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="client-form"
        :label="words.clientDialog.save"
        icon="i-lucide-save"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="client-save"
      />
    </template>
  </AppDialog>
</template>
