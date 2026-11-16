<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import UInputMenu from '@nuxt/ui/components/InputMenu.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { entryCategoryChoices } from './categoryChoices'
import EntrySplitDialog from './EntrySplitDialog.vue'
import { rememberLastAccount, startingAccount } from '../infrastructure/lastAccount'
import { words } from './words'
import { knownPayees, payeeChoices } from '../domain/knownPayees'
import { newTransfer } from '../domain/transfer'
import { linkEntry, newEntry, otherLegOf, deleteComesBack, removeEntry, removeSplitOf, unlinkEntry, writeEntry, writeTransfer } from '../application/entryWrites'
import { addLabel } from '../../labels/application/labelWrites'
import { labelCalled, labelNameProblem, newLabel } from '../../labels/domain/labels'
import LabelsSelect from '../../labels/presentation/LabelsSelect.vue'
import { words as labelWords } from '../../labels/presentation/words'
import { loanTargets } from '../../links/application/loanTargets'
import type { ShownTarget } from '../../links/application/loanTargets'
import { beyondPlan, linkFiling, wholeLoanKindOf } from '../../links/domain/instalmentSplit'
import { sideOf } from '../../categories/domain/rowSide'
import { fixedCategoryIn, loanInterestCategoryIn } from '../../categories/domain/starterCategories'
import { eventMembership } from '../../events/domain/eventMembership'
import { eventsNewestFirst } from '../../events/domain/events'
import { targetsFor } from '../../links/domain/linkTarget'
import type { InformalLoanTarget } from '../../links/domain/linkTarget'
import AddToLoansForm from '../../links/presentation/AddToLoansForm.vue'
import { LINK_TONE, useLinkLines } from '../../links/presentation/linkLine'
import { choiceText, words as linkWords } from '../../links/presentation/words'
import { mapLinkOf } from '../../receipts/domain/photoPlace'
import RowLines from '../../receipts/presentation/RowLines.vue'
import { words as receiptWords } from '../../receipts/presentation/words'
import { treatPayeeAsPerson } from '../../workbook/application/settingWrites'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { fixedByBank } from '../domain/bankRows'
import { beforeStartDay, takesRowsByHand } from '../../workbook/domain/account'
import { isBeforeItems } from '../../workbook/domain/beforeItems'
import type { Account } from '../../workbook/domain/account'
import { BY_DAYS, OUT_OF_EVENTS } from '../../workbook/domain/event'
import type { EventChoice } from '../../workbook/domain/event'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { Label } from '../../workbook/domain/label'
import type { Transaction } from '../../workbook/domain/transaction'
import { isSplit, itemizedRow, linkOfItems, rowItemsOf } from '../../workbook/domain/rowItems'
import { rowLinkText } from '../../workbook/domain/rowLink'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import { dayRangeLabel } from '../../../../shared/calendar/dayLabel'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { flaggedAsPerson } from '../../../../shared/privacy/domain/personPayees'
import { assistKeyKept } from '../../../../shared/ai/presentation/aiProvider'
import { absAccountMoney, negateAccountMoney, typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney, formatMoney } from '../../../../shared/money/moneyFormat'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import NoteLine from '../../../../shared/ui/NoteLine.vue'
import { words as uiWords } from '../../../../shared/ui/words'
import { EURO } from '../../../../shared/money/currencyCode'
import { language } from '../../../../shared/text/language'

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
const category = ref('')
const account = ref('')
const toAccount = ref('')
const date = ref('')
const payee = ref('')
const note = ref('')
/** The labels of an entry not split, and of each part of a split one by the part's id. */
const labels = ref<readonly RecordId[]>([])
const partLabels = ref<Readonly<Record<string, readonly RecordId[]>>>({})
/** The event choice of an entry not split, and of each part of a split one by the part's id. */
const event = ref<EventChoice>(BY_DAYS)
const partEvents = ref<Record<string, EventChoice>>({})
/** Labels typed into a labels field, which Save adds with the entry while a part carries them. */
const created = ref<readonly Label[]>([])
const tried = ref(false)

/** The form's fields as one text, to tell whether the person changed any since the dialog opened. */
const formNow = computed(() =>
  JSON.stringify([
    kind.value,
    amount.value,
    toAmount.value,
    category.value,
    account.value,
    toAccount.value,
    date.value,
    payee.value,
    note.value,
    labels.value,
    partLabels.value,
    event.value,
    partEvents.value,
  ]),
)
const openedAs = ref('')
/** Whether the form holds changes not saved yet, which leaving for Loans would lose. */
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
/** The one item of an entry not split, whose category and note the form edits. */
const wholeItem = computed(() => (split.value ? null : (entryLines.value[0] ?? null)))
const receipt = computed(() => (store.state.workbook?.receipts ?? []).find((held) => held.transaction === props.entry?.id) ?? null)
/** Where the entry's receipt was photographed, when its photo held a position. */
const receiptPlace = computed(() => {
  const held = receipt.value
  const link = held === null ? null : mapLinkOf(held)
  return held === null || link === null ? null : { text: receiptWords.place(held.latitude, held.longitude), link }
})
const splitOpen = ref(false)

const linkLineOf = useLinkLines()
const heldLink = computed(() => linkOfItems(entryLines.value))
/** The currency of the account the saved entry is on, which its link compares with Loans' plan in. */
const entryCurrency = computed(() => (props.entry === null ? EURO : (accountOf(props.entry.account)?.currency ?? EURO)))
/** The record in another app the entry is linked to. */
const entryLink = computed(() => {
  const link = heldLink.value
  return link === null || props.entry === null ? null : linkLineOf.value(link, { amount: props.entry.amount, currency: entryCurrency.value })
})

/** What the entry's parts are: a receipt's lines, the plan's interest and principal its link split it into, or parts you made. */
const splitNote = computed(() => {
  if (receipt.value !== null) return receiptWords.splitNote
  const byLink = heldLink.value !== null && entryLines.value.some((line) => line.splitByLink)
  return byLink ? linkWords.splitNote : words.split.note
})

const loans = computed(() => loanTargets())
/** The records of Loans a saved entry with no link can be linked to, none for a transfer's leg or while Loans is not open. */
const openTargets = computed((): readonly ShownTarget[] => {
  const held = loans.value
  return props.entry === null || legs.value !== null || heldLink.value !== null || held === null || typeof held === 'string' ? [] : held
})
const linkTargets = computed(() => (props.entry === null ? [] : targetsFor(props.entry, entryCurrency.value, openTargets.value)))
/** The informal loans a movement can be added to from the entry. */
const informalLoans = computed(() => openTargets.value.filter((target): target is ShownTarget & InformalLoanTarget => target.kind === 'informal-loan'))
/** While true, the dialog adds a movement to an informal loan from the saved entry, and its footer goes back or adds and links. */
const addingToLoans = ref(false)
const addingSaving = ref(false)
/** What the picker says under each record: an instalment's share, or a movement's or extra payment's amount. */
function choiceDetail(target: (typeof linkTargets.value)[number]): string {
  if (target.kind === 'instalment') return target.interim ? linkWords.interimShare(formatMoney(target.yourShare)) : formatMoney(target.yourShare)
  return target.kind === 'informal-loan' ? target.counterparty : formatMoney(target.amount)
}
const linkItems = computed(() => linkTargets.value.map((target) => ({ label: choiceText(target), value: rowLinkText(target.link), description: choiceDetail(target) })))
const pickedLink = ref('')
const pickedTarget = computed(() => linkTargets.value.find((target) => rowLinkText(target.link) === pickedLink.value) ?? null)

/** What linking the picked record does to the entry's money, said before the person links it. */
const linkNote = computed(() => {
  const target = pickedTarget.value
  if (target === null || props.entry === null) return ''
  if (edited.value) return linkWords.saveFirst
  const filing = linkFiling({ row: props.entry, items: entryLines.value }, target, { currency: entryCurrency.value, receipt: receipt.value !== null, categories: categories.value })
  if (!filing.split && filing.why === 'principal')
    return [linkWords.filesWhole(fixedCategoryIn(categories.value, wholeLoanKindOf(target), language).category.name), ...(split.value ? [linkWords.replacesParts] : [])].join(' ')
  if (!filing.split) return linkWords.whole[filing.why]
  const money = (amount: AccountMoney): string => formatAccountMoney(absAccountMoney(amount), entryCurrency.value)
  const category = categories.value.find((candidate) => candidate.id === filing.category)?.name ?? loanInterestCategoryIn(categories.value, language).category.name
  const beyond = beyondPlan(target, props.entry, entryCurrency.value) ?? 0
  const differs = beyond === 0 ? null : (beyond > 0 ? linkWords.paidMore : linkWords.paidLess)(money(beyond), category)
  return [linkWords.splits(money(filing.interest), money(filing.principal)), differs, split.value ? linkWords.replacesParts : null]
    .filter((sentence): sentence is string => sentence !== null)
    .join(' ')
})

/** The open accounts kept by hand, and the ones the entry is already on, closed or filled by the bank. */
const choosable = computed(() => {
  const own = new Set([props.entry?.account, ...(legs.value ?? []).map((leg) => leg.account)])
  return accounts.value.filter((candidate) => (!candidate.closed && takesRowsByHand(candidate)) || own.has(candidate.id))
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

const payees = computed(() => knownPayees(store.state.workbook?.transactions ?? []))
const payeeItems = computed(() => payeeChoices(payees.value, payee.value))
/** Whether the person has the payee list open, which shows only while a known payee matches, so a new payee brings no empty list. */
const payeeListOpen = ref(false)

const categoryItems = computed(() => (kind.value === 'transfer' ? [] : entryCategoryChoices(categories.value, kind.value, wholeItem.value?.category ?? null)))
const pickable = computed(() => new Set(categoryItems.value.flat().flatMap((choice) => (choice.value === undefined ? [] : [choice.value]))))

function accountOf(id: string): Account | null {
  return accounts.value.find((candidate) => candidate.id === id) ?? null
}

const from = computed(() => accountOf(account.value))
const to = computed(() => accountOf(toAccount.value))
const twoCurrencies = computed(() => kind.value === 'transfer' && from.value !== null && to.value !== null && from.value.currency !== to.value.currency)

watch(open, (opened) => {
  if (!opened) return
  const entry = props.entry
  const pair = legs.value
  const first = startingAccount(accounts.value)
  kind.value = pair !== null ? 'transfer' : entry === null || entry.amount < 0 ? 'out' : 'in'
  account.value = (pair?.[0] ?? entry)?.account ?? first?.id ?? ''
  toAccount.value = pair?.[1].account ?? choosable.value.find((candidate) => candidate.id !== account.value)?.id ?? ''
  amount.value = entry === null ? '' : amountForTyping(absAccountMoney((pair?.[0] ?? entry).amount))
  toAmount.value = pair === null ? '' : amountForTyping(absAccountMoney(pair[1].amount))
  category.value = wholeItem.value?.category ?? ''
  date.value = entry?.date ?? today()
  payee.value = entry?.payee ?? ''
  note.value = wholeItem.value?.note ?? ''
  labels.value = wholeItem.value?.labels ?? []
  partLabels.value = Object.fromEntries(entryLines.value.map((line) => [line.id, line.labels]))
  event.value = wholeItem.value?.event ?? BY_DAYS
  partEvents.value = Object.fromEntries(entryLines.value.map((line) => [line.id, line.event]))
  created.value = []
  labelRefused.value = null
  tried.value = false
  pickedLink.value = ''
  addingToLoans.value = false
  openedAs.value = formNow.value
})

/** A row stays on its own side as its kind changes: money in stays the To side of a transfer, and any row goes back to its account as a plain entry. */
watch(kind, (picked) => {
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

/** Where the entry came from, said once under its kind: what the bank fixed on it, and that a statement brings it back once deleted. */
const sourceNote = computed(() =>
  [fromBooked.value || toBooked.value ? words.dialog.bookedByBank : null, deleteComesBack(legs.value ?? (props.entry === null ? [] : [props.entry])) ? words.dialog.comesBack : null]
    .filter((sentence): sentence is string => sentence !== null)
    .join(' '),
)

/** Whether the account can be picked while an open account is left off the list because the bank fills it. */
const bankAccountsHidden = computed(() => !fromFixed.value && !split.value && accounts.value.some((candidate) => !candidate.closed && !choosable.value.includes(candidate)))

const labelChoices = computed(() => [...(store.state.workbook?.labels ?? []), ...created.value])
/** Labels go on the parts of a file moved to items, and not on a transfer here, whose legs are labelled by selecting them on Entries. */
const labelling = computed(() => store.state.workbook !== null && !isBeforeItems(store.state.workbook.stored) && kind.value !== 'transfer')

/** Why the last name typed into a labels field made no label, and the part it was typed for, null for the entry's own field. */
const labelRefused = ref<{ readonly part: RecordId | null; readonly text: string } | null>(null)

/** The labels with the one a typed name names: a label the file or the dialog has under it, or a new one. A name that cannot be a label's adds none and says why. */
function withTyped(picked: readonly RecordId[], name: string, part: RecordId | null = null): readonly RecordId[] {
  const held = labelCalled(name, labelChoices.value)
  const problem = held === null ? labelNameProblem(name, labelChoices.value, null) : null
  labelRefused.value = problem === null ? null : { part, text: labelWords.dialog[problem] }
  if (held !== null) return picked.includes(held.id) ? picked : [...picked, held.id]
  if (problem !== null) return picked
  const label = newLabel(name)
  created.value = [...created.value, label]
  return [...picked, label.id]
}

function labelPart(part: RecordId, picked: readonly RecordId[]): void {
  partLabels.value = { ...partLabels.value, [part]: picked }
}

const events = computed(() => eventsNewestFirst(store.state.workbook?.events ?? []))
/**
 * The choices of a part's event under its category: first the event its day gives it, which follows the date typed above, then
 * each event, newest first, and no event. Two events of one name read apart by their days.
 */
function eventItems(filedUnder: string | null): { label: string; value: EventChoice }[] {
  const on = day.value
  const side = sideOf(categories.value.find((candidate) => candidate.id === filedUnder) ?? null)
  const byDays = on === null ? null : eventMembership(events.value)({ event: BY_DAYS }, on, side)
  const named = events.value.find((candidate) => candidate.id === byDays)
  const twin = (name: string): boolean => events.value.filter((candidate) => candidate.name === name).length > 1
  return [
    { label: named === undefined ? words.dialog.byDaysNone : words.dialog.byDays(named.name), value: BY_DAYS },
    ...events.value.map((candidate) => ({ label: twin(candidate.name) ? `${candidate.name} · ${dayRangeLabel(candidate.days)}` : candidate.name, value: candidate.id })),
    { label: words.dialog.noEvent, value: OUT_OF_EVENTS },
  ]
}

/** An amount above zero, or null. */
function positive(text: string): AccountMoney | null {
  const typed = typedAccountAmount(text)
  return typed === null || typed <= 0 ? null : typed
}

const day = computed(() => parseCivilDate(date.value))

function openedAfter(on: CivilDate, onAccount: Account | null): string | null {
  return onAccount !== null && beforeStartDay(onAccount, on) ? words.dialog.beforeOpened(onAccount.openedOn) : null
}

const errors = computed(() => ({
  amount: positive(amount.value) === null ? words.dialog.anAmount : null,
  toAmount: twoCurrencies.value && positive(toAmount.value) === null ? words.dialog.anAmount : null,
  category: kind.value !== 'transfer' && !split.value && !pickable.value.has(category.value) ? words.dialog.pickCategory : null,
  account: from.value === null ? words.dialog.pickAccount : null,
  toAccount: kind.value === 'transfer' && (to.value === null || to.value.id === from.value?.id) ? words.dialog.otherAccount : null,
  date: day.value === null ? spendingWords.form.aDate(civilDate(2026, 3, 15)) : (openedAfter(day.value, from.value) ?? (kind.value === 'transfer' ? openedAfter(day.value, to.value) : null)),
}))

async function save(): Promise<void> {
  tried.value = true
  const typed = positive(amount.value)
  const fromAccount = from.value
  const on = day.value
  if (Object.values(errors.value).some((error) => error !== null) || typed === null || fromAccount === null || on === null) return
  const work = kind.value === 'transfer' ? transferWrite(fromAccount, typed, on) : entryWrite(fromAccount, typed, on)
  if (work === null) return
  const adding = props.entry === null
  if (!(await writes.write(adding ? words.dialog.added : words.dialog.saved, work, { failedTitle: adding ? spendingWords.form.notAdded : spendingWords.form.notSaved }))) return
  rememberLastAccount(fromAccount)
  open.value = false
}

/** One entry added, or changed in place, which drops the other leg of what was a transfer. */
function entryWrite(fromAccount: Account, typed: AccountMoney, on: CivilDate): ((unit: UnitOfWork) => void) | null {
  const filed = categories.value.find((candidate) => candidate.id === category.value)
  const records = store.state.records
  if ((filed === undefined && !split.value) || records === null) return null
  const amount = kind.value === 'out' ? negateAccountMoney(typed) : typed
  const entry = newEntry({ account: fromAccount.id, date: on, amount, payee: payee.value, category: filed?.id ?? null, note: note.value, labels: split.value ? [] : labels.value, event: event.value })
  const parts = split.value ? entryLines.value.map((part) => ({ ...part, labels: partLabels.value[part.id] ?? part.labels, event: partEvents.value[part.id] ?? part.event })) : entry.items
  const before = props.entry === null ? null : { row: props.entry, items: entryLines.value }
  const other = legs.value?.find((leg) => leg.id !== before?.row.id) ?? null
  const carried = new Set(parts.flatMap((part) => part.labels))
  const added = created.value.filter((label) => carried.has(label.id))
  return (unit) => {
    added.forEach((label) => addLabel(unit, label))
    writeEntry(unit, records, before, { row: entry.row, items: parts }, other)
  }
}

/** Both legs in one write: added, changed in place, or a plain entry turned into the money-out leg with the other leg beside it. */
function transferWrite(fromAccount: Account, typed: AccountMoney, on: CivilDate): ((unit: UnitOfWork) => void) | null {
  const toAccountPicked = to.value
  const fixed = transferCategory.value
  if (toAccountPicked === null || fixed === null) return null
  const arrived = twoCurrencies.value ? (positive(toAmount.value) ?? typed) : typed
  const typedLegs = newTransfer({ account: fromAccount.id, amount: typed }, { account: toAccountPicked.id, amount: arrived }, { date: on, note: note.value, category: fixed.id })
  const records = store.state.records
  const book = store.state.workbook
  if (records === null || book === null) return null
  const before = props.entry === null ? null : itemizedRow(book, props.entry)
  const pair = legs.value
  const itemizedPair = pair === null ? null : ([itemizedRow(book, pair[0]), itemizedRow(book, pair[1])] as const)
  return (unit) => writeTransfer(unit, records, before, itemizedPair, typedLegs)
}

/** The payee as the file holds it, which the person flag names, or blank for an entry with none. */
const savedPayee = computed(() => props.entry?.payee.trim() ?? '')
const payeeIsPerson = computed(() => flaggedAsPerson(store.state.workbook?.settings.personPayees ?? [], savedPayee.value))

async function treatPayee(): Promise<void> {
  const records = store.state.records
  const payeeName = savedPayee.value
  if (records === null || payeeName === '') return
  const asPerson = !payeeIsPerson.value
  await writes.write(asPerson ? words.dialog.treatedAsPerson : words.dialog.treatedAsCompany, (unit) => treatPayeeAsPerson(unit, recordsOf(records.settings), payeeName, asPerson), {
    key: 'person-payee',
    description: payeeName,
    failedTitle: spendingWords.form.notSaved,
  })
}

/** Links the saved entry to the picked record in Loans, which splits an instalment off into interest and principal, with Undo, and closes the dialog. */
async function addLink(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  const target = pickedTarget.value
  if (entry === null || records === null || target === null) return
  const place = { currency: entryCurrency.value, categories: categories.value, language, notes: linkWords.notes }
  if (await writes.write(linkWords.linked, (unit) => linkEntry(unit, records, entry, target, place), { key: 'link', failedTitle: spendingWords.form.notSaved })) open.value = false
}

/** Takes the entry's link off, with Undo, and closes the dialog. The entry keeps its category and its parts. */
async function removeLink(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  if (await writes.write(linkWords.removed, (unit) => unlinkEntry(unit, records, entry), { key: 'remove-link', failedTitle: spendingWords.form.notSaved })) open.value = false
}

/** Takes the receipt and its lines off, or the parts you split the entry into, and closes the dialog. */
async function removeSplit(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  const [title, key] = receipt.value === null ? [words.split.removed, 'remove-split'] : [receiptWords.removed, 'remove-receipt']
  if (await writes.write(title, (unit) => removeSplitOf(unit, records, entry), { key, failedTitle: spendingWords.form.notSaved })) open.value = false
}

async function remove(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  if (await writes.write(words.dialog.deleted, (unit) => removeEntry(unit, records, entry), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="addingToLoans ? linkWords.add.open : entry === null ? words.dialog.addTitle : words.dialog.changeTitle"
    :description="addingToLoans ? linkWords.add.help : words.dialog.description"
  >
    <AddToLoansForm
      v-if="addingToLoans && entry !== null"
      id="spending-add-to-loans-form"
      v-model:saving="addingSaving"
      :entry="entry"
      :split="split"
      :currency="entryCurrency"
      :loans="informalLoans"
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
      <template v-if="kind === 'transfer'">
        <UFormField :label="words.dialog.toAccount" :error="(tried && errors.toAccount) || false">
          <USelect v-model="toAccount" :items="accountItems" :disabled="toFixed" class="w-full" data-testid="spending-entry-to-account" />
        </UFormField>
        <UFormField v-if="twoCurrencies" :label="words.dialog.amountIn(to?.currency ?? '')" :help="words.dialog.arrivedHelp" :error="(tried && errors.toAmount) || false">
          <MoneyInput v-model="toAmount" :placeholder="spendingWords.form.amountPlaceholder" :disabled="toBooked" class="w-full" data-testid="spending-entry-to-amount" />
        </UFormField>
      </template>
      <UFormField v-else-if="!split" :label="words.dialog.category" :error="(tried && errors.category) || false">
        <USelectMenu v-model="category" :items="categoryItems" value-key="value" :placeholder="words.dialog.pickCategory" class="w-full" data-testid="spending-entry-category" />
      </UFormField>
      <UFormField :label="words.dialog.date" :error="(tried && errors.date) || false">
        <DayField v-model="date" :disabled="fromBooked || toBooked" class="w-full" data-testid="spending-entry-date" />
      </UFormField>
      <UFormField v-if="kind !== 'transfer'" :label="words.dialog.payee">
        <UInputMenu
          v-model="payee"
          mode="autocomplete"
          :items="payeeItems"
          ignore-filter
          trailing-icon=""
          :open="payeeListOpen && payeeItems.length > 0"
          autocomplete="off"
          class="w-full"
          data-testid="spending-entry-payee"
          @update:open="payeeListOpen = $event"
          @focusout="payeeListOpen = false"
        />
      </UFormField>
      <UFormField v-if="!split" :label="spendingWords.form.note" :class="twoCurrencies ? '' : 'sm:col-span-2'">
        <UInput v-model="note" class="w-full" data-testid="spending-entry-note" />
      </UFormField>
      <UFormField v-if="labelling && !split" :label="words.dialog.labels" :error="labelRefused?.part === null ? labelRefused.text : false" class="sm:col-span-2">
        <LabelsSelect v-model="labels" :labels="labelChoices" :name="words.dialog.labels" class="w-full" @create="labels = withTyped(labels, $event)" />
      </UFormField>
      <UFormField v-if="labelling && !split && events.length > 0" :label="words.dialog.event">
        <USelect v-model="event" :items="eventItems(category)" class="w-full" data-testid="spending-entry-event" />
      </UFormField>
      <UFormField v-if="entryLink !== null" :label="linkWords.label" class="sm:col-span-2" data-testid="spending-entry-link">
        <div class="flex flex-col items-start gap-1">
          <NoteLine as="span" size="body" :tone="LINK_TONE[entryLink.look]" :icon="entryLink.icon">{{ entryLink.text }}</NoteLine>
          <div class="flex flex-wrap gap-2">
            <UButton v-if="entryLink.to !== null" :to="entryLink.to" :label="linkWords.open" color="neutral" variant="link" :disabled="edited" class="px-0" data-testid="spending-entry-link-open" />
            <UButton
              :label="linkWords.remove"
              icon="i-lucide-unlink"
              color="neutral"
              variant="ghost"
              :loading="writes.saving('remove-link')"
              :disabled="writes.busy.value || writes.refused.value"
              data-testid="spending-entry-link-remove"
              @click="removeLink"
            />
          </div>
        </div>
      </UFormField>
      <UFormField v-else-if="(linkItems.length > 0 || informalLoans.length > 0) && kind !== 'transfer'" :label="linkWords.pickLabel" class="sm:col-span-2" data-testid="spending-entry-link-pick">
        <div class="flex flex-col items-start gap-2">
          <USelectMenu v-if="linkItems.length > 0" v-model="pickedLink" :items="linkItems" value-key="value" :placeholder="linkWords.pick" class="w-full" data-testid="spending-entry-link-target" />
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="linkItems.length > 0"
              :label="linkWords.link"
              icon="i-lucide-link"
              color="neutral"
              variant="outline"
              :loading="writes.saving('link')"
              :disabled="pickedTarget === null || edited || writes.busy.value || writes.refused.value"
              data-testid="spending-entry-link-add"
              @click="addLink"
            />
            <UButton
              v-if="informalLoans.length > 0"
              :label="linkWords.add.open"
              icon="i-lucide-plus"
              color="neutral"
              variant="ghost"
              :disabled="edited || writes.refused.value"
              data-testid="spending-entry-add-to-loans"
              @click="addingToLoans = true"
            />
          </div>
          <p v-if="linkNote !== ''" class="type-caption" data-testid="spending-entry-link-note">{{ linkNote }}</p>
        </div>
      </UFormField>
      <div v-if="split" class="flex flex-col items-start gap-2 sm:col-span-2" data-testid="spending-entry-lines">
        <p class="type-caption">{{ splitNote }}</p>
        <RowLines :lines="entryLines" :categories="categories" :currency="from?.currency ?? EURO" class="w-full">
          <template v-if="labelling" #line="{ line, title }">
            <span class="flex min-w-0 flex-1 flex-col gap-1.5">
              <LabelsSelect
                :model-value="partLabels[line.id] ?? []"
                :labels="labelChoices"
                :name="words.dialog.partLabels(title)"
                size="sm"
                class="w-full"
                data-testid="spending-entry-part-labels"
                @update:model-value="labelPart(line.id, $event)"
                @create="labelPart(line.id, withTyped(partLabels[line.id] ?? [], $event, line.id))"
              />
              <NoteLine v-if="labelRefused !== null && labelRefused.part === line.id" tone="error" data-testid="spending-entry-part-label-refused">{{ labelRefused.text }}</NoteLine>
              <USelect
                v-if="events.length > 0"
                v-model="partEvents[line.id]"
                :items="eventItems(line.category)"
                :aria-label="words.dialog.partEvent(title)"
                size="sm"
                class="w-full"
                data-testid="spending-entry-part-event"
              />
            </span>
          </template>
        </RowLines>
        <p v-if="receiptPlace !== null" class="flex flex-col items-start text-sm" data-testid="spending-entry-place">
          <span>{{ receiptPlace.text }}</span>
          <a :href="receiptPlace.link" target="_blank" rel="noopener noreferrer" class="quiet-link" data-testid="spending-entry-place-link">{{ receiptWords.openMap }}</a>
        </p>
        <UButton
          v-if="receipt !== null"
          :label="receiptWords.remove"
          icon="i-lucide-receipt"
          color="neutral"
          variant="outline"
          :loading="writes.saving('remove-receipt')"
          :disabled="writes.busy.value || writes.refused.value"
          data-testid="spending-entry-remove-receipt"
          @click="removeSplit"
        />
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
        v-if="entry !== null && !addingToLoans"
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
    <template v-if="addingToLoans" #end>
      <UButton :label="uiWords.back" icon="i-lucide-arrow-left" color="neutral" variant="ghost" :disabled="addingSaving" data-testid="spending-add-to-loans-back" @click="addingToLoans = false" />
      <UButton
        type="submit"
        form="spending-add-to-loans-form"
        :label="linkWords.add.save"
        icon="i-lucide-link"
        :loading="addingSaving"
        :disabled="addingSaving || writes.refused.value"
        data-testid="spending-add-to-loans-save"
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
