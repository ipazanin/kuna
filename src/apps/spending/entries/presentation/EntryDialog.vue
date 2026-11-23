<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'

import { entryCategoryChoices } from './categoryChoices'
import EntryPartFields from './EntryPartFields.vue'
import { usePartFiling } from './usePartFiling'
import { sharedCostHomes } from '../../sharedCosts/presentation/sharedCostNames'
import { words as sharedCostWords } from '../../sharedCosts/presentation/words'
import EntrySplitDialog from './EntrySplitDialog.vue'
import LabelsAndEventFields from './LabelsAndEventFields.vue'
import { rememberLastAccount, startingAccount } from '../infrastructure/lastAccount'
import { words } from './words'
import { newTransfer } from '../domain/transfer'
import TransferToFields from './TransferToFields.vue'
import { positiveAmount, useTransferTyping } from './useTransferTyping'
import { useLabelsAndEvents } from './useLabelsAndEvents'
import { newEntry, otherLegOf, deleteComesBack, removeEntry, removeSplitOf, writeEntry, writeTransfer } from '../application/entryWrites'
import { sourceOf } from '../../links/application/linkTargets'
import { addInAppWords } from '../../links/presentation/addInApp'
import type { AddInApp } from '../../links/presentation/addInApp'
import AddInAppForm from '../../links/presentation/AddInAppForm.vue'
import EntryLinkField from '../../links/presentation/EntryLinkField.vue'
import { words as linkWords } from '../../links/presentation/words'
import CountsUnderField from '../../payees/presentation/CountsUnderField.vue'
import PayeeField from '../../payees/presentation/PayeeField.vue'
import { usePayeeMemory } from '../../payees/presentation/usePayeeMemory'
import { words as payeeWords } from '../../payees/presentation/words'
import { lineFilingOf, lineRefilesOf, refiledReceiptLines } from '../../receipts/domain/receiptLines'
import type { LineFiling } from '../../receipts/domain/receiptLines'
import EntryReceipt from '../../receipts/presentation/EntryReceipt.vue'
import RowLines from '../../receipts/presentation/RowLines.vue'
import { words as receiptWords } from '../../receipts/presentation/words'
import { shortcutOffer } from '../../shortcuts/presentation/shortcutOffer'
import { setPayeeParty } from '../../payees/application/payeeWrites'
import { isPerson, payeeDirectory } from '../../payees/domain/payeeDirectory'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { fixedByBank } from '../domain/bankRows'
import { beforeStartDay, takesNewRowsByHand } from '../../workbook/domain/account'
import type { Account } from '../../workbook/domain/account'
import { BY_DAYS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import { isSplit, itemizedRow, rowItemsOf } from '../../workbook/domain/rowItems'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import { absAccountMoney, negateAccountMoney } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import OptionalSelect from '../../../../shared/ui/OptionalSelect.vue'
import { words as uiWords } from '../../../../shared/ui/words'
import { EURO } from '../../../../shared/money/currencyCode'

/** Money out of an account, money into one, or a move between two of your accounts, typed as a positive amount. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The entry to change, either leg of a transfer, or null to add one. */
  entry: Transaction | null
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

type EntryKind = 'out' | 'in' | 'transfer'

const accounts = computed(() => store.state.workbook?.accounts ?? [])
const categories = computed(() => store.state.workbook?.categories ?? [])
const transferCategory = computed(() => transferCategoryOf(categories.value))

const kind = ref<EntryKind>('out')
const amount = ref('')
const toAmount = ref('')
const lessArrived = ref(false)
const category = ref('')
const account = ref('')
const toAccount = ref('')
const date = ref('')
const payee = ref('')
const note = ref('')
/** The labels and event choice of an entry not split. A split one's parts keep theirs by the part's id. */
const labels = ref<readonly RecordId[]>([])
const event = ref<EventChoice>(BY_DAYS)
const day = computed(() => parseCivilDate(date.value))
const kit = useLabelsAndEvents(() => day.value)
const { labelling: keepsLabels, partLabels, partEvents, start, addCarried } = kit
/** Who an entry not split counts under, and each part of a split one by the part's id, blank for the entry's payee. */
const countsUnder = ref('')
const partPayees = ref<Record<string, string>>({})
/** The category and note of each receipt line by its id, which its heading follows and Save files the line under. */
const lineFilings = ref<Record<string, LineFiling>>({})
const lineRefiles = computed(() => lineRefilesOf(partFiling.filing.value.categories, entryLines.value, lineFilings.value, partFiling.joining.value))
/** Why Save cannot file a changed receipt line under its category, by the line's id. */
const lineRefusals = computed(() => new Map([...lineRefiles.value.refused].map(([line, refusal]) => [line, words.split.refusals[refusal]])))
const tried = ref(false)

/** The form's fields apart from Category as one text, to tell whether the person changed any since the dialog opened. The link field compares Category itself. */
const formNow = computed(() =>
  JSON.stringify([
    kind.value,
    amount.value,
    toAmount.value,
    lessArrived.value,
    account.value,
    toAccount.value,
    date.value,
    payee.value,
    note.value,
    countsUnder.value,
    partPayees.value,
    labels.value,
    partLabels.value,
    event.value,
    partEvents.value,
    lineFilings.value,
  ]),
)
const openedAs = ref('')
/** Whether the form holds changes apart from Category not saved yet, which leaving for Loans would lose. */
const edited = computed(() => formNow.value !== openedAs.value)

/** The entry and its other leg as the file holds them, the money-out leg first. */
const legs = computed((): readonly [Transaction, Transaction] | null => {
  const records = store.state.records
  if (props.entry === null || records === null) return null
  const other = otherLegOf(records, props.entry)
  if (other === null) return null
  return props.entry.amount < 0 ? [props.entry, other] : [other, props.entry]
})

/** The entry's items: the one that holds all of its money, or what a receipt or you split it into. */
const entryLines = computed(() => (props.entry === null ? [] : rowItemsOf({ items: store.state.workbook?.items ?? [] })(props.entry)))
const split = computed(() => isSplit(entryLines.value))
/** The shared costs the pickers offer beside the categories, and what a pick files a part under. */
const partFiling = usePartFiling(() => entryLines.value.map((line) => line.sharedCost))
const homes = computed(() => sharedCostHomes(store.state.workbook))
/** The one item of an entry not split, whose category and note the form edits. */
const wholeItem = computed(() => (split.value ? null : (entryLines.value[0] ?? null)))
const receipt = computed(() => (store.state.workbook?.receipts ?? []).find((held) => held.transaction === props.entry?.id) ?? null)
const splitOpen = ref(false)

/** The currency of the account the saved entry is on, which its link compares with Loans' plan in. */
const entryCurrency = computed(() => (props.entry === null ? EURO : (accountOf(props.entry.account)?.currency ?? EURO)))

/** What the entry's parts are: a receipt's lines, the plan's interest and principal its link split it into, or parts you made. */
const splitNote = computed(() => {
  if (receipt.value !== null) return receiptWords.splitNote
  const link = entryLines.value.some((line) => line.splitByLink) ? (entryLines.value.find((line) => line.link !== null)?.link ?? null) : null
  return link === null ? words.split.note : linkWords.splitNote[sourceOf(link.app)]
})

/** While set, the dialog adds a record in Loans or Company from the saved entry, and its footer goes back or adds and links. */
const adding = ref<AddInApp | null>(null)
const addingWords = computed(() => (adding.value === null ? null : addInAppWords(adding.value)))
const addingSaving = ref(false)

/** The open accounts that take typed rows on the entry's day, and the ones the entry is already on, closed or filled by the bank or its file. */
const choosable = computed(() => {
  const own = new Set([props.entry?.account, ...(legs.value ?? []).map((leg) => leg.account)])
  return accounts.value.filter((candidate) => takesNewRowsByHand(candidate, day.value ?? today()) || own.has(candidate.id))
})
const accountItems = computed(() => choosable.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string, description: candidate.currency })))

/** A row the bank booked keeps the way its money went, since out and in set the amount's sign. */
const kindOptions = computed(() => [
  ...(props.entry !== null && bookedByBank(props.entry)
    ? [props.entry.amount < 0 ? { value: 'out' as const, label: words.dialog.kinds.out } : { value: 'in' as const, label: words.dialog.kinds.in }]
    : [
        { value: 'out' as const, label: words.dialog.kinds.out },
        { value: 'in' as const, label: words.dialog.kinds.in },
      ]),
  ...(transferCategory.value !== null && (choosable.value.length > 1 || legs.value !== null) ? [{ value: 'transfer' as const, label: words.dialog.kinds.transfer }] : []),
])

const categoryItems = computed(() => (kind.value === 'transfer' ? [] : entryCategoryChoices(categories.value, kind.value, wholeItem.value?.category ?? null, { sharedCosts: partFiling.offers.value })))
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))
const memory = usePayeeMemory(category, () => pickable.value)

function accountOf(id: string): Account | null {
  return accounts.value.find((candidate) => candidate.id === id) ?? null
}

const from = computed(() => accountOf(account.value))
const to = computed(() => accountOf(toAccount.value))

watch(open, (opened) => {
  if (!opened) return
  const entry = props.entry
  const pair = legs.value
  const first = startingAccount(accounts.value, props.entry?.date ?? today())
  kind.value = pair !== null ? 'transfer' : entry === null || entry.amount < 0 ? 'out' : 'in'
  account.value = (pair?.[0] ?? entry)?.account ?? first?.id ?? ''
  toAccount.value = pair?.[1].account ?? choosable.value.find((candidate) => candidate.id !== account.value)?.id ?? ''
  amount.value = entry === null ? '' : amountForTyping(absAccountMoney((pair?.[0] ?? entry).amount))
  toAmount.value = pair === null ? '' : amountForTyping(absAccountMoney(pair[1].amount))
  lessArrived.value = false
  category.value = wholeItem.value?.sharedCost ?? wholeItem.value?.category ?? ''
  date.value = entry?.date ?? today()
  payee.value = entry?.payee ?? ''
  note.value = wholeItem.value?.note ?? ''
  countsUnder.value = wholeItem.value?.payee ?? ''
  partPayees.value = Object.fromEntries(entryLines.value.map((line) => [line.id, line.payee]))
  labels.value = wholeItem.value?.labels ?? []
  event.value = wholeItem.value?.event ?? BY_DAYS
  start(entryLines.value.map((line) => ({ part: line.id, labels: line.labels, event: line.event })))
  lineFilings.value = Object.fromEntries(entryLines.value.flatMap((line) => (line.receipt === null ? [] : [[line.id, lineFilingOf(line)]])))
  tried.value = false
  adding.value = null
  memory.start()
  openedAs.value = formNow.value
})

/** A row stays on its own side as its kind changes: money in stays the To side of a transfer, and any row goes back to its account as a plain entry. */
watch(kind, (picked) => {
  if (memory.filled.value) memory.fill(payee.value, picked)
  const entry = props.entry
  if (entry === null || (picked === 'transfer' && legs.value !== null)) return
  if (picked !== 'transfer') {
    account.value = entry.account
  } else if (entry.amount > 0) {
    toAccount.value = entry.account
    account.value = choosable.value.find((candidate) => candidate.id !== entry.account)?.id ?? ''
    toAmount.value = amount.value
  }
})

/** The rows on each side of the form, whose account a statement fixed when it brought them. */
const rowOnFrom = computed(() => legs.value?.[0] ?? (kind.value !== 'transfer' || (props.entry?.amount ?? 0) < 0 ? props.entry : null))
const rowOnTo = computed(() => legs.value?.[1] ?? (kind.value === 'transfer' && (props.entry?.amount ?? 0) > 0 ? props.entry : null))
const fromFixed = computed(() => (rowOnFrom.value?.importKey ?? '') !== '')
const toFixed = computed(() => (rowOnTo.value?.importKey ?? '') !== '')

/** Whether the bank fixed the amount and day of the row on a side, as on an account it fills, whose balance it checks. */
function bookedByBank(row: Transaction | null): boolean {
  const on = row === null ? null : accountOf(row.account)
  return row !== null && on !== null && fixedByBank(row, on)
}
const fromBooked = computed(() => bookedByBank(rowOnFrom.value))
const toBooked = computed(() => bookedByBank(rowOnTo.value))
const { twoCurrencies, feeOn, draft, fee, arrivedError } = useTransferTyping({ kind, from, to, rowOnFrom, rowOnTo, sent: amount, arrived: toAmount, lessArrived, day })

const bankNote = computed(() => (rowOnFrom.value?.pending === true || rowOnTo.value?.pending === true ? words.dialog.pending : fromBooked.value || toBooked.value ? words.dialog.bookedByBank : null))
/** Where the entry came from, said once under its kind: what the bank fixed on it or that it has not booked it yet, and that a statement brings it back once deleted. */
const sourceNote = computed(() =>
  [bankNote.value, deleteComesBack(legs.value ?? (props.entry === null ? [] : [props.entry])) ? words.dialog.comesBack : null].filter((sentence): sentence is string => sentence !== null).join(' '),
)

/** Whether the account can be picked while an open account is left off the list because the bank fills it. */
const bankAccountsHidden = computed(() => !fromFixed.value && !split.value && accounts.value.some((candidate) => !candidate.closed && !choosable.value.includes(candidate)))

/** Labels go on the parts of a file moved to items, and not on a transfer here, whose legs are labelled by selecting them on Entries. */
const labelling = computed(() => keepsLabels.value && kind.value !== 'transfer')

function openedAfter(on: CivilDate, onAccount: Account | null): string | null {
  return onAccount !== null && beforeStartDay(onAccount, on) ? words.dialog.beforeOpened(onAccount.openedOn) : null
}

const errors = computed(() => ({
  amount: positiveAmount(amount.value) === null ? words.dialog.anAmount : null,
  toAmount: arrivedError.value,
  category:
    kind.value !== 'transfer' && !split.value && category.value !== '' && !pickable.value.has(category.value)
      ? words.dialog.pickCategory
      : partFiling.joins(category.value) && wholeItem.value?.link != null
        ? sharedCostWords.unlinkFirst
        : null,
  account: from.value === null ? words.dialog.pickAccount : null,
  toAccount: kind.value === 'transfer' && (to.value === null || to.value.id === from.value?.id) ? words.dialog.otherAccount : null,
  lines: [...lineRefusals.value.values()][0] ?? null,
  date: day.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : (openedAfter(day.value, from.value) ?? (kind.value === 'transfer' ? openedAfter(day.value, to.value) : null)),
}))

async function save(): Promise<void> {
  tried.value = true
  const typed = positiveAmount(amount.value)
  const fromAccount = from.value
  const on = day.value
  if (Object.values(errors.value).some((error) => error !== null) || typed === null || fromAccount === null || on === null) return
  const signed = kind.value === 'out' ? negateAccountMoney(typed) : typed
  const work = kind.value === 'transfer' ? transferWrite() : entryWrite(fromAccount, signed, on)
  if (work === null) return
  const adding = props.entry === null
  const filed = adding && kind.value !== 'transfer' ? categories.value.find((candidate) => candidate.id === category.value) : undefined
  const typedEntry = filed === undefined ? null : { account: fromAccount.id, payee: payee.value, amount: signed, category: filed.id, note: note.value, labels: labels.value }
  const follow = typedEntry === null ? {} : shortcutOffer(store.state.workbook, () => store.state.records, writes, typedEntry, on)
  if (!(await writes.write(adding ? words.dialog.added : words.dialog.saved, work, { failedTitle: adding ? spendingWords.form.notAdded : spendingWords.form.notSaved, ...follow }))) return
  rememberLastAccount(fromAccount)
  open.value = false
}

/** One entry of the signed amount added, or changed in place, which drops the other leg of what was a transfer. */
function entryWrite(fromAccount: Account, amount: AccountMoney, on: CivilDate): ((unit: UnitOfWork) => void) | null {
  const filing = partFiling.filing.value
  const filed = category.value === '' ? { category: null, sharedCost: null } : partFiling.fieldsOf(category.value)
  const records = store.state.records
  if ((filed === null && !split.value) || records === null) return null
  const entry = newEntry({
    account: fromAccount.id,
    date: on,
    amount,
    payee: payee.value,
    category: filed?.category ?? null,
    sharedCost: filed?.sharedCost ?? null,
    note: note.value,
    labels: split.value ? [] : labels.value,
    event: event.value,
    countsUnder: countsUnder.value,
  })
  const lines = refiledReceiptLines(filing.categories, entryLines.value, lineRefiles.value.refiles)
  if ('refused' in lines) return null
  const parts = split.value
    ? lines.map((part) => ({ ...part, labels: partLabels.value[part.id] ?? part.labels, event: partEvents.value[part.id] ?? part.event, payee: partPayees.value[part.id] ?? part.payee }))
    : entry.items
  const before = props.entry === null ? null : { row: props.entry, items: entryLines.value }
  const other = legs.value?.find((leg) => leg.id !== before?.row.id) ?? null
  const carried = new Set(parts.flatMap((part) => part.labels))
  return (unit) => {
    addCarried(unit, carried)
    filing.addFor(unit, parts)
    writeEntry(unit, records, before, { row: entry.row, items: parts }, other)
  }
}

/** Both legs in one write: added, changed in place, or a plain entry turned into the money-out leg with the other leg beside it. */
function transferWrite(): ((unit: UnitOfWork) => void) | null {
  const fixed = transferCategory.value
  const typed = draft.value
  const on = day.value
  if (typed === null || fixed === null || on === null) return null
  const transfer = newTransfer(typed, { date: on, note: note.value, category: fixed.id }, categories.value, words.dialog.fee)
  const records = store.state.records
  const book = store.state.workbook
  if ('refused' in transfer || records === null || book === null) return null
  const before = props.entry === null ? null : itemizedRow(book, props.entry)
  const pair = legs.value
  const itemizedPair = pair === null ? null : ([itemizedRow(book, pair[0]), itemizedRow(book, pair[1])] as const)
  return (unit) => writeTransfer(unit, records, before, itemizedPair, transfer)
}

/** The payee as the file holds it, which the person flag names, or blank for an entry with none. */
const savedPayee = computed(() => props.entry?.payee.trim() ?? '')
const savedIban = computed(() => props.entry?.counterpartyIban ?? '')
const payeeIsPerson = computed(() => {
  const book = store.state.workbook
  return book !== null && savedPayee.value !== '' && isPerson(payeeDirectory(book.payees, book.readings.settings.facts), savedPayee.value, savedIban.value)
})

async function treatPayee(): Promise<void> {
  const records = store.state.records
  const payeeName = savedPayee.value
  const iban = savedIban.value
  if (records === null || payeeName === '') return
  const asPerson = !payeeIsPerson.value
  await writes.write(asPerson ? words.dialog.treatedAsPerson : words.dialog.treatedAsCompany, (unit) => setPayeeParty(unit, records, payeeName, asPerson ? 'person' : null, iban), {
    key: 'person-payee',
    description: payeeName,
    failedTitle: spendingWords.form.notSaved,
  })
}

/** Takes off the parts you split the entry into, and closes the dialog. */
async function removeSplit(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  if (await writes.write(words.split.removed, (unit) => removeSplitOf(unit, records, entry), { key: 'remove-split', failedTitle: spendingWords.form.notSaved })) open.value = false
}

async function remove(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  if (await writes.write(words.dialog.deleted, (unit) => removeEntry(unit, records, entry), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" changes :title="addingWords?.open ?? (entry === null ? words.dialog.addTitle : words.dialog.changeTitle)" :description="addingWords?.help ?? words.dialog.description">
    <AddInAppForm
      v-if="adding !== null && entry !== null"
      id="spending-add-in-app-form"
      v-model:saving="addingSaving"
      :entry="entry"
      :split="split"
      :currency="entryCurrency"
      :adding="adding"
      :categories="categories"
      @linked="open = false"
    />
    <FormGrid v-else id="spending-entry" as="form" data-testid="spending-entry-dialog" @submit.prevent="save">
      <UFormField v-if="!split" :label="words.dialog.kind" class="sm:col-span-2">
        <ChoiceButtons v-model="kind" :options="kindOptions" :label="words.dialog.kind" data-testid="spending-entry-kind" />
      </UFormField>
      <p v-if="sourceNote !== ''" class="type-caption sm:col-span-2" data-testid="spending-entry-source-note">{{ sourceNote }}</p>
      <UFormField :label="words.dialog.amountIn(from?.currency ?? '')" :error="(tried && errors.amount) || false">
        <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" :disabled="split || fromBooked" class="w-full" data-testid="spending-entry-amount" />
      </UFormField>
      <UFormField
        :label="kind === 'transfer' ? words.dialog.fromAccount : words.dialog.account"
        :help="bankAccountsHidden ? words.dialog.bankAccountsHidden : ''"
        :error="(tried && errors.account) || false"
      >
        <USelect v-model="account" :items="accountItems" :disabled="fromFixed || split" class="w-full" data-testid="spending-entry-account" />
      </UFormField>
      <TransferToFields
        v-if="kind === 'transfer'"
        v-model:to-account="toAccount"
        v-model:to-amount="toAmount"
        v-model:less-arrived="lessArrived"
        :items="accountItems"
        :to="to"
        :two-currencies="twoCurrencies"
        :fee-on="feeOn"
        :fee="fee"
        :to-fixed="toFixed"
        :to-booked="toBooked"
        :errors="errors"
        :tried="tried"
      />
      <template v-else>
        <UFormField :label="words.dialog.payee">
          <PayeeField v-model="payee" @update:model-value="memory.fill($event, kind)" />
        </UFormField>
        <UFormField
          v-if="!split"
          :label="words.dialog.category"
          :help="memory.filled.value ? payeeWords.filledFromPayee : ''"
          :error="(tried && errors.category) || false"
          :ui="{ container: 'flex flex-col' }"
        >
          <OptionalSelect
            v-model="category"
            :items="categoryItems"
            :none="words.dialog.noCategory"
            :search="words.dialog.findCategory"
            :clearable="wholeItem?.link == null"
            class="w-full"
            data-testid="spending-entry-category"
            @update:model-value="memory.pickedByHand"
          />
          <CountsUnderField v-model="countsUnder" :entry-payee="payee" :name="words.dialog.countsUnder" class="order-last mt-1" />
        </UFormField>
      </template>
      <UFormField :label="words.dialog.date" :error="(tried && errors.date) || false">
        <DayField v-model="date" :disabled="fromBooked || toBooked" class="w-full" data-testid="spending-entry-date" />
      </UFormField>
      <UFormField v-if="!split" :label="spendingWords.form.note" :class="twoCurrencies || (feeOn !== null && !lessArrived) ? '' : 'sm:col-span-2'">
        <UInput v-model="note" class="w-full" data-testid="spending-entry-note" />
      </UFormField>
      <LabelsAndEventFields v-if="labelling && !split" v-model:labels="labels" v-model:event="event" :kit="kit" :part="null" :filed-under="category" testid="spending-entry" />
      <EntryLinkField
        v-if="entry !== null"
        v-model:category="category"
        :entry="entry"
        :lines="entryLines"
        :currency="entryCurrency"
        :receipt="receipt !== null"
        :categories="categories"
        :linkable="legs === null && kind !== 'transfer'"
        :edited="edited"
        @done="open = false"
        @add="adding = $event"
      />
      <div v-if="split" class="flex flex-col items-start gap-2 sm:col-span-2" data-testid="spending-entry-lines">
        <p class="type-caption">{{ splitNote }}</p>
        <RowLines :lines="lineRefiles.lines" :categories="partFiling.filing.value.categories" :currency="from?.currency ?? EURO" :homes="homes" class="w-full">
          <template #line="{ line, title }">
            <EntryPartFields
              v-model:filing="lineFilings[line.id]"
              :payee="partPayees[line.id] ?? line.payee"
              :line="line"
              :title="title"
              :entry-payee="payee"
              :categories="categories"
              :shared-costs="partFiling.offers.value"
              :kit="kit"
              :labelling="labelling"
              :refusal="(tried && lineRefusals.get(line.id)) || null"
              @update:payee="partPayees[line.id] = $event"
            />
          </template>
        </RowLines>
        <EntryReceipt v-if="receipt !== null && entry !== null" :entry="entry" :receipt="receipt" @removed="open = false" />
        <div v-else class="flex flex-wrap gap-2">
          <UButton :label="words.split.change" icon="i-lucide-split" color="neutral" variant="outline" data-testid="spending-entry-change-split" @click="splitOpen = true" />
          <UButton
            :label="words.split.remove"
            icon="i-lucide-x"
            color="neutral"
            variant="outline"
            :loading="writes.saving('remove-split')"
            :disabled="writes.busy.value || writes.refused.value"
            data-testid="spending-entry-remove-split"
            @click="removeSplit"
          />
        </div>
      </div>
      <div v-else-if="entry !== null && legs === null && kind !== 'transfer'" class="sm:col-span-2">
        <UButton :label="words.split.action" icon="i-lucide-split" color="neutral" variant="outline" data-testid="spending-entry-split" @click="splitOpen = true" />
      </div>
      <div v-if="savedPayee !== '' && assistKeyKept && kind !== 'transfer'" class="flex flex-col items-start gap-1 sm:col-span-2" data-testid="spending-entry-person">
        <UButton
          :label="payeeIsPerson ? words.dialog.asCompany : words.dialog.asPerson"
          :icon="payeeIsPerson ? 'i-lucide-store' : 'i-lucide-user-round'"
          color="neutral"
          variant="outline"
          :loading="writes.saving('person-payee')"
          :disabled="writes.busy.value || writes.refused.value"
          data-testid="spending-entry-treat-payee"
          @click="treatPayee"
        />
        <p class="type-caption">{{ words.dialog.asPersonHelp }}</p>
      </div>
    </FormGrid>
    <EntrySplitDialog v-if="entry !== null" v-model:open="splitOpen" :entry="entry" :currency="from?.currency ?? EURO" @saved="open = false" />
    <template #start>
      <UButton
        v-if="entry !== null && adding === null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-entry-delete"
        @click="remove"
      />
    </template>
    <template v-if="adding !== null" #end>
      <UButton :label="uiWords.back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" :disabled="addingSaving" :data-testid="`spending-add-to-${adding.app}-back`" @click="adding = null" />
      <UButton
        type="submit"
        form="spending-add-in-app-form"
        :label="addInAppWords(adding).save"
        icon="i-lucide-link"
        :loading="addingSaving"
        :disabled="addingSaving || writes.refused.value"
        :data-testid="`spending-add-to-${adding.app}-save`"
      />
    </template>
    <template v-else #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-entry"
        :label="entry === null ? words.dialog.add : words.dialog.save"
        :icon="entry === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-entry-save"
      />
    </template>
  </AppDialog>
</template>
