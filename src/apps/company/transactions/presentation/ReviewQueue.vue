<script setup lang="ts">
import { computed, ref } from 'vue'
import USwitch from '@nuxt/ui/components/Switch.vue'

import { employeesOn, switchEmployees } from '../../../../shared/ai/infrastructure/assistSettings'
import AssistButton from '../../../../shared/ai/presentation/AssistButton.vue'
import { assistKeyKept, providerInUse, resultLine, usageLine, useAiTask } from '../../../../shared/ai/presentation/useAiTask'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { NO_RECORDS } from '../../../../shared/storage/domain/recordsRead'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import type { RecordWriteOptions } from '../../../../shared/storage/presentation/useRecordWrites'
import { plural } from '../../../../shared/text/translation'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { installedPack, shownPack } from '../../packs/packContribution'
import { SUGGEST_CATEGORIES, namesEmployee, sendsEmployees, sentRows, suggestCategories } from '../../assist/application/suggestCategories'
import type { CategorySuggestion, SuggestInput } from '../../assist/application/suggestCategories'
import { SUGGEST_CATEGORIES_SUMMARY } from '../../assist/presentation/companyAssist'
import { words as assistWords } from '../../assist/presentation/words'
import type { Verdict } from '../../../../shared/categorising/domain/categorise'
import { draftForRow } from '../../rules/domain/ruleDraft'
import { categorisationContextOf } from '../../rules/domain/categorisationContext'
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
import { words as appWords } from '../../words'

/** The To review tab: the rows that wait for a person, the model's suggestions for them, the pack's cards about them, and this page's changes with Undo. */
const props = defineProps<{
  /** The rows that wait, each with what the rules would file it as today. */
  queue: readonly { readonly transaction: Transaction; readonly verdict: Verdict }[]
}>()

const ledger = useFilteredLedger()
const store = useWorkbook()
const { state } = store
const names = useDisplayNames()
const writes = useRecordWrites(store)
const busy = computed(() => writes.busy.value || state.writing)

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

/** The model's suggestions, kept by row for this page only. Using one files the row as picking its category by hand would. */
const suggesting = useAiTask(suggestCategories)
const suggestionOf = computed(() => {
  const run = suggesting.state.value
  const suggestions: readonly CategorySuggestion[] = run.kind === 'done' && run.result.kind === 'draft' ? run.result.draft.suggestions : []
  return new Map(suggestions.map((suggestion) => [suggestion.rowId, suggestion]))
})
/** The rows still waiting that have a suggestion, so a row filed by its suggestion stops counting. */
const suggestedRows = computed(() => props.queue.filter(({ transaction }) => suggestionOf.value.has(transaction.id)))

const employees = computed(() =>
  state.records === null
    ? { employeeIbans: new Set<string>(), employeeNames: [] }
    : { employeeIbans: installedPack().employeeIbans(state.records), employeeNames: installedPack().employeeNames(state.records) },
)
const paysEmployees = computed(() => props.queue.some(({ transaction }) => namesEmployee(transaction, employees.value)))

/** The queue holds rows, yet the employee switch keeps every one of them from a request. */
const heldBack = computed(() => {
  const input = suggestInput()
  return input !== null && input.rows.length > 0 && sentRows(input).length === 0
})

const suggestLines = computed(() => {
  const run = suggesting.state.value
  const result = run.kind === 'done' ? run.result : null
  const missing = result?.kind === 'draft' ? result.draft.asked - result.draft.suggestions.length : 0
  return [
    heldBack.value ? assistWords.suggest.heldBack : null,
    suggestedRows.value.length > 0 ? plural(assistWords.suggest.outcome(suggestedRows.value.length), suggestedRows.value.length) : null,
    missing > 0 ? plural(assistWords.suggest.none(missing), missing) : null,
    result === null ? null : resultLine(result),
    result === null ? null : usageLine(result),
  ].filter((line) => line !== null)
})

function suggestInput(): SuggestInput | null {
  const workbook = state.workbook
  if (workbook === null) return null
  return {
    rows: props.queue.map(({ transaction }) => transaction),
    categories: workbook.categories,
    accounts: workbook.accounts,
    ...employees.value,
    includeEmployees: employeesOn(SUGGEST_CATEGORIES),
    packPairSides: installedPack().workbook?.pairSides ?? {},
  }
}

async function suggest(): Promise<void> {
  const input = suggestInput()
  if (input !== null && sentRows(input).length > 0) {
    await suggesting.run(input, sendsEmployees(input))
    expandedRow.value ??= suggestedRows.value[0]?.transaction.id ?? null
  }
}

function file(title: string, verdict: RowVerdict, options: RecordWriteOptions): Promise<boolean> {
  return writes.write(title, (unit) => fileRows(unit, state.records?.ledger ?? NO_RECORDS, [verdict], state.workbook?.categories ?? []), { failedTitle: words.review.notWritten, ...options })
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
          <template #actions>
            <AssistButton
              :app="suggestCategories.app"
              :app-name="appWords.name"
              :task="SUGGEST_CATEGORIES_SUMMARY"
              :label="assistWords.suggest.title"
              :loading="suggesting.state.value.kind === 'running'"
              @run="suggest"
            />
          </template>
          <template v-if="assistKeyKept && (paysEmployees || suggestLines.length > 0)" #header>
            <div class="flex flex-col gap-2" data-testid="review-suggest-status">
              <USwitch
                v-if="paysEmployees"
                :model-value="employeesOn(SUGGEST_CATEGORIES)"
                :label="assistWords.suggest.employees"
                :description="assistWords.suggest.employeesNote(providerInUse()?.name ?? '')"
                data-testid="review-suggest-employees"
                @update:model-value="switchEmployees(SUGGEST_CATEGORIES, $event)"
              />
              <p v-for="line in suggestLines" :key="line" class="text-xs text-muted" data-testid="review-suggest-line">{{ line }}</p>
            </div>
          </template>
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
              :saving="writes.saving"
              :suggestion="suggestionOf.get(entry.transaction.id) ?? null"
              @toggle="toggle(entry.transaction.id)"
              @confirm="confirm(entry.transaction)"
              @recategorise="recategorise(entry.transaction, $event)"
              @make-rule="makeRule(entry.transaction)"
              @split="openSplit(entry.transaction)"
            />
          </ul>
        </AppCard>

        <component :is="card.component" v-for="(card, index) in packCards" :key="index" :busy="busy" />

        <SessionChanges :writes="sessionWrites" :categories="ledger.workbook.categories" :busy="busy" :saving="writes.saving" @undo="writes.undo" />

        <SplitDialog v-if="splitting" v-model:open="splitOpen" :row="splitting.row" :split="splitting.split" :categories="ledger.workbook.categories" />
      </template>
    </LedgerGate>

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
  </div>
</template>
