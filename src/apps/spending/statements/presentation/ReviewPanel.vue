<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { fileRow, joinWithTyped, notAPair, pairRows, payeeCondition, rowsRuleWouldFile, writeRulesInto } from '../application/statementWrites'
import { reviewQueue } from '../domain/reviewQueue'
import { ruleVerdicts } from '../domain/spendingCategorisation'
import type { WaitingRow } from '../domain/reviewQueue'
import CashWithdrawalsCard from './CashWithdrawalsCard.vue'
import WaitingReceiptsCard from '../../receipts/presentation/WaitingReceiptsCard.vue'
import { asksForPayment, waitingReceipts } from '../../receipts/domain/waitingReceipts'
import ReviewRow from './ReviewRow.vue'
import { useHeldRows } from '../../bankSync/presentation/useHeldRows'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import { REVIEW_ASKED } from './reviewAsks'
import { ruleTestOf } from './ruleTest'
import { words } from './words'
import type { TransferPair } from '../../pairing/domain/transferPairs'
import { wantsSavingsAccount } from '../../pairing/domain/wantsSavingsAccount'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { Category } from '../../workbook/domain/category'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import { words as spendingWords } from '../../words'
import { today } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import ProposalRow from '../../../../shared/ui/ProposalRow.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { EURO } from '../../../../shared/money/currencyCode'

/** The rows waiting for a category, the withdrawals waiting for their cash leg, the receipts waiting for the bank's row, the transfers the pairing made and the lone legs waiting for their other side. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

defineProps<{
  /** Whether a waiting row shows the camera for its receipt. */
  takesReceipt: (entry: Transaction) => boolean
}>()

const emit = defineEmits<{ receipt: [entry: AskedElement] }>()

const book = computed(() => store.state.workbook)
const held = useHeldRows()
const { ask: askAboutQueue, marked: queueMarked } = useChatElement(REVIEW_ASKED, 'card', words.review.suggestCategoriesTask)
const queue = computed(() => (book.value === null ? null : reviewQueue(book.value, today())))
const receipts = computed(() => (book.value === null ? [] : waitingReceipts(book.value)))
/** Waiting receipts sit beside the pairs and lone legs, which also only wait, unless one asks which payment it is. */
const receiptsAsk = computed(() => receipts.value.some(asksForPayment))
const receiptsBelow = useTemplateRef('receiptsBelow')
// The card moves below the pairs once its last question is answered, which takes the focused button with it.
watch(
  receiptsAsk,
  (asking, asked) => {
    if (asked && !asking) receiptsBelow.value?.keepFocus()
  },
  { flush: 'post' },
)
const accounts = computed(() => book.value?.accounts ?? [])
/** What your rules would file a row under, which To review only suggests for a row that may be the same money as a typed one. */
const ruleSays = computed(() => (book.value === null ? null : ruleVerdicts(book.value.rules, book.value)))
const categories = computed(() => book.value?.categories ?? [])
const transfer = computed(() => categories.value.find((category) => category.kind === 'transfer') ?? null)

/** A first import waits with thousands of rows, each with a menu, which a phone cannot lay out at once. */
const allShown = ref(false)
const shownWaiting = computed(() => (allShown.value ? (queue.value?.waiting ?? []) : (queue.value?.waiting ?? []).slice(0, FIRST_SHOWN)))

const accountOf = (row: Transaction) => accounts.value.find((account) => account.id === row.account)
const currencyOf = (row: Transaction) => accountOf(row)?.currency ?? EURO

/** The rule Always for this payee would make, while its dialog asks. */
const askedRule = ref<{ readonly condition: SpendingRuleCondition; readonly category: Category } | null>(null)
const ruleDialogOpen = ref(false)

function askRule(condition: SpendingRuleCondition, category: Category): void {
  askedRule.value = { condition, category }
  ruleDialogOpen.value = true
}

const rowsFiled = computed(() => (book.value === null || askedRule.value === null ? 0 : rowsRuleWouldFile(book.value, askedRule.value.condition, askedRule.value.category.id)))

async function makeRule(): Promise<void> {
  const current = book.value
  const asked = askedRule.value
  if (current === null || asked === null) return
  if (await writes.write(words.rules.made, (unit) => writeRulesInto(unit, current, [asked.condition], asked.category.id, null), { key: 'make-rule', failedTitle: words.review.notWritten }))
    ruleDialogOpen.value = false
}

async function file(row: Transaction, category: Category): Promise<void> {
  const condition = payeeCondition(row)
  const records = store.state.records
  if (records === null) return
  await writes.write(words.review.filed, (unit) => fileRow(unit, records, row, category), {
    failedTitle: words.review.notWritten,
    ...(condition === null ? {} : { follow: { label: words.review.always, icon: 'i-lucide-list-plus', run: () => askRule(condition, category) } }),
  })
}

async function join({ maybeTyped }: WaitingRow): Promise<void> {
  const records = store.state.records
  if (maybeTyped !== null && records !== null)
    await writes.write(words.review.joined, (unit) => joinWithTyped(unit, records, maybeTyped.typed, maybeTyped.bank), { failedTitle: words.review.notWritten })
}

async function pair({ maybeTransfer }: WaitingRow): Promise<void> {
  const category = transfer.value
  const records = store.state.records
  if (maybeTransfer !== null && category !== null && records !== null)
    await writes.write(words.review.paired, (unit) => pairRows(unit, records, maybeTransfer, category.id), { failedTitle: words.review.notWritten })
}

async function undoPair(legs: TransferPair): Promise<void> {
  const records = store.state.records
  if (records !== null) await writes.write(words.review.pairUndone, (unit) => notAPair(unit, records, legs), { key: `not-a-pair-${legs.debit.id}`, failedTitle: words.review.notWritten })
}
</script>

<template>
  <div v-if="queue !== null" class="flex flex-col gap-6">
    <p v-if="queue.wantingSavings > 0" class="text-sm text-muted" data-testid="spending-wants-savings">{{ plural(words.review.pocketsWaiting(queue.wantingSavings), queue.wantingSavings) }}</p>
    <AppCard v-if="held.items.value.length > 0" :title="words.review.held" data-testid="spending-review-held">
      <div class="px-4 pt-3 pb-4 sm:px-5">
        <QuestionList :items="held.items.value" :options="held.options" :label="twinWords.choice" :intro="twinWords.intro.sync" :saving="held.saving.value" @answer="held.answer">
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="item.currency" sign="always" tone="flow" />
          </template>
        </QuestionList>
      </div>
    </AppCard>
    <CashWithdrawalsCard v-if="queue.withdrawals.length > 0" :withdrawals="queue.withdrawals" />
    <WaitingReceiptsCard v-if="receiptsAsk" :waiting="receipts" />
    <EmptyState
      v-if="queue.waiting.length === 0 && held.items.value.length === 0 && queue.withdrawals.length === 0 && receipts.length === 0"
      icon="i-lucide-inbox"
      :title="words.review.empty"
      :description="words.review.emptyDescription"
      data-testid="spending-review-empty"
    />
    <AppCard v-else-if="queue.waiting.length > 0" :title="words.review.title" :subtitle="words.review.subtitle" v-bind="queueMarked" data-testid="spending-review">
      <template #actions>
        <AskChatButton :text="words.review.suggestCategories" data-testid="spending-review-ask" @ask="askAboutQueue" />
      </template>
      <ul class="divide-y divide-default pt-1 pb-1">
        <ReviewRow
          v-for="waiting in shownWaiting"
          :key="waiting.row.id"
          :waiting="waiting"
          :categories="categories"
          :accounts="accounts"
          :takes-receipt="takesReceipt(waiting.row)"
          :rule-category="waiting.maybeTyped === null ? null : (categories.find((category) => category.id === ruleSays?.(waiting.row)) ?? null)"
          @file="file(waiting.row, $event)"
          @join="join(waiting)"
          @pair="pair(waiting)"
          @receipt="emit('receipt', $event)"
        />
      </ul>
      <div v-if="queue.waiting.length > FIRST_SHOWN" class="px-4 pb-3 sm:px-5">
        <ShowAllButton v-model:expanded="allShown" :total="queue.waiting.length" />
      </div>
    </AppCard>
    <AppCard v-if="queue.pairs.length > 0 || queue.loneLegs.length > 0" :title="words.review.pairs" :subtitle="words.review.pairsSubtitle" data-testid="spending-pairs">
      <ul class="divide-y divide-default pt-1 pb-1">
        <ProposalRow
          v-for="legs in queue.pairs"
          :key="legs.debit.id"
          :title="`${accountOf(legs.debit)?.name ?? ''} → ${accountOf(legs.credit)?.name ?? ''}`"
          :caption="dayLabel(legs.debit.date)"
          data-testid="spending-pair"
        >
          <template #amount>
            <AccountMoneyText :cents="legs.debit.amount" :currency="currencyOf(legs.debit)" sign="always" tone="flow" />
          </template>
          <UButton
            class="self-start"
            color="neutral"
            variant="outline"
            :label="words.review.notAPair"
            :loading="writes.saving(`not-a-pair-${legs.debit.id}`)"
            data-testid="spending-not-a-pair"
            @click="undoPair(legs)"
          />
        </ProposalRow>
        <ProposalRow v-for="leg in queue.loneLegs" :key="leg.id" :title="leg.payee" :caption="`${dayLabel(leg.date)} · ${accountOf(leg)?.name ?? ''}`" data-testid="spending-lone-leg">
          <template #amount>
            <AccountMoneyText :cents="leg.amount" :currency="currencyOf(leg)" sign="always" tone="flow" />
          </template>
          <template #details>
            <UBadge
              :label="wantsSavingsAccount(leg, accounts) ? words.review.wantsSavings : words.review.waitingForOther"
              color="neutral"
              variant="subtle"
              size="sm"
              class="self-start"
              data-testid="spending-lone-leg-state"
            />
          </template>
        </ProposalRow>
      </ul>
    </AppCard>
    <WaitingReceiptsCard v-if="receipts.length > 0 && !receiptsAsk" ref="receiptsBelow" :waiting="receipts" />
    <AppDialog v-model:open="ruleDialogOpen" changes :title="words.review.always" :description="askedRule === null ? undefined : `${ruleTestOf(askedRule.condition)} → ${askedRule.category.name}`">
      <p class="text-sm text-highlighted" data-testid="spending-rule-files">{{ plural(words.rules.files(rowsFiled), rowsFiled) }}</p>
      <template #end>
        <UButton :label="spendingWords.form.cancel" color="neutral" variant="ghost" data-testid="spending-rule-cancel" @click="ruleDialogOpen = false" />
        <UButton :label="words.rules.confirm" icon="i-lucide-list-plus" :loading="writes.saving('make-rule')" :disabled="writes.refused.value" data-testid="spending-rule-confirm" @click="makeRule" />
      </template>
    </AppDialog>
  </div>
</template>
