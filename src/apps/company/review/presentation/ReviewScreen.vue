<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { today } from '../../../../shared/calendar/civilDate'
import AppCard from '../../../../shared/ui/AppCard.vue'
import PageHeader from '../../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../../shared/ui/PageTabs.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { shownPack } from '../../packs/packContribution'
import { categorise } from '../../rules/domain/categorise'
import type { CoverageGroup } from '../../rules/domain/ruleCoverage'
import { ruleCoverage } from '../../rules/domain/ruleCoverage'
import { draftForRow } from '../../rules/domain/ruleDraft'
import { categorisationContextOf } from '../../rules/domain/transactionFacts'
import RuleEditor from '../../rules/presentation/RuleEditor.vue'
import type { RuleEditorSource } from '../../rules/presentation/RuleEditor.vue'
import RulesTab from '../../rules/presentation/RulesTab.vue'
import { useSettings } from '../../settings/application/useSettings'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { scopeTransactions } from '../../transactions/domain/filterTransactions'
import SplitDialog from '../../transactions/presentation/SplitDialog.vue'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { SessionWrite } from '../../../../shared/storage/application/createWorkbookStore'
import type { Dismissal, SuggestionKind } from '../../workbook/domain/dismissals'
import { needsReview } from '../../workbook/domain/needsReview'
import type { LedgerSplit } from '../../workbook/domain/splits'
import type { Transaction } from '../../workbook/domain/workbook'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { NO_RECORDS, recordWithId } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import type { RecordWriteOptions } from '../../../../shared/storage/presentation/useRecordWrites'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import { DISMISSAL_WRITES, dismissalOfGroup } from '../application/dismissalWrites'
import { fileRows } from '../application/fileRows'
import { withoutDismissed } from '../domain/dismissedSuggestions'
import { confirmation, recategorisation } from '../domain/verdictChanges'
import type { RowVerdict } from '../domain/verdictChanges'
import DismissedSuggestions from './DismissedSuggestions.vue'
import ReviewQueueItem from './ReviewQueueItem.vue'
import RuleCoverage from './RuleCoverage.vue'
import SessionChanges from './SessionChanges.vue'

const ledger = useFilteredLedger()
const store = useWorkbook()
const { state } = store
const toast = useToast()
const names = useDisplayNames()
const writes = useRecordWrites(store)

const context = computed(() => (ledger.value === null ? null : categorisationContextOf(ledger.value.workbook)))
const busy = computed(() => writes.busy.value || state.writing)

/** The bank rows the filters select, split rows whole, since a person reviews and a rule files the row the bank booked. */
const bankRows = computed(() => (ledger.value === null || state.workbook === null ? [] : scopeTransactions(state.workbook.transactions, ledger.value.filters)))

/** The queue has no period: a row waits until someone settles it, however old it is. */
const queue = computed(() => {
  const current = ledger.value
  if (current === null || context.value === null) {
    return []
  }
  const { workbook } = current
  return bankRows.value.filter(needsReview).map((transaction) => ({
    transaction,
    verdict: categorise(transaction, workbook.rules, context.value!),
  }))
})

const tabs = computed(() => [
  { label: 'Queue', value: 'queue', icon: 'i-lucide-inbox', count: queue.value.length },
  { label: 'Rules', value: 'rules', icon: 'i-lucide-list-ordered' },
])

const settings = useSettings()
const packCards = computed(() => shownPack(settings.value).reviewCards)
/** Nothing waits when the queue is empty and no pack card has anything for the rows in view. */
const nothingWaits = computed(() => queue.value.length === 0 && !packCards.value.some((card) => ledger.value !== null && card.shows(ledger.value)))

/** The Rules tab has no filters, so the rows no rule repeats come from the whole ledger. */
const coverage = computed(() => {
  const workbook = state.workbook
  const empty = { notCovered: [], exceptions: [] }
  return withoutDismissed(workbook === null || context.value === null ? empty : ruleCoverage(workbook.transactions, workbook.rules, context.value), workbook?.dismissals ?? [])
})
const hiddenGroups = computed(() => coverage.value.dismissed.filter((entry) => entry.group !== null).length)

/** Writes to other workbooks this page showed earlier cannot be undone here, so they are left out. */
const sessionWrites = computed(() => state.writes.filter((write) => write.workbookId === state.workbook?.id))

async function undoSessionWrite(write: SessionWrite): Promise<void> {
  try {
    await store.undo(write)
    toast.add({ title: 'Undone', description: 'The workbook is back as it was before that change.', icon: 'i-lucide-undo-2', color: 'neutral' })
  } catch (failure) {
    toast.add({ title: 'Not undone', description: failure instanceof Error ? failure.message : String(failure), icon: 'i-lucide-triangle-alert', color: 'error', duration: 10_000 })
  }
}

const expandedRow = ref<RecordId | null>(null)

function toggle(id: RecordId): void {
  expandedRow.value = expandedRow.value === id ? null : id
}

const description = computed(() =>
  ledger.value?.workbook.source === 'drive'
    ? 'Rows that wait for a person, and the rules that decide the rest. Confirm or recategorise a row and the app writes its category and flagged_by to the file on Drive.'
    : 'Rows that wait for a person, and the rules that decide the rest. Confirm or recategorise a row and the app keeps its category and flagged_by in this browser.',
)

function file(title: string, verdict: RowVerdict, options: RecordWriteOptions = {}): Promise<boolean> {
  return writes.write(title, (unit) => fileRows(unit, state.records?.ledger ?? NO_RECORDS, [verdict], state.workbook?.categories ?? []), { failedTitle: 'Not written', ...options })
}

async function confirm(transaction: Transaction): Promise<void> {
  const workbook = ledger.value?.workbook
  const verdict = workbook === undefined ? null : confirmation(transaction, workbook.settings)
  if (verdict === null) return
  await file(`Confirmed ${names.value.category(transaction.category)}`, verdict, { description: transaction.counterparty || 'A row with no counterparty' })
}

async function recategorise(transaction: Transaction, category: string): Promise<void> {
  const workbook = ledger.value?.workbook
  if (workbook === undefined) return
  await file(`Filed as ${names.value.category(category)}`, recategorisation(transaction, category, workbook.settings), {
    description: transaction.counterparty || 'A row with no counterparty',
    follow: { label: 'Make a rule', icon: 'i-lucide-list-plus', run: () => makeRule({ ...transaction, category }) },
  })
}

const editorOpen = ref(false)
const editorSource = ref<RuleEditorSource | null>(null)

function makeRule(transaction: Transaction, title = 'Make a rule from this row', split: RuleEditorSource['split'] = []): void {
  const workbook = state.workbook
  if (workbook === null) return
  editorSource.value = { title, draft: draftForRow(transaction, workbook, categorisationContextOf(workbook)), edited: null, split }
  editorOpen.value = true
}

/** Drafted from the newest row in the group's most common category, so a split group starts where most of its rows are. */
function makeRuleForGroup(group: CoverageGroup<Transaction>): void {
  const mostCommon = group.categories[0]?.category
  const newest = group.rows.find((row) => row.category === mostCommon)
  if (newest !== undefined) makeRule(newest, `Make a rule for ${group.name || 'these rows'}`, group.categories)
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

function dismiss(kind: SuggestionKind, group: CoverageGroup<Transaction>): void {
  void writes.write(`Dismissed ${group.name || 'the rows with no counterparty'}`, (unit) => unit.of(DISMISSAL_WRITES).add(dismissalOfGroup(kind, group, today())), {
    failedTitle: 'Not dismissed',
  })
}

function restore(dismissal: Dismissal): void {
  const stored = recordWithId(state.records?.dismissed ?? NO_RECORDS, dismissal.id)
  if (stored === null) return
  void writes.write('Suggestion restored', (unit) => unit.of(DISMISSAL_WRITES).remove(stored.record), { failedTitle: 'Not restored' })
}
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Review" :description="description" />
    <PageTabs :tabs="tabs" label="Queue and rules">
      <template #queue>
        <div class="flex flex-col gap-6">
          <LedgerGate>
            <template v-if="ledger">
              <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

              <EmptyState v-if="nothingWaits" icon="i-lucide-check-check" title="Nothing waits for review" description="Every row in view has a category a rule or a person set." />
              <AppCard
                v-if="queue.length > 0"
                class="overflow-clip"
                :title="`${queue.length} ${queue.length === 1 ? 'row' : 'rows'} to review`"
                subtitle="Newest first, from every month of the ledger. Open a row to see what the rules say about it."
                collapse-id="review.queue"
                summary="Each waits for a confirmation or another category."
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
        </div>
      </template>

      <template #rules>
        <div v-if="state.workbook" class="flex flex-col gap-6">
          <RulesTab />
          <RuleCoverage :coverage="coverage.coverage" :categories="state.workbook.categories" :busy="busy" :dismissed-count="hiddenGroups" @make-rule="makeRuleForGroup" @dismiss="dismiss" />
          <DismissedSuggestions v-if="coverage.dismissed.length" :dismissed="coverage.dismissed" :categories="state.workbook.categories" :busy="busy" @restore="restore" />
        </div>
      </template>
    </PageTabs>

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
  </section>
</template>
