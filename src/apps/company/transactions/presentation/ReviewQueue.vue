<script setup lang="ts">
import { computed, ref } from 'vue'

import AskChatButton from '../../../../shared/ai/presentation/AskChatButton.vue'
import { useChatElement } from '../../../../shared/ai/presentation/chatDock'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import type { RecordWriteOptions } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { installedPack, shownPack } from '../../packs/packContribution'
import type { Verdict } from '../../../../shared/categorising/domain/categorise'
import { draftForRow } from '../../rules/domain/ruleDraft'
import { categorisationContextOf } from '../../rules/domain/categorisationContext'
import RuleEditor from '../../rules/presentation/RuleEditor.vue'
import type { RuleEditorSource } from '../../rules/presentation/RuleEditor.vue'
import { useSettings } from '../../settings/application/useSettings'
import { treatPayeeAsPerson } from '../../settings/application/settingWrites'
import { flaggedAsPerson } from '../../../../shared/privacy/domain/personPayees'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { LedgerSplit } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'
import { COMPANY_APP } from '../../workbook/domain/companyApp'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { fileRows } from '../application/fileRows'
import { useFilteredLedger } from '../application/useFilteredLedger'
import { confirmation, recategorisation } from '../domain/verdictChanges'
import type { RowVerdict } from '../domain/verdictChanges'
import ReviewQueueItem from './ReviewQueueItem.vue'
import SessionChanges from './SessionChanges.vue'
import SplitDialog from './SplitDialog.vue'
import { REVIEW_LINK } from './transactionsLinks'
import { words } from './words'

/** The To review tab: the rows that wait for a person, the pack's cards about them, and this page's changes with Undo. Suggest categories asks the chat about the queue. */
const props = defineProps<{
  /** The rows that wait, each with what the rules would file it as today. */
  queue: readonly { readonly transaction: Transaction; readonly verdict: Verdict }[]
}>()

const ledger = useFilteredLedger()
const store = useWorkbook()
const { state } = store
const names = useDisplayNames()
const writes = useRecordWrites(store)

const settings = useSettings()
const packCards = computed(() => shownPack(settings.value).reviewCards)
/** Nothing waits when the queue is empty and no pack card has anything for the rows in view. */
const nothingWaits = computed(() => props.queue.length === 0 && !packCards.value.some((card) => ledger.value !== null && card.shows(ledger.value)))

/** Writes to other workbooks this page showed earlier cannot be undone here, so they are left out. */
const sessionWrites = computed(() => state.writes.filter((write) => write.workbookId === state.workbook?.id))

const expandedRow = ref<RecordId | null>(null)

function toggle(id: RecordId): void {
  expandedRow.value = expandedRow.value === id ? null : id
}

/** The queue as a place, so the chat reads the rows waiting on it. Suggest categories sends its request by itself. */
const { ask: askAboutQueue, marked: queueMarked } = useChatElement(
  { key: 'company-review-queue', label: words.tabs.review, about: { kind: 'place', app: COMPANY_APP, route: REVIEW_LINK } },
  'card',
  words.review.suggestCategoriesTask,
)

function file(title: string, verdict: RowVerdict, options: RecordWriteOptions): Promise<boolean> {
  const { records, workbook } = state
  if (records === null || records === undefined || workbook === null || workbook === undefined) return Promise.resolve(false)
  return writes.write(title, (unit) => fileRows(unit, { records, workbook }, [verdict], workbook.categories), { failedTitle: words.review.notWritten, ...options })
}

async function confirm(transaction: Transaction): Promise<void> {
  const workbook = ledger.value?.workbook
  const verdict = workbook === undefined ? null : confirmation(transaction, workbook.settings)
  if (verdict === null) return
  await file(words.review.confirmed(names.value.category(transaction.category)), verdict, { key: `confirm-${transaction.id}`, description: transaction.counterparty || words.review.noCounterpartyRow })
}

async function recategorise(transaction: Transaction, category: string): Promise<void> {
  const workbook = ledger.value?.workbook
  if (workbook === undefined) return
  await file(words.review.filedAs(names.value.category(category)), recategorisation(transaction, category, workbook.settings), {
    key: `recategorise-${transaction.id}`,
    description: transaction.counterparty || words.review.noCounterpartyRow,
    follow: { label: words.review.makeRule, icon: 'i-lucide-list-plus', run: () => makeRule({ ...transaction, category }) },
  })
}

const editorOpen = ref(false)
const editorSource = ref<RuleEditorSource | null>(null)

function makeRule(transaction: Transaction): void {
  const workbook = state.workbook
  if (workbook === null) return
  editorSource.value = {
    title: words.review.makeRuleFromRow,
    draft: draftForRow(transaction, workbook, categorisationContextOf(workbook), installedPack().workbook?.directionPairedRoles ?? []),
    edited: null,
    split: [],
  }
  editorOpen.value = true
}

/** The payment the split editor is open on. */
const splitting = ref<Transaction | null>(null)
const splitOpen = ref(false)

function splitOf(row: Transaction): LedgerSplit | null {
  return ledger.value?.workbook.splits.find((split) => split.row.id === row.id) ?? null
}

async function treatCounterparty(transaction: Transaction): Promise<void> {
  const counterparty = transaction.counterparty.trim()
  if (counterparty === '') return
  const asPerson = !flaggedAsPerson(settings.value.personPayees, counterparty)
  await writes.write(asPerson ? words.review.treatedAsPerson : words.review.treatedAsCompany, (unit) => treatPayeeAsPerson(unit, state.records?.settings ?? NO_RECORDS, counterparty, asPerson), {
    key: `person-${transaction.id}`,
    description: counterparty,
    failedTitle: words.review.notWritten,
  })
}

function openSplit(row: Transaction): void {
  splitting.value = row
  splitOpen.value = true
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <LedgerGate>
      <template v-if="ledger">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

        <EmptyState v-if="nothingWaits" icon="i-lucide-check-check" :title="words.review.nothingWaits" :description="words.review.nothingWaitsDescription" />
        <AppCard
          v-if="queue.length > 0"
          class="overflow-clip"
          :title="plural(words.review.toReview(queue.length), queue.length)"
          :subtitle="words.review.queueSubtitle(ledger.workbook.source === 'drive')"
          collapse-id="review.queue"
          :summary="words.review.queueSummary"
          data-testid="review-queue"
          v-bind="queueMarked"
        >
          <template #actions>
            <AskChatButton :text="words.review.suggestCategories" data-testid="review-queue-ask" @ask="askAboutQueue" />
          </template>
          <ul class="mt-3 divide-y divide-default border-t border-default">
            <ReviewQueueItem
              v-for="entry in queue"
              :key="entry.transaction.id"
              :transaction="entry.transaction"
              :verdict="entry.verdict"
              :categories="ledger.workbook.categories"
              :expanded="expandedRow === entry.transaction.id"
              :split="splitOf(entry.transaction) !== null"
              :saving="writes.saving"
              :person-counterparty="flaggedAsPerson(settings.personPayees, entry.transaction.counterparty)"
              @toggle="toggle(entry.transaction.id)"
              @confirm="confirm(entry.transaction)"
              @recategorise="recategorise(entry.transaction, $event)"
              @make-rule="makeRule(entry.transaction)"
              @split="openSplit(entry.transaction)"
              @treat-counterparty="treatCounterparty(entry.transaction)"
            />
          </ul>
        </AppCard>

        <component :is="card.component" v-for="(card, index) in packCards" :key="index" />

        <SessionChanges :writes="sessionWrites" :categories="ledger.workbook.categories" :saving="writes.saving" @undo="writes.undo" />

        <SplitDialog v-if="splitting" v-model:open="splitOpen" :row="splitting" :categories="ledger.workbook.categories" />
      </template>
    </LedgerGate>

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
  </div>
</template>
