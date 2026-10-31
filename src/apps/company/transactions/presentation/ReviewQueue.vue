<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import type { SessionWrite } from '../../../../shared/storage/application/createWorkbookStore'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import type { RecordWriteOptions } from '../../../../shared/storage/presentation/useRecordWrites'
import { words as storageWords } from '../../../../shared/storage/presentation/words'
import { plural } from '../../../../shared/text/translation'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { shownPack } from '../../packs/packContribution'
import type { Verdict } from '../../rules/domain/categorise'
import { draftForRow } from '../../rules/domain/ruleDraft'
import { categorisationContextOf } from '../../rules/domain/transactionFacts'
import RuleEditor from '../../rules/presentation/RuleEditor.vue'
import type { RuleEditorSource } from '../../rules/presentation/RuleEditor.vue'
import { useSettings } from '../../settings/application/useSettings'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { LedgerSplit } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { fileRows } from '../application/fileRows'
import { useFilteredLedger } from '../application/useFilteredLedger'
import { confirmation, recategorisation } from '../domain/verdictChanges'
import type { RowVerdict } from '../domain/verdictChanges'
import ReviewQueueItem from './ReviewQueueItem.vue'
import SessionChanges from './SessionChanges.vue'
import SplitDialog from './SplitDialog.vue'
import { words } from './words'

/** The To review tab: the rows that wait for a person, the pack's cards about them, and this page's changes with Undo. */
const props = defineProps<{
  /** The rows that wait, each with what the rules would file it as today. */
  queue: readonly { readonly transaction: Transaction; readonly verdict: Verdict }[]
}>()

const ledger = useFilteredLedger()
const store = useWorkbook()
const { state } = store
const toast = useToast()
const names = useDisplayNames()
const writes = useRecordWrites(store)
const busy = computed(() => writes.busy.value || state.writing)

const settings = useSettings()
const packCards = computed(() => shownPack(settings.value).reviewCards)
/** Nothing waits when the queue is empty and no pack card has anything for the rows in view. */
const nothingWaits = computed(() => props.queue.length === 0 && !packCards.value.some((card) => ledger.value !== null && card.shows(ledger.value)))

/** Writes to other workbooks this page showed earlier cannot be undone here, so they are left out. */
const sessionWrites = computed(() => state.writes.filter((write) => write.workbookId === state.workbook?.id))

async function undoSessionWrite(write: SessionWrite): Promise<void> {
  try {
    await store.undo(write)
    toast.add({ title: storageWords.undone, description: words.review.backAsItWas, icon: 'i-lucide-undo-2', color: 'neutral' })
  } catch (failure) {
    toast.add({ title: storageWords.notUndone, description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  }
}

const expandedRow = ref<RecordId | null>(null)

function toggle(id: RecordId): void {
  expandedRow.value = expandedRow.value === id ? null : id
}

function file(title: string, verdict: RowVerdict, options: RecordWriteOptions = {}): Promise<boolean> {
  return writes.write(title, (unit) => fileRows(unit, state.records?.ledger ?? NO_RECORDS, [verdict], state.workbook?.categories ?? []), { failedTitle: words.review.notWritten, ...options })
}

async function confirm(transaction: Transaction): Promise<void> {
  const workbook = ledger.value?.workbook
  const verdict = workbook === undefined ? null : confirmation(transaction, workbook.settings)
  if (verdict === null) return
  await file(words.review.confirmed(names.value.category(transaction.category)), verdict, { description: transaction.counterparty || words.review.noCounterpartyRow })
}

async function recategorise(transaction: Transaction, category: string): Promise<void> {
  const workbook = ledger.value?.workbook
  if (workbook === undefined) return
  await file(words.review.filedAs(names.value.category(category)), recategorisation(transaction, category, workbook.settings), {
    description: transaction.counterparty || words.review.noCounterpartyRow,
    follow: { label: words.review.makeRule, icon: 'i-lucide-list-plus', run: () => makeRule({ ...transaction, category }) },
  })
}

const editorOpen = ref(false)
const editorSource = ref<RuleEditorSource | null>(null)

function makeRule(transaction: Transaction): void {
  const workbook = state.workbook
  if (workbook === null) return
  editorSource.value = { title: words.review.makeRuleFromRow, draft: draftForRow(transaction, workbook, categorisationContextOf(workbook)), edited: null, split: [] }
  editorOpen.value = true
}

/** The payment the split editor is open on, with its split on the splits tab or null. */
const splitting = ref<{ readonly row: Transaction; readonly split: LedgerSplit | null } | null>(null)
const splitOpen = ref(false)

function splitOf(row: Transaction): LedgerSplit | null {
  return state.workbook?.splits.find((split) => split.row.id === row.id) ?? null
}

function openSplit(row: Transaction): void {
  splitting.value = { row, split: splitOf(row) }
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
        >
          <ul class="mt-3 border-t border-default">
            <ReviewQueueItem
              v-for="entry in queue"
              :key="entry.transaction.id"
              :transaction="entry.transaction"
              :verdict="entry.verdict"
              :categories="ledger.workbook.categories"
              :expanded="expandedRow === entry.transaction.id"
              :split="splitOf(entry.transaction) !== null"
              :busy="busy"
              @toggle="toggle(entry.transaction.id)"
              @confirm="confirm(entry.transaction)"
              @recategorise="recategorise(entry.transaction, $event)"
              @make-rule="makeRule(entry.transaction)"
              @split="openSplit(entry.transaction)"
            />
          </ul>
        </AppCard>

        <component :is="card.component" v-for="(card, index) in packCards" :key="index" :busy="busy" />

        <SessionChanges :writes="sessionWrites" :categories="ledger.workbook.categories" :busy="busy" @undo="undoSessionWrite" />

        <SplitDialog v-if="splitting" v-model:open="splitOpen" :row="splitting.row" :split="splitting.split" :categories="ledger.workbook.categories" />
      </template>
    </LedgerGate>

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
  </div>
</template>
