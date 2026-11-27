<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import USelectMenu from '@nuxt/ui/components/SelectMenu.vue'

import { fileRows, joinWithTyped, pairRows } from '../application/statementWrites'
import { reviewQueue } from '../domain/reviewQueue'
import { ruleVerdicts } from '../domain/spendingCategorisation'
import type { WaitingRow } from '../domain/reviewQueue'
import CashWithdrawalsCard from './CashWithdrawalsCard.vue'
import DroppedRowsCard from './DroppedRowsCard.vue'
import TransfersCard from './TransfersCard.vue'
import WaitingReceiptsCard from '../../receipts/presentation/WaitingReceiptsCard.vue'
import { asksForPayment, waitingReceipts } from '../../receipts/domain/waitingReceipts'
import ReviewRow from './ReviewRow.vue'
import type { ReviewAction } from './ReviewRow.vue'
import { linkEntry } from '../../entries/application/entryWrites'
import { cashMovementReview, companyPaymentReview, instalmentReview } from '../../links/application/linkReview'
import CompanyPaymentsCard from '../../links/presentation/CompanyPaymentsCard.vue'
import CompanyRolesCard from '../../links/presentation/CompanyRolesCard.vue'
import InstalmentsCard from '../../links/presentation/InstalmentsCard.vue'
import ExtraPaymentsCard from '../../links/presentation/ExtraPaymentsCard.vue'
import { words as linkWords } from '../../links/presentation/words'
import { language } from '../../../../shared/text/language'
import { useHeldRows } from '../../bankSync/presentation/useHeldRows'
import QuestionList from '../../../../shared/ui/QuestionList.vue'
import { twinWords } from '../../../../shared/ai/presentation/copiedRowsWords'
import { REVIEW_ASKED } from './reviewAsks'
import RuleApplyDialog from './RuleApplyDialog.vue'
import { changesHeldRule } from './ruleAsk'
import type { RuleAsk } from './ruleAsk'
import { ruleTestOf, words } from './words'
import { entryCategoryChoices } from '../../entries/presentation/categoryChoices'
import { joinSharedCost } from '../../sharedCosts/application/sharedCostWrites'
import { onlyOpenSharedCost } from '../../sharedCosts/domain/openSharedCosts'
import { sharedCostOffers } from '../../sharedCosts/presentation/sharedCostNames'
import { words as sharedCostWords } from '../../sharedCosts/presentation/words'
import { rowItemsOf } from '../../workbook/domain/rowItems'
import type { SharedCost } from '../../workbook/domain/sharedCost'
import { payeeKey, samePayee } from '../../payees/domain/payeeKey'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import { transferCategoryOf } from '../../workbook/domain/category'
import type { Category } from '../../workbook/domain/category'
import { payeeCondition, sameCondition } from '../../workbook/domain/spendingRule'
import type { SpendingRuleCondition } from '../../workbook/domain/spendingRule'
import type { Transaction } from '../../workbook/domain/transaction'
import { today } from '../../../../shared/calendar/civilDate'
import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import type { AskedElement } from '../../../../shared/ai/presentation/chatDock'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import SelectionBar from '../../../../shared/ui/SelectionBar.vue'
import AccountMoneyText from '../../accounts/presentation/AccountMoneyText.vue'
import ShowAllButton, { FIRST_SHOWN } from '../../../../shared/ui/ShowAllButton.vue'
import { EURO } from '../../../../shared/money/currencyCode'
import { usePhoneLayout } from '../../../../shared/layout/viewport'

/** The rows waiting for a category, filed one by one or picked and filed under one category at once, the withdrawals waiting for their cash leg, the receipts waiting for the bank's row, the transfers the pairing made and the lone legs waiting for their other side. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

defineProps<{
  /** Whether a waiting row shows the camera for its receipt. */
  takesReceipt: (entry: Transaction) => boolean
}>()

const emit = defineEmits<{ receipt: [entry: AskedElement]; open: [entry: Transaction] }>()

const book = computed(() => store.state.workbook)
const held = useHeldRows()
const { ask: askAboutQueue, marked: queueMarked } = useChatElement(REVIEW_ASKED, 'card', words.review.suggestCategoriesTask)
const queue = computed(() => (book.value === null ? null : reviewQueue(book.value, today())))
const receipts = computed(() => (book.value === null ? [] : waitingReceipts(book.value)))
const instalments = computed(() => (book.value === null ? { offers: [], past: [], extraPayments: [] } : instalmentReview(book.value, today())))
const company = computed(() => (book.value === null ? { offers: [], past: [], roles: null } : companyPaymentReview(book.value)))
const cashMovements = computed(() => (book.value === null ? [] : cashMovementReview(book.value)))
const offerOf = computed(() => {
  const offers = new Map([...cashMovements.value, ...company.value.offers, ...instalments.value.offers].map((offer) => [offer.row.id, offer]))
  return (row: Transaction) => offers.get(row.id) ?? null
})
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
const transfer = computed(() => transferCategoryOf(categories.value))

const phone = usePhoneLayout()

/** A first import waits with thousands of rows, each with a menu, which a phone cannot lay out at once. */
const allShown = ref(false)
const shownWaiting = computed(() => (allShown.value ? (queue.value?.waiting ?? []) : (queue.value?.waiting ?? []).slice(0, FIRST_SHOWN)))

/** The rows picked to be filed under one category, or null while each row's own controls file it. */
const picked = ref<ReadonlySet<RecordId> | null>(null)
const pickedRows = computed(() => (queue.value?.waiting ?? []).flatMap(({ row }) => (picked.value?.has(row.id) === true ? [row] : [])))
const allPicked = computed(() => (queue.value?.waiting ?? []).every(({ row }) => picked.value?.has(row.id) === true))
/** The shared costs a waiting row can join, and the one money in may be a repayment for. A row whose waiting parts carry a link joins none, since its money counts in another app. */
const sharedCosts = computed(() => sharedCostOffers(book.value))
const repayment = computed(() => {
  const only = book.value === null ? null : onlyOpenSharedCost(book.value.sharedCosts)
  return sharedCosts.value.find(({ sharedCost }) => sharedCost.id === only?.id) ?? null
})
const itemsOf = computed(() => rowItemsOf({ items: book.value?.items ?? [] }))
const waitingParts = (row: Transaction) => {
  const items = itemsOf.value(row)
  return items.some((item) => item.category === null) ? items.filter((item) => item.category === null) : items
}
const joinable = (row: Transaction): boolean => row.pair === null && waitingParts(row).every((item) => item.link === null)
const pickedCategories = computed(() =>
  entryCategoryChoices(categories.value, pickedRows.value.some((row) => row.amount < 0) ? 'out' : 'in', null, {
    withTransfer: true,
    sharedCosts: pickedRows.value.every(joinable) ? sharedCosts.value : [],
  }),
)
/** The category the bulk menu shows, blank so it shows its placeholder again after each choice. */
const pickedCategory = ref('')

// Folding Show all back drops the picks it hides, and a row filed meanwhile drops out too, so only rows in sight are filed.
watch(shownWaiting, (shown) => {
  const current = picked.value
  if (current === null) return
  const inSight = new Set(shown.map(({ row }) => row.id))
  if ([...current].some((id) => !inSight.has(id))) picked.value = new Set([...current].filter((id) => inSight.has(id)))
})

function pick(row: Transaction): void {
  const current = new Set(picked.value ?? [])
  if (current.has(row.id)) current.delete(row.id)
  else current.add(row.id)
  picked.value = current
}

/** Picks every waiting row, showing all so none is picked out of sight. */
function pickAll(): void {
  allShown.value = true
  picked.value = new Set((queue.value?.waiting ?? []).map(({ row }) => row.id))
}

/** Every waiting row of the one payee the picked rows share, by the payee identity Payees groups by, or none while they share none. */
const samePayeeRows = computed(() => {
  const [first, ...rest] = pickedRows.value
  if (first === undefined || payeeKey(first.payee) === '' || rest.some((row) => !samePayee(row.payee, first.payee))) return []
  return (queue.value?.waiting ?? []).flatMap(({ row }) => (samePayee(row.payee, first.payee) ? [row] : []))
})

/** Picks the payee's other waiting rows, showing all when one of them is out of sight. */
function pickSamePayee(): void {
  const rows = samePayeeRows.value
  const shown = new Set(shownWaiting.value.map(({ row }) => row.id))
  if (rows.some((row) => !shown.has(row.id))) allShown.value = true
  picked.value = new Set(rows.map((row) => row.id))
}

const accountOf = (row: Transaction) => accounts.value.find((account) => account.id === row.account)
const currencyOf = (row: Transaction) => accountOf(row)?.currency ?? EURO

/** The rule Always for this payee would make, while its dialog asks. */
const askedRule = ref<RuleAsk | null>(null)
const ruleDialogOpen = ref(false)

function askRule(condition: SpendingRuleCondition, category: Category): void {
  const accountName = (id: string): string => accounts.value.find((account) => account.id === id)?.name ?? ''
  const edits = { adding: [{ conditions: [condition], category: category.id, labels: [], stop: false, withdrawal: null, link: null }] }
  askedRule.value = {
    edits,
    choice: 'apply',
    title: words.review.always,
    description: `${ruleTestOf({ conditions: [condition] }, accountName)} → ${category.name}`,
    written: book.value !== null && changesHeldRule(book.value.rules, edits) ? words.rules.dialog.changed : words.rules.made,
  }
  ruleDialogOpen.value = true
}

/** Names a To review row's write by what it does and the row, so only that row's button spins while it saves. */
function reviewKey(action: ReviewAction, row: Transaction): string {
  return `${action}-${row.id}`
}

/** The rule condition every row gives the same way, which Always for this payee then offers, or null while they give none or several. */
function sharedCondition(rows: readonly Transaction[]): SpendingRuleCondition | null {
  const [first, ...rest] = rows.map(payeeCondition)
  if (first === undefined || first === null) return null
  return rest.every((other) => other !== null && sameCondition(first, other)) ? first : null
}

/** Files the rows under the category in one write with one Undo. Resolves to whether it went through. */
function fileUnder(rows: readonly Transaction[], category: Category, title: string, key: string): Promise<boolean> {
  const condition = sharedCondition(rows)
  const records = store.state.records
  if (records === null || rows.length === 0) return Promise.resolve(false)
  return writes.write(title, (unit) => fileRows(unit, records, rows, category), {
    key,
    failedTitle: words.review.notWritten,
    ...(condition === null ? {} : { follow: { label: words.review.always, icon: 'i-lucide-list-plus', run: () => askRule(condition, category) } }),
  })
}

async function file(row: Transaction, category: Category): Promise<void> {
  await fileUnder([row], category, words.review.filed, reviewKey('file', row))
}

/** Puts the rows' waiting parts in the shared cost in one write with one Undo. Resolves to whether it went through. */
function shareIn(rows: readonly Transaction[], sharedCost: SharedCost, key: string): Promise<boolean> {
  const records = store.state.records
  if (records === null || rows.length === 0) return Promise.resolve(false)
  const parts = new Set(rows.flatMap((row) => waitingParts(row).map((item) => item.id)))
  return writes.write(sharedCostWords.joined, (unit) => void joinSharedCost(unit, records, categories.value, rows, sharedCost, language, parts), { key, failedTitle: words.review.notWritten })
}

async function share(row: Transaction, sharedCost: SharedCost): Promise<void> {
  await shareIn([row], sharedCost, reviewKey('share', row))
}

/** Files the picked rows under one category or puts them in a shared cost, which ends the picking once written and keeps the picks when it is not. */
async function filePicked(id: string | undefined): Promise<void> {
  pickedCategory.value = ''
  const rows = pickedRows.value
  const sharedCost = sharedCosts.value.find((offer) => offer.sharedCost.id === id)?.sharedCost
  if (sharedCost !== undefined) {
    if (await shareIn(rows, sharedCost, 'file-picked')) picked.value = null
    return
  }
  const category = categories.value.find((candidate) => candidate.id === id)
  if (category === undefined) return
  if (await fileUnder(rows, category, plural(words.review.filedUnder(rows.length, category.name), rows.length), 'file-picked')) picked.value = null
}

/** Links the waiting row to the instalment it may pay, which files it and takes it off To review. */
async function link(row: Transaction): Promise<void> {
  const offer = offerOf.value(row)
  const records = store.state.records
  if (offer === null || records === null) return
  const place = { currency: currencyOf(row), categories: categories.value, language, notes: linkWords.notes }
  await writes.write(linkWords.linked, (unit) => linkEntry(unit, records, row, offer.target, place), { key: reviewKey('link', row), failedTitle: words.review.notWritten })
}

async function join({ row, maybeTyped }: WaitingRow): Promise<void> {
  const records = store.state.records
  if (maybeTyped !== null && records !== null)
    await writes.write(words.review.joined, (unit) => joinWithTyped(unit, records, maybeTyped.typed, maybeTyped.bank), { key: reviewKey('join', row), failedTitle: words.review.notWritten })
}

async function pair({ row, maybeTransfer }: WaitingRow): Promise<void> {
  const category = transfer.value
  const records = store.state.records
  if (maybeTransfer !== null && category !== null && records !== null)
    await writes.write(words.review.paired, (unit) => pairRows(unit, records, maybeTransfer, category.id), { key: reviewKey('pair', row), failedTitle: words.review.notWritten })
}
</script>

<template>
  <div v-if="queue !== null" class="near-figures flex flex-col gap-6">
    <p v-if="queue.wantingSavings > 0" class="type-aside" data-testid="spending-wants-savings">{{ plural(words.review.pocketsWaiting(queue.wantingSavings), queue.wantingSavings) }}</p>
    <AppCard v-if="held.items.value.length > 0" :title="words.review.held" data-testid="spending-review-held">
      <div class="px-4 pt-3 pb-4 sm:px-5">
        <QuestionList :items="held.items.value" :options="held.options" :label="twinWords.choice" :intro="twinWords.intro.sync" :saving="held.saving.value" @answer="held.answer">
          <template #amount="{ item }">
            <AccountMoneyText :cents="item.amount" :currency="item.currency" tone="flow" />
          </template>
        </QuestionList>
      </div>
    </AppCard>
    <DroppedRowsCard v-if="book !== null && book.dropped.length > 0" :dropped="book.dropped" />
    <CashWithdrawalsCard v-if="queue.withdrawals.length > 0" :withdrawals="queue.withdrawals" />
    <WaitingReceiptsCard v-if="receiptsAsk" :waiting="receipts" />
    <CompanyRolesCard v-if="company.roles !== null" :ask="company.roles" />
    <EmptyState
      v-if="
        queue.waiting.length === 0 &&
        held.items.value.length === 0 &&
        (book?.dropped.length ?? 0) === 0 &&
        queue.withdrawals.length === 0 &&
        receipts.length === 0 &&
        instalments.past.length === 0 &&
        instalments.extraPayments.length === 0 &&
        company.past.length === 0 &&
        company.roles === null
      "
      icon="i-lucide-inbox"
      :title="words.review.empty"
      :description="words.review.emptyDescription"
      data-testid="spending-review-empty"
    />
    <template v-else-if="queue.waiting.length > 0">
      <SelectionBar v-if="picked !== null" :count="picked.size" :all-picked="allPicked" @pick-all="pickAll" @cancel="picked = null">
        <UButton
          v-if="samePayeeRows.length > pickedRows.length"
          :label="words.review.pickSamePayee"
          icon="i-lucide-user-round-check"
          color="neutral"
          variant="outline"
          data-testid="spending-review-same-payee"
          @click="pickSamePayee"
        />
        <USelectMenu
          v-model="pickedCategory"
          :items="pickedCategories"
          value-key="value"
          :placeholder="words.review.fileUnder"
          :aria-label="words.review.pickCategory"
          :disabled="picked.size === 0"
          :loading="writes.saving('file-picked')"
          class="w-full sm:w-56"
          data-testid="spending-review-file-picked"
          @update:model-value="filePicked"
        />
      </SelectionBar>
      <AppCard :title="words.review.title" :subtitle="words.review.subtitle" v-bind="queueMarked" data-testid="spending-review">
        <template #actions>
          <UButton
            v-if="picked === null"
            v-bind="phone ? {} : { label: words.review.select }"
            :aria-label="words.review.selectHelp"
            icon="i-lucide-list-checks"
            size="sm"
            color="neutral"
            variant="outline"
            data-testid="spending-review-select"
            @click="picked = new Set()"
          />
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
            :offer="offerOf(waiting.row)"
            :picked="picked === null ? null : picked.has(waiting.row.id)"
            :saving="(action: ReviewAction) => writes.saving(reviewKey(action, waiting.row))"
            :shared-costs="joinable(waiting.row) ? sharedCosts : []"
            :repayment="waiting.row.amount > 0 && joinable(waiting.row) ? repayment : null"
            @file="file(waiting.row, $event)"
            @link="link(waiting.row)"
            @join="join(waiting)"
            @pair="pair(waiting)"
            @share="share(waiting.row, $event)"
            @receipt="emit('receipt', $event)"
            @pick="pick(waiting.row)"
          />
        </ul>
        <div v-if="queue.waiting.length > FIRST_SHOWN" class="px-4 pb-3 sm:px-5">
          <ShowAllButton v-model:expanded="allShown" :total="queue.waiting.length" />
        </div>
      </AppCard>
    </template>
    <CompanyPaymentsCard v-if="company.past.length > 0" :offers="company.past" @open="emit('open', $event)" />
    <InstalmentsCard v-for="card in instalments.past" :key="card.loan" :card="card" @open="emit('open', $event)" />
    <ExtraPaymentsCard v-if="instalments.extraPayments.length > 0" :offers="instalments.extraPayments" />
    <TransfersCard v-if="queue.pairs.length > 0 || queue.loneLegs.length > 0" :pairs="queue.pairs" :lone-legs="queue.loneLegs" />
    <WaitingReceiptsCard v-if="receipts.length > 0 && !receiptsAsk" ref="receiptsBelow" :waiting="receipts" />
    <RuleApplyDialog v-model:open="ruleDialogOpen" :asked="askedRule" />
  </div>
</template>
