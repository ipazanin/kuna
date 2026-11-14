<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { notCash, writeCashLegs } from '../application/statementWrites'
import type { WithdrawalWithoutCash } from '../domain/reviewQueue'
import { rowCaption, rowTitle } from './rowParts'
import type { RowQuestion } from './rowParts'
import { words } from './words'
import AccountDialog from '../../accounts/presentation/AccountDialog.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Account } from '../../workbook/domain/account'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { EURO } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { negateAccountMoney } from '../../../../shared/money/accountMoney'
import { formatAccountMoney } from '../../../../shared/money/moneyFormat'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import QuestionList from '../../../../shared/ui/QuestionList.vue'

/**
 * The cash withdrawals with no cash leg yet. Those with one cash account of their currency move there together in one
 * write, one with several asks which, and those with none offer to add a cash account for their currency, opening by the
 * day of the first of them. Each can be called no cash, which leaves it where it is filed.
 */
const props = defineProps<{ withdrawals: readonly WithdrawalWithoutCash[] }>()

const store = useSpendingBooks()
const writes = useRecordWrites(store)

const accounts = computed(() => store.state.workbook?.accounts ?? [])
const transfer = computed(() => transferCategoryOf(store.state.workbook?.categories ?? []))
const accountOf = (row: Transaction): Account | undefined => accounts.value.find((account) => account.id === row.account)
const captionOf = (row: Transaction): string => rowCaption(row, accountOf(row))

const proposed = computed(() => props.withdrawals.flatMap(({ row, cashAccounts }) => (cashAccounts.length === 1 ? [{ row, cash: cashAccounts[0]! }] : [])))
const asking = computed(() => props.withdrawals.filter(({ cashAccounts }) => cashAccounts.length > 1))
/** The withdrawals no cash account can take, by their currency, each with the day a new cash account would open on. */
const wanting = computed(() => {
  const byCurrency = new Map<CurrencyCode, { rows: Transaction[]; openingDay: CivilDate }>()
  for (const { row, cashAccounts } of props.withdrawals) {
    if (cashAccounts.length > 0) continue
    const currency = accountOf(row)?.currency ?? EURO
    const held = byCurrency.get(currency)
    if (held === undefined) byCurrency.set(currency, { rows: [row], openingDay: row.date })
    else byCurrency.set(currency, { rows: [...held.rows, row], openingDay: row.date < held.openingDay ? row.date : held.openingDay })
  }
  return [...byCurrency].map(([currency, { rows, openingDay }]) => ({ currency, rows, openingDay }))
})
const allShown = ref(false)
const shownProposed = computed(() => (allShown.value ? proposed.value : proposed.value.slice(0, FIRST_SHOWN)))

const LATER = 'later'
const NOT_CASH = 'not-cash'
const questions = computed(() =>
  asking.value.map(({ row, cashAccounts }): RowQuestion<string> => ({
    key: row.id,
    row: rowTitle(row),
    caption: captionOf(row),
    choice: LATER,
    amount: row.amount,
    currency: accountOf(row)?.currency ?? EURO,
    options: [...cashAccounts.map((account) => ({ value: account.id, label: account.name })), { value: NOT_CASH, label: words.review.cash.notCash }, { value: LATER, label: words.review.cash.later }],
  })),
)
const saving = shallowRef<{ readonly key: string; readonly choice: string } | null>(null)
const addingAccount = ref(false)
const openingDay = ref<CivilDate>(today())
const addingCurrency = ref<CurrencyCode>(EURO)

function addAccount(currency: CurrencyCode, day: CivilDate): void {
  addingCurrency.value = currency
  openingDay.value = day
  addingAccount.value = true
}

async function leaveFiled(row: Transaction): Promise<void> {
  const records = store.state.records
  if (records !== null) await writes.write(words.review.cash.leftFiled, (unit) => notCash(unit, records, row), { key: `not-cash-${row.id}`, failedTitle: words.review.notWritten })
}

async function moveAll(): Promise<void> {
  const category = transfer.value
  const moving = proposed.value
  const records = store.state.records
  if (category === null || records === null || moving.length === 0) return
  await writes.write(plural(words.review.cash.moved(moving.length), moving.length), (unit) => writeCashLegs(unit, records, moving, category.id), {
    key: 'cash-legs',
    failedTitle: words.review.notWritten,
  })
}

async function answer(key: string, choice: string): Promise<void> {
  const category = transfer.value
  const withdrawal = asking.value.find(({ row }) => row.id === key)
  if (withdrawal === undefined || saving.value !== null) return
  if (choice === NOT_CASH) {
    saving.value = { key, choice }
    try {
      await leaveFiled(withdrawal.row)
    } finally {
      saving.value = null
    }
    return
  }
  const cash = withdrawal.cashAccounts.find((account) => account.id === choice)
  const records = store.state.records
  if (category === null || cash === undefined || records === null) return
  saving.value = { key, choice }
  try {
    await writes.write(plural(words.review.cash.moved(1), 1), (unit) => writeCashLegs(unit, records, [{ row: withdrawal.row, cash }], category.id), {
      key: `cash-leg-${key}`,
      failedTitle: words.review.notWritten,
    })
  } finally {
    saving.value = null
  }
}
</script>

<template>
  <AppCard :title="words.review.cash.title" :subtitle="words.review.cash.subtitle" data-testid="spending-review-cash">
    <div class="flex flex-col gap-4 pt-1 pb-4">
      <template v-if="proposed.length > 0">
        <ul class="divide-y divide-default">
          <ProposalRow v-for="{ row, cash } in shownProposed" :key="row.id" :title="rowTitle(row)" :caption="captionOf(row)" data-testid="spending-review-cash-row">
            <template #amount>
              <AccountMoneyText :cents="row.amount" :currency="accountOf(row)?.currency ?? EURO" sign="always" tone="flow" />
            </template>
            <template #details>
              <span class="break-words type-caption" data-testid="spending-review-cash-to">{{
                words.review.cash.toCash(formatAccountMoney(negateAccountMoney(row.amount), cash.currency, 'always'), cash.name)
              }}</span>
            </template>
            <UButton
              class="self-start"
              :label="words.review.cash.notCash"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="writes.saving(`not-cash-${row.id}`)"
              data-testid="spending-review-cash-not-cash"
              @click="leaveFiled(row)"
            />
          </ProposalRow>
        </ul>
        <div v-if="proposed.length > FIRST_SHOWN" class="px-4 sm:px-5">
          <ShowAllButton v-model:expanded="allShown" :total="proposed.length" />
        </div>
        <UButton
          class="mx-4 self-start sm:mx-5"
          :label="plural(words.review.cash.move(proposed.length), proposed.length)"
          icon="i-lucide-wallet"
          :loading="writes.saving('cash-legs')"
          data-testid="spending-review-cash-move"
          @click="moveAll"
        />
      </template>
      <div v-if="questions.length > 0" class="px-4 sm:px-5">
        <QuestionList :items="questions" :options="[]" :label="words.review.cash.which" :heading="words.review.cash.which" :intro="words.review.cash.whichIntro" :saving="saving" @answer="answer">
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="item.currency" sign="always" tone="flow" />
          </template>
        </QuestionList>
      </div>
      <section v-for="{ currency, rows, openingDay: firstDay } in wanting" :key="currency" class="flex flex-col gap-1" data-testid="spending-review-cash-wanting">
        <UAlert
          color="info"
          variant="subtle"
          icon="i-lucide-wallet"
          :title="words.review.cash.noAccount(currency)"
          :actions="[{ label: words.review.cash.addAccount, icon: 'i-lucide-plus', color: 'neutral', variant: 'outline', onClick: () => addAccount(currency, firstDay) }]"
          class="mx-4 w-auto sm:mx-5"
          data-testid="spending-review-cash-add-account"
        />
        <ul class="divide-y divide-default">
          <ProposalRow v-for="row in rows" :key="row.id" :title="rowTitle(row)" :caption="captionOf(row)" data-testid="spending-review-cash-wanting-row">
            <template #amount>
              <AccountMoneyText :cents="row.amount" :currency="currency" sign="always" tone="flow" />
            </template>
            <UButton
              class="self-start"
              :label="words.review.cash.notCash"
              color="neutral"
              variant="outline"
              size="sm"
              :loading="writes.saving(`not-cash-${row.id}`)"
              data-testid="spending-review-cash-not-cash"
              @click="leaveFiled(row)"
            />
          </ProposalRow>
        </ul>
      </section>
    </div>
    <AccountDialog v-model:open="addingAccount" :account="null" :opening-day="openingDay" starting-kind="cash" :starting-currency="addingCurrency" />
  </AppCard>
</template>
