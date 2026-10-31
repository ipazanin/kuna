<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import { writeTransaction } from '../application/transactionWrites'
import type { TransactionRecord } from '../domain/listedTransactions'
import { tradePreview } from '../domain/tradePreview'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { NO_RATES } from '../../prices/domain/rateBook'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import CashFields from './CashFields.vue'
import ExchangeFields from './ExchangeFields.vue'
import IncomeFields from './IncomeFields.vue'
import PriceFields from './PriceFields.vue'
import SpinOffFields from './SpinOffFields.vue'
import SplitFields from './SplitFields.vue'
import TradeFields from './TradeFields.vue'
import TradeSummary from './TradeSummary.vue'
import TransferFields from './TransferFields.vue'
import { HAPPENINGS, ecbRateText, happeningsOfKind, kindOfHappening, keyOf, rateCurrency, textsOf, transactionDraft } from './transactionForm'
import type { Happening, TransactionStart, TransactionTexts } from './transactionForm'
import { words } from './words'
import { parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { newRecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'

/**
 * Adds a record of what happened, or changes or deletes one: the kind first, then the fields it takes, with the rate at
 * the ECB's for the day and, for a trade, what it does to the account. Every write has Undo.
 */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  book: InvestmentBook
  /** The record to change, or null to add one. */
  editing: TransactionRecord | null
  /** Where a new record starts, a buy with no holding unless given. */
  start?: Partial<Omit<TransactionStart, 'today'>>
}>()

const store = useInvestmentsBooks()
const writes = useRecordWrites(store)
const { sources } = usePortfolio()

const book = computed(() => props.book)
const rates = computed(() => sources.value?.rates ?? null)

const texts = reactive<TransactionTexts>(textsOf(null, { happened: 'buy', instrument: null, today: today() }, props.book))
const key = ref('')
const tried = ref(false)
/** Whether the rate is the user's own rather than the ECB's, so a new date or currency leaves it alone. */
const rateTyped = ref(false)

const happenings = computed((): readonly Happening[] => (props.editing === null ? HAPPENINGS : happeningsOfKind(props.editing.kind)))
const happeningOptions = computed(() => happenings.value.map((value) => ({ value, label: words.dialog.happenings[value] })))

const currencyOfRate = computed(() => rateCurrency(texts, book.value))
const ecbRate = computed(() => ecbRateText(rates.value, currencyOfRate.value, texts.date))

watch(open, (opened) => {
  if (!opened) return
  const editing = props.editing
  Object.assign(texts, textsOf(editing, { happened: props.start?.happened ?? 'buy', instrument: props.start?.instrument ?? null, today: today() }, book.value))
  key.value = editing === null ? newRecordId() : keyOf(editing)
  tried.value = false
  rateTyped.value = editing !== null
  if (!rateTyped.value) texts.rate = ecbRate.value
})

watch(ecbRate, (rate) => {
  if (!rateTyped.value) texts.rate = rate
})

watch(
  () => texts.instrument,
  (instrument) => {
    const currency = book.value.instruments.find((candidate) => candidate.id === instrument)?.currency
    if (open.value && kindOfHappening(texts.happened) === 'income' && currency !== undefined) texts.currency = currency
  },
)

const draft = computed(() => transactionDraft(texts, book.value, key.value))
const kind = computed(() => kindOfHappening(texts.happened))

const rateHelp = computed(() => {
  const day = parseCivilDate(texts.date)
  return !rateTyped.value && ecbRate.value !== '' && day !== null ? words.fields.rateFromEcb(dayLabel(day)) : words.fields.rateTyped
})

const preview = computed(() => {
  const record = draft.value.record
  if (record?.kind !== 'trade') return null
  const instrument = book.value.instruments.find((candidate) => candidate.id === record.record.instrument)
  const account = book.value.accounts.find((candidate) => candidate.id === record.record.account)
  if (instrument === undefined || account === undefined) return null
  return { trade: record.record, instrument, account: account.name, figures: tradePreview(book.value, rates.value ?? NO_RATES, instrument, record.record) }
})

const kindName = computed(() => words.dialog.happenings[texts.happened])

async function save(): Promise<void> {
  tried.value = true
  const record = draft.value.record
  if (record === null) return
  const before = props.editing
  const written = await writes.write(before === null ? words.dialog.added(kindName.value) : words.dialog.saved(kindName.value), (unit) => writeTransaction(unit, before, record), {
    failedTitle: before === null ? words.dialog.notAdded : words.dialog.notSaved,
  })
  if (written) open.value = false
}

async function remove(): Promise<void> {
  const before = props.editing
  if (before === null) return
  if (await writes.write(words.dialog.deleted(kindName.value), (unit) => writeTransaction(unit, before, null), { failedTitle: words.dialog.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="editing === null ? words.dialog.addTitle : words.dialog.changeTitle" :description="words.dialog.description" width="2xl">
    <div v-if="happenings.length > 1" class="mb-5">
      <p class="mb-2 type-label">{{ words.dialog.happened }}</p>
      <ChoiceButtons v-model="texts.happened" :options="happeningOptions" :label="words.dialog.happened" data-testid="transaction-happened" />
    </div>
    <FormGrid id="transaction" as="form" data-testid="transaction-form" :data-kind="kind" @submit.prevent="save">
      <TradeFields v-if="kind === 'trade'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <IncomeFields v-else-if="kind === 'income'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <CashFields v-else-if="kind === 'cash-movement'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <ExchangeFields v-else-if="kind === 'exchange'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <TransferFields v-else-if="kind === 'transfer'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <SplitFields v-else-if="kind === 'split'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <SpinOffFields v-else-if="kind === 'spin-off'" v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <PriceFields v-else v-model="texts" :book="book" :errors="draft.errors" :tried="tried" />
      <UFormField v-if="currencyOfRate !== null" :label="words.fields.ratePer(currencyOfRate)" :help="rateHelp" :error="(tried && draft.errors.rate) || false">
        <UInput v-model="texts.rate" inputmode="decimal" class="w-full" data-testid="transaction-rate" @update:model-value="rateTyped = true" />
      </UFormField>
      <UFormField :label="words.fields.note" :help="words.fields.noteHelp" :error="(tried && draft.errors.note) || false" class="sm:col-span-2">
        <UInput v-model="texts.note" class="w-full" data-testid="transaction-note" />
      </UFormField>
    </FormGrid>
    <TradeSummary v-if="preview !== null" :preview="preview.figures" :trade="preview.trade" :instrument="preview.instrument" :account="preview.account" />
    <template #start>
      <UButton
        v-if="editing !== null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :disabled="writes.busy.value"
        data-testid="transaction-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="words.dialog.cancel" color="neutral" variant="ghost" :disabled="writes.busy.value" @click="open = false" />
      <UButton
        type="submit"
        form="transaction"
        :label="editing === null ? words.dialog.addButtons[texts.happened] : words.dialog.save"
        :icon="editing === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.busy.value"
        :disabled="writes.busy.value"
        data-testid="transaction-save"
      />
    </template>
  </AppDialog>
</template>
