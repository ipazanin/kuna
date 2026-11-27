<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { words } from './words'
import { ACCOUNT_WRITES, changeAccount, newAccount } from '../application/accountWrites'
import { cutoverWords } from './startDayMoveWords'
import { handoverWords } from './sourceHandoverWords'
import SourcePeriodsField from './SourcePeriodsField.vue'
import { periodFieldId } from './periodFieldId'
import { draftsOf, periodsOfDrafts } from '../domain/periodDrafts'
import type { PeriodDraft, PeriodDraftProblem } from '../domain/periodDrafts'
import { sourceHandover } from '../domain/sourceHandover'
import { deletesRecords, startDayMove } from '../domain/startDayMove'
import { SPENDING_ACCOUNTS_ROUTE } from '../../overview/presentation/spendingLinks'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { ACCOUNT_KINDS, BY_HAND_SOURCES, NEW_ACCOUNT_DEFAULTS, SPENDING_SOURCES, bankLinkOffered, cardsOfText, cardsText, sourcesRefusal } from '../../workbook/domain/account'
import type { Account, AccountKind, SpendingSource } from '../../workbook/domain/account'
import { bankNamesOf } from '../domain/bankNames'
import { words as spendingWords } from '../../words'
import { civilDate, parseCivilDate, today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { periodsSince } from '../../../../shared/app/accountSource'
import { absAccountMoney, negateAccountMoney, typedAccountAmount, ZERO_ACCOUNT_MONEY } from '../../../../shared/money/accountMoney'
import type { AccountMoney } from '../../../../shared/money/accountMoney'
import { CURRENCY_CODES, EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { amountForTyping } from '../../../../shared/money/typedAmount'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import BankNameField from '../../../../shared/ui/BankNameField.vue'
import CurrencySelect from '../../../../shared/ui/CurrencySelect.vue'
import ChoiceButtons from '../../../../shared/ui/ChoiceButtons.vue'
import DayField from '../../../../shared/ui/DayField.vue'
import FormGrid from '../../../../shared/ui/FormGrid.vue'
import MoneyInput from '../../../../shared/ui/MoneyInput.vue'
import SourceHandoverAlert from '../../../../shared/ui/SourceHandoverAlert.vue'
import { useTried } from '../../../../shared/ui/useTried'
import { TONE_ICONS } from '../../../../shared/ui/toneText'

/** One of your accounts in one currency: its name, kind, bank, where its rows come from on which days, what it held on the day you start counting from, its IBAN and the cards that pay from it. One with entries is closed rather than deleted. */
const open = defineModel<boolean>('open', { required: true })

const props = defineProps<{
  /** The account to change, or null to add one. */
  account: Account | null
  /** The day a new account's balance starts from, for a screen that says so. Otherwise today, so a balance typed from the bank's screen is not counted twice. */
  openingDay?: CivilDate
  /** The kind a new account starts as, for a screen that asks for one. Otherwise a bank account. */
  startingKind?: AccountKind
  /** The currency a new account starts in, for a screen that asks for one. Otherwise euros. */
  startingCurrency?: CurrencyCode
  /** Where a new account's rows come from, for a screen that asks for one. Otherwise by hand. */
  startingSource?: SpendingSource
  /** The place of the period to change, whose first day takes focus, the start day for the first. Otherwise the dialog opens at the top. */
  period?: number
}>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)
const router = useRouter()

const KIND_OPTIONS = ACCOUNT_KINDS.map((kind) => ({ value: kind, label: words.kinds[kind] }))

const name = ref('')
const kind = ref<AccountKind>('bank')
const bank = ref('')
const currency = ref<string>(EURO)
const opening = ref('')
/** The opening is typed as an amount of zero or more, since a phone's number pad has no minus, and this says it was below zero. */
const overdrawn = ref(false)
const openedOn = ref('')
const iban = ref('')
const cards = ref('')
const periods = ref<readonly PeriodDraft[]>([{ source: 'by-hand', from: '' }])
const { tried, markTried } = useTried(open)

/** The banks the book's accounts and saved recipes name, which the bank field suggests. */
const banks = computed(() => bankNamesOf([...(store.state.workbook?.accounts ?? []), ...(store.state.workbook?.recipes ?? [])]))

/** An account that entries name keeps its currency, since their amounts are in it. */
const hasEntries = computed(() => props.account !== null && (store.state.workbook?.transactions ?? []).some((row) => row.account === props.account?.id))

/** Puts the opening into its field as an amount of zero or more, with the switch saying whether it is below zero. */
function showOpening(amount: AccountMoney): void {
  opening.value = amountForTyping(absAccountMoney(amount))
  overdrawn.value = amount < 0
}

watch(open, (opened) => {
  if (!opened) return
  const account = props.account
  name.value = account?.name ?? ''
  kind.value = account?.kind ?? props.startingKind ?? 'bank'
  bank.value = account?.bank ?? ''
  currency.value = account?.currency ?? props.startingCurrency ?? EURO
  if (account === null) {
    opening.value = ''
    overdrawn.value = false
  } else {
    showOpening(account.opening)
  }
  openedOn.value = account?.openedOn ?? props.openingDay ?? today()
  iban.value = account?.iban ?? ''
  cards.value = cardsText(account?.cards ?? NEW_ACCOUNT_DEFAULTS.cards)
  periods.value = account === null ? [{ source: props.startingSource ?? 'by-hand', from: '' }] : draftsOf(account.sources)
})

const openingAmount = computed(() => {
  const typed = opening.value.trim() === '' ? ZERO_ACCOUNT_MONEY : typedAccountAmount(opening.value)
  return typed !== null && overdrawn.value ? negateAccountMoney(typed) : typed
})
const openedDay = computed(() => parseCivilDate(openedOn.value))
/** What moving the start day to the day typed does, or null for a new account and for the day it starts on now. */
const move = computed(() => {
  const book = store.state.workbook
  return props.account === null || book === null || openedDay.value === null ? null : startDayMove(book, props.account, openedDay.value)
})
const cutover = computed(() => (move.value?.direction === 'later' && deletesRecords(move.value) ? move.value : null))

/** Kuna fills in the opening that keeps today's balance whenever the start day moves, and the person may type over it. */
watch(
  () => move.value?.opening ?? null,
  (worked) => {
    if (props.account !== null) showOpening(worked ?? props.account.opening)
  },
)

const shownCutover = computed(() => {
  const book = store.state.workbook
  return cutover.value === null || book === null ? null : cutoverWords(cutover.value, book)
})
const earlierFromBank = computed(() => move.value?.direction === 'earlier' && kind.value !== 'cash')

const settings = computed(() => store.state.workbook?.settings ?? { bankSyncApplication: '' })
const offersBankLink = computed(() => bankLinkOffered(kind.value, props.account, settings.value))
/** The sources a person may pick: none but by hand on cash, and the bank link only where it is offered. */
const sourceOptions = computed<readonly SpendingSource[]>(() => (kind.value === 'cash' ? ['by-hand'] : SPENDING_SOURCES.filter((source) => source !== 'bank-link' || offersBankLink.value)))
const typedPeriods = computed(() => periodsOfDrafts(kind.value === 'cash' ? BY_HAND_SOURCES.map((period) => ({ source: period.source, from: '' })) : periods.value, openedDay.value))
/** The periods as typed from the start day typed, or null while one cannot be kept. */
const pickedSources = computed(() => {
  const typed = typedPeriods.value.periods
  return typed === null ? null : periodsSince(typed, openedDay.value ?? today())
})
const PERIOD_PROBLEMS: Readonly<Record<PeriodDraftProblem, string>> = {
  'day-needed': words.rowsFromChoice.dayNeeded,
  'after-earlier': words.rowsFromChoice.afterEarlier,
  'same-as-earlier': words.rowsFromChoice.sameAsEarlier,
}
const periodErrors = computed(() => typedPeriods.value.problems.map((problem) => (tried.value && problem !== null ? PERIOD_PROBLEMS[problem] : null)))
/** The help for where the last source's rows come from, and how the periods follow one another when there are several. */
const sourcesHelp = computed(() => {
  const last = periods.value[periods.value.length - 1]?.source ?? 'by-hand'
  const own = last === 'bank-link' ? words.rowsFromChoice.bankLinkHelp(words.dialog.openedOn) : last === 'provider-file' ? words.rowsFromChoice.statementFileHelp : words.rowsFromChoice.byHandHelp
  return periods.value.length > 1 ? `${words.rowsFromChoice.periodsHelp} ${own}` : own
})
/** What giving days to another source deletes, past what moving the start day later already does. */
const handover = computed(() => {
  const book = store.state.workbook
  const sources = pickedSources.value
  if (props.account === null || book === null || sources === null) return null
  const goneBefore = new Set(move.value?.direction === 'later' ? move.value.rows : [])
  return sourceHandover({ ...book, transactions: book.transactions.filter((row) => !goneBefore.has(row)) }, props.account, sources)
})
const shownHandover = computed(() => {
  const book = store.state.workbook
  return handover.value === null || book === null ? null : handoverWords(handover.value, book, today())
})
/** Whether saving deletes rows, so its button says so. */
const deletes = computed(() => cutover.value !== null || shownHandover.value !== null)

/** None on cash, which no card pays from. */
const typedCards = computed(() => (kind.value === 'cash' ? NEW_ACCOUNT_DEFAULTS.cards : cardsOfText(cards.value)))

const pickedCurrency = computed(() => CURRENCY_CODES.find((code) => code === currency.value) ?? null)

const errors = computed(() => ({
  name: name.value.trim() === '' ? words.dialog.nameError : null,
  opening: openingAmount.value === null ? words.dialog.anAmount : null,
  openedOn: openedDay.value === null ? spendingWords.form.aDate(civilDate(2026, 1, 1)) : null,
  cards: typedCards.value === null ? words.dialog.cardsError : null,
  iban: sourcesRefusal({ kind: kind.value, iban: iban.value, sources: pickedSources.value ?? BY_HAND_SOURCES }, props.account, settings.value) === null ? null : words.rowsFromChoice.ibanNeeded,
  periods: pickedSources.value === null ? words.rowsFromChoice.dayNeeded : null,
}))

async function save(): Promise<void> {
  markTried()
  const amount = openingAmount.value
  const day = openedDay.value
  const code = pickedCurrency.value
  const typedCardList = typedCards.value
  const sources = pickedSources.value
  if (Object.values(errors.value).some((error) => error !== null) || amount === null || day === null || code === null || typedCardList === null || sources === null) return
  const typed = newAccount({
    name: name.value,
    kind: kind.value,
    bank: bank.value.trim() === '' ? null : bank.value.trim(),
    currency: code,
    opening: amount,
    openedOn: day,
    iban: iban.value,
    cards: typedCardList,
    sources,
    closed: props.account?.closed ?? NEW_ACCOUNT_DEFAULTS.closed,
  })
  const before = props.account
  const records = store.state.records
  if (before !== null && records === null) return
  const written =
    before === null || records === null
      ? await writes.write(words.dialog.added, (unit) => unit.of(ACCOUNT_WRITES).add(typed), { failedTitle: spendingWords.form.notAdded })
      : await writes.write(words.dialog.saved, (unit) => changeAccount(unit, records, before, { ...typed, id: before.id }, move.value, handover.value), { failedTitle: spendingWords.form.notSaved })
  if (written) open.value = false
}

async function closeOrReopen(): Promise<void> {
  const before = props.account
  if (before === null) return
  const title = before.closed ? words.dialog.reopened : words.dialog.closedToast
  if (await writes.write(title, (unit) => unit.of(ACCOUNT_WRITES).change(before, { ...before, closed: !before.closed }), { key: 'close', failedTitle: spendingWords.form.notSaved })) open.value = false
}

async function remove(): Promise<void> {
  const before = props.account
  if (before === null) return
  if (await writes.write(words.dialog.deleted, (unit) => unit.of(ACCOUNT_WRITES).remove(before), { key: 'delete', failedTitle: spendingWords.form.notDeleted })) {
    open.value = false
    await router.push(SPENDING_ACCOUNTS_ROUTE)
  }
}
</script>

<template>
  <AppDialog
    v-model:open="open"
    changes
    :title="account === null ? words.dialog.addTitle : words.dialog.changeTitle"
    :description="words.dialog.description"
    :focus="period === undefined ? undefined : periodFieldId(period)"
  >
    <FormGrid id="spending-account" as="form" data-testid="spending-account-dialog" @submit.prevent="save">
      <UFormField :label="words.dialog.name" :error="(tried && errors.name) || false" class="sm:col-span-2">
        <UInput v-model="name" :placeholder="words.dialog.namePlaceholder" class="w-full" data-testid="spending-account-name" />
      </UFormField>
      <UFormField :label="words.dialog.kind" class="sm:col-span-2">
        <ChoiceButtons v-model="kind" :options="KIND_OPTIONS" :label="words.dialog.kind" data-testid="spending-account-kind" />
      </UFormField>
      <UFormField v-if="kind !== 'cash'" :label="words.rowsFromChoice.label" :help="sourcesHelp" class="sm:col-span-2">
        <SourcePeriodsField v-model="periods" :options="sourceOptions" :errors="periodErrors" />
      </UFormField>
      <UFormField v-if="kind !== 'cash'" :label="words.dialog.iban" :error="(tried && errors.iban) || false" class="sm:col-span-2">
        <UInput v-model="iban" autocomplete="off" spellcheck="false" class="w-full" data-testid="spending-account-iban" />
      </UFormField>
      <UFormField v-if="kind !== 'cash'" :label="words.dialog.cards" :help="words.dialog.cardsHelp" :error="(tried && errors.cards) || false" class="sm:col-span-2">
        <UInput v-model="cards" autocomplete="off" spellcheck="false" class="w-full" data-testid="spending-account-cards" />
      </UFormField>
      <UFormField v-if="kind !== 'cash'" :label="words.dialog.bank">
        <BankNameField v-model="bank" :banks="banks" :iban="iban" data-testid="spending-account-bank" />
      </UFormField>
      <UFormField :label="words.dialog.currency" v-bind="hasEntries ? { help: words.dialog.currencyKept } : {}">
        <CurrencySelect v-model="currency" :search="words.dialog.findCurrency" :disabled="hasEntries" class="w-full" data-testid="spending-account-currency" />
      </UFormField>
      <div class="flex flex-col gap-2">
        <UFormField :label="words.dialog.opening" :help="words.dialog.openingHelp" :error="(tried && errors.opening) || false">
          <MoneyInput v-model="opening" :placeholder="spendingWords.form.amountPlaceholder" class="w-full" data-testid="spending-account-opening" />
        </UFormField>
        <USwitch v-model="overdrawn" :label="words.dialog.overdrawn" class="min-h-11" data-testid="spending-account-overdrawn" />
      </div>
      <UFormField :id="periodFieldId(0)" :label="words.dialog.openedOn" :error="(tried && errors.openedOn) || false" v-bind="earlierFromBank ? { help: words.dialog.earlierStart } : {}">
        <DayField v-model="openedOn" class="w-full" data-testid="spending-account-opened-on" />
      </UFormField>
      <UAlert v-if="shownCutover !== null" :icon="TONE_ICONS.warning" color="warning" variant="subtle" :title="shownCutover.title" data-testid="spending-account-cutover">
        <template #description>
          <ul v-if="shownCutover.goes.length > 1" class="list-disc ps-5">
            <li v-for="line in shownCutover.goes" :key="line">{{ line }}</li>
          </ul>
          <p v-else>{{ shownCutover.goes[0] }}</p>
          <p v-if="shownCutover.loneLegs !== null" class="mt-2">{{ shownCutover.loneLegs }}</p>
          <p class="mt-2">{{ shownCutover.opening }}</p>
        </template>
      </UAlert>
      <SourceHandoverAlert v-if="shownHandover !== null" :handover="shownHandover" class="sm:col-span-2" data-testid="spending-account-handover" />
      <p v-if="account !== null && hasEntries" class="type-caption sm:col-span-2" data-testid="spending-account-has-entries">{{ words.dialog.hasEntries }}</p>
    </FormGrid>
    <template #start>
      <UButton
        v-if="account !== null && !hasEntries"
        :label="words.dialog.delete"
        icon="i-lucide-trash-2"
        color="error"
        variant="ghost"
        :loading="writes.saving('delete')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-account-delete"
        @click="remove"
      />
      <UButton
        v-if="account !== null && (hasEntries || account.closed)"
        :label="account.closed ? words.dialog.reopen : words.dialog.close"
        :icon="account.closed ? 'i-lucide-archive-restore' : 'i-lucide-archive'"
        color="neutral"
        variant="ghost"
        :loading="writes.saving('close')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-account-close"
        @click="closeOrReopen"
      />
    </template>
    <template #end>
      <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" @click="open = false" />
      <UButton
        type="submit"
        form="spending-account"
        :label="account === null ? words.dialog.add : deletes ? words.dialog.cutover.save : words.dialog.save"
        :icon="account === null ? 'i-lucide-plus' : deletes ? 'i-lucide-trash-2' : 'i-lucide-save'"
        :color="deletes ? 'error' : 'primary'"
        :loading="writes.saving('save')"
        :disabled="writes.busy.value || writes.refused.value"
        data-testid="spending-account-save"
      />
    </template>
  </AppDialog>
</template>
