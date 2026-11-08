<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USelect from '@nuxt/ui/components/Select.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { entryCategoryChoices } from './categoryChoices'
import { rememberLastAccount, startingAccount } from './lastAccount'
import { words } from './words'
import { newEntry, newTransfer, otherLegOf, deleteComesBack, removeEntry, writeEntry, writeTransfer } from '../application/entryWrites'
import { fixedCategories } from '../../categories/domain/categoryTree'
import { removeReceiptOf } from '../../receipts/application/receiptRecords'
import { mapLinkOf } from '../../receipts/domain/photoPlace'
import RowLines from '../../receipts/presentation/RowLines.vue'
import { words as receiptWords } from '../../receipts/presentation/words'
import { treatPayeeAsPerson } from '../../workbook/application/settingWrites'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { flaggedAsPerson } from '../../../../shared/privacy/domain/personPayees'
import { assistKeyKept } from '../../../../shared/ai/presentation/useAiTask'
import { absAccountMoney, negateAccountMoney, typedAccountAmount } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import type { UnitOfWork } from '../../../../shared/storage/application/repository'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import { recordsOf } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
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
const transferCategory = computed(() => fixedCategories(categories.value).find((category) => category.kind === 'transfer') ?? null)

const kind = ref<EntryKind>('out')
const amount = ref('')
const toAmount = ref('')
const category = ref('')
const account = ref('')
const toAccount = ref('')
const date = ref('')
const payee = ref('')
const note = ref('')
const tried = ref(false)

/** The entry and its other leg as the file holds them, the money-out leg first. */
const legs = computed((): readonly [Transaction, Transaction] | null => {
  const records = store.state.records
  if (props.entry === null || records === null) return null
  const other = otherLegOf(records, props.entry)
  if (other === null) return null
  return props.entry.amount < 0 ? [props.entry, other] : [other, props.entry]
})

/** What a receipt split the entry into, whose sum holds its amount and whose categories count in place of its own. */
const entryLines = computed(() => (store.state.workbook?.lines ?? []).filter((line) => line.transaction === props.entry?.id))
const split = computed(() => entryLines.value.length > 0)
/** Where the entry's receipt was photographed, when its photo held a position. */
const receiptPlace = computed(() => {
  const held = (store.state.workbook?.receipts ?? []).find((receipt) => receipt.transaction === props.entry?.id)
  const link = held === undefined ? null : mapLinkOf(held)
  return held === undefined || link === null ? null : { text: receiptWords.place(held.latitude, held.longitude), link }
})

/** The open accounts, and the closed ones the entry is already on. */
const choosable = computed(() => {
  const own = new Set([props.entry?.account, ...(legs.value ?? []).map((leg) => leg.account)])
  return accounts.value.filter((candidate) => !candidate.closed || own.has(candidate.id))
})
const accountItems = computed(() => choosable.value.map((candidate) => ({ label: candidate.name, value: candidate.id as string, description: candidate.currency })))

const kindOptions = computed(() => [
  { value: 'out' as const, label: words.dialog.kinds.out },
  { value: 'in' as const, label: words.dialog.kinds.in },
  ...(transferCategory.value !== null && (choosable.value.length > 1 || legs.value !== null) ? [{ value: 'transfer' as const, label: words.dialog.kinds.transfer }] : []),
])

const categoryItems = computed(() => (kind.value === 'transfer' ? [] : entryCategoryChoices(categories.value, kind.value, props.entry?.category ?? null)))
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
  category.value = entry?.category ?? ''
  date.value = entry?.date ?? today()
  payee.value = entry?.payee ?? ''
  note.value = entry?.note ?? ''
  tried.value = false
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

/** An amount above zero, or null. */
function positive(text: string): AccountMoney | null {
  const typed = typedAccountAmount(text)
  return typed === null || typed <= 0 ? null : typed
}

const day = computed(() => parseCivilDate(date.value))

function openedAfter(on: CivilDate, onAccount: Account | null): string | null {
  return onAccount !== null && on < onAccount.openedOn ? words.dialog.beforeOpened(onAccount.openedOn) : null
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
  if (filed === undefined) return null
  const entry = newEntry({ account: fromAccount.id, date: on, amount: kind.value === 'out' ? negateAccountMoney(typed) : typed, payee: payee.value, category: filed.id, note: note.value })
  const before = props.entry
  const other = legs.value?.find((leg) => leg.id !== before?.id) ?? null
  return (unit) => writeEntry(unit, before, entry, other)
}

/** Both legs in one write: added, changed in place, or a plain entry turned into the money-out leg with the other leg beside it. */
function transferWrite(fromAccount: Account, typed: AccountMoney, on: CivilDate): ((unit: UnitOfWork) => void) | null {
  const toAccountPicked = to.value
  const fixed = transferCategory.value
  if (toAccountPicked === null || fixed === null) return null
  const arrived = twoCurrencies.value ? (positive(toAmount.value) ?? typed) : typed
  const [outLeg, inLeg] = newTransfer(
    { account: fromAccount.id, amount: typed },
    { account: toAccountPicked.id, amount: arrived },
    { date: on, payee: payee.value, note: note.value, category: fixed.id },
  )
  const before = props.entry
  const pair = legs.value
  return (unit) => writeTransfer(unit, before, pair, [outLeg, inLeg])
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

async function removeReceipt(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  if (await writes.write(receiptWords.removed, (unit) => removeReceiptOf(unit, records, entry), { key: 'remove-receipt', failedTitle: spendingWords.form.notSaved })) open.value = false
}

async function remove(): Promise<void> {
  const entry = props.entry
  const records = store.state.records
  if (entry === null || records === null) return
  if (await writes.write(words.dialog.deleted, (unit) => removeEntry(unit, records, entry), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) open.value = false
}
</script>

<template>
  <AppDialog v-model:open="open" :title="entry === null ? words.dialog.addTitle : words.dialog.changeTitle" :description="words.dialog.description">
    <FormGrid id="spending-entry" as="form" data-testid="spending-entry-dialog" @submit.prevent="save">
      <UFormField v-if="!split" :label="words.dialog.kind" class="sm:col-span-2">
        <ChoiceButtons v-model="kind" :options="kindOptions" :label="words.dialog.kind" data-testid="spending-entry-kind" />
      </UFormField>
      <UFormField :label="words.dialog.amountIn(from?.currency ?? '')" :error="(tried && errors.amount) || false">
        <MoneyInput v-model="amount" :placeholder="spendingWords.form.amountPlaceholder" :disabled="split" class="w-full" data-testid="spending-entry-amount" />
      </UFormField>
      <UFormField :label="kind === 'transfer' ? words.dialog.fromAccount : words.dialog.account" :error="(tried && errors.account) || false">
        <USelect v-model="account" :items="accountItems" :disabled="fromFixed || split" class="w-full" data-testid="spending-entry-account" />
      </UFormField>
      <template v-if="kind === 'transfer'">
        <UFormField :label="words.dialog.toAccount" :error="(tried && errors.toAccount) || false">
          <USelect v-model="toAccount" :items="accountItems" :disabled="toFixed" class="w-full" data-testid="spending-entry-to-account" />
        </UFormField>
        <UFormField v-if="twoCurrencies" :label="words.dialog.amountIn(to?.currency ?? '')" :help="words.dialog.arrivedHelp" :error="(tried && errors.toAmount) || false">
          <MoneyInput v-model="toAmount" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-entry-to-amount" />
        </UFormField>
      </template>
      <UFormField v-else-if="!split" :label="words.dialog.category" :error="(tried && errors.category) || false">
        <USelectMenu v-model="category" :items="categoryItems" value-key="value" :placeholder="words.dialog.pickCategory" class="w-full" data-testid="spending-entry-category" />
      </UFormField>
      <UFormField :label="words.dialog.date" :error="(tried && errors.date) || false">
        <UInput v-model="date" type="date" class="w-full" data-testid="spending-entry-date" />
      </UFormField>
      <UFormField :label="words.dialog.payee">
        <UInput v-model="payee" class="w-full" data-testid="spending-entry-payee" />
      </UFormField>
      <UFormField :label="spendingWords.form.note" class="sm:col-span-2">
        <UInput v-model="note" class="w-full" data-testid="spending-entry-note" />
      </UFormField>
      <div v-if="split" class="flex flex-col items-start gap-2 sm:col-span-2" data-testid="spending-entry-lines">
        <p class="type-caption">{{ receiptWords.splitNote }}</p>
        <RowLines :lines="entryLines" :categories="categories" :currency="from?.currency ?? EURO" class="w-full" />
        <p v-if="receiptPlace !== null" class="flex flex-col items-start text-sm" data-testid="spending-entry-place">
          <span>{{ receiptPlace.text }}</span>
          <a :href="receiptPlace.link" target="_blank" rel="noopener noreferrer" class="quiet-link" data-testid="spending-entry-place-link">{{ receiptWords.openMap }}</a>
        </p>
        <UButton
          :label="receiptWords.remove"
          icon="i-lucide-receipt"
          color="neutral"
          variant="outline"
          :loading="writes.saving('remove-receipt')"
          :disabled="writes.busy.value"
          data-testid="spending-entry-remove-receipt"
          @click="removeReceipt"
        />
      </div>
      <div v-if="savedPayee !== '' && assistKeyKept" class="flex flex-col items-start gap-1 sm:col-span-2" data-testid="spending-entry-person">
        <UButton
          :label="payeeIsPerson ? words.dialog.asCompany : words.dialog.asPerson"
          :icon="payeeIsPerson ? 'i-lucide-store' : 'i-lucide-user-round'"
          color="neutral"
          variant="outline"
          :loading="writes.saving('person-payee')"
          :disabled="writes.busy.value"
          data-testid="spending-entry-treat-payee"
          @click="treatPayee"
        />
        <p class="type-caption">{{ words.dialog.asPersonHelp }}</p>
      </div>
      <p v-if="deleteComesBack(legs ?? (entry === null ? [] : [entry]))" class="type-caption sm:col-span-2" data-testid="spending-entry-comes-back">{{ words.dialog.comesBack }}</p>
    </FormGrid>
    <template #start>
      <UButton
        v-if="entry !== null"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value"
        data-testid="spending-entry-delete"
        @click="remove"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-entry"
        :label="entry === null ? words.dialog.add : words.dialog.save"
        :icon="entry === null ? 'i-lucide-plus' : 'i-lucide-save'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value"
        data-testid="spending-entry-save"
      />
    </template>
  </AppDialog>
</template>
