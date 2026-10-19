<script setup lang="ts">
import { computed, ref } from 'vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import PageHeader from '../../../shared/ui/PageHeader.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { categorise } from '../../rules/domain/categorise'
import type { CoverageGroup } from '../../rules/domain/ruleCoverage'
import { ruleCoverage } from '../../rules/domain/ruleCoverage'
import { draftForRow } from '../../rules/domain/ruleDraft'
import { categorisationContextOf } from '../../rules/domain/transactionFacts'
import RuleEditor from '../../rules/presentation/RuleEditor.vue'
import type { RuleEditorSource } from '../../rules/presentation/RuleEditor.vue'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { SessionWrite } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { sheetRowLink } from '../../workbook/infrastructure/sheetRowLink'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useLedgerWrites } from '../application/useLedgerWrites'
import { confirmation, recategorisation } from '../domain/verdictChanges'
import ReviewQueueItem from './ReviewQueueItem.vue'
import RuleCoverage from './RuleCoverage.vue'
import SessionChanges from './SessionChanges.vue'

const ledger = useFilteredLedger()
const store = useWorkbook()
const { state } = store
const toast = useToast()
const names = useDisplayNames()
const writes = useLedgerWrites()

const context = computed(() => (ledger.value === null ? null : categorisationContextOf(ledger.value.workbook)))
const busy = computed(() => writes.busy.value || state.writing)

/** The queue has no period: a row waits until someone settles it, however old it is. */
const queue = computed(() => {
  const current = ledger.value
  if (current === null || context.value === null) {
    return []
  }
  const { workbook } = current
  return current.scoped.filter(needsReview).map((transaction) => ({
    transaction,
    verdict: categorise(transaction, workbook.rules, context.value!),
    link: sheetRowLink(workbook.id, workbook.ledgerSheetId, transaction.sheetRow),
  }))
})

const coverage = computed(() =>
  ledger.value === null || context.value === null ? { notCovered: [], exceptions: [] } : ruleCoverage(ledger.value.scoped, ledger.value.workbook.rules, context.value),
)

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

const expandedRow = ref<number | null>(null)

function toggle(sheetRow: number): void {
  expandedRow.value = expandedRow.value === sheetRow ? null : sheetRow
}

const description = computed(() =>
  ledger.value?.workbook.source === 'google'
    ? 'Rows that wait for a person. Confirm or recategorise one here and the app writes its category and flagged_by to the Sheet.'
    : 'Rows that wait for a person. Confirm or recategorise one here and the app keeps its category and flagged_by in this browser.',
)

async function confirm(transaction: Transaction): Promise<void> {
  const workbook = ledger.value?.workbook
  const change = workbook === undefined ? null : confirmation(transaction, workbook.settings)
  if (change === null) return
  await writes.write([change], { title: `Confirmed ${names.value.category(transaction.category)}`, description: transaction.counterparty || 'A row with no counterparty' })
}

async function recategorise(transaction: Transaction, category: string): Promise<void> {
  const workbook = ledger.value?.workbook
  if (workbook === undefined) return
  await writes.write([recategorisation(transaction, category, workbook.settings)], {
    title: `Filed as ${names.value.category(category)}`,
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
</script>

<template>
  <section class="flex max-w-measure flex-col gap-6">
    <PageHeader title="Review" :description="description" />
    <LedgerGate>
      <template v-if="ledger">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

        <SessionChanges
          :writes="sessionWrites"
          :transactions="ledger.workbook.transactions"
          :categories="ledger.workbook.categories"
          :busy="busy"
          @undo="undoSessionWrite"
        />

        <UEmpty
          v-if="queue.length === 0"
          icon="i-lucide-check-check"
          title="Nothing waits for review"
          description="Every row in view has a category a rule or a person set."
          variant="outline"
          class="rounded-card bg-raised"
        />
        <section v-else class="min-w-0 overflow-clip rounded-card border border-default bg-raised shadow-raised" data-testid="review-queue">
          <header class="px-4 pt-4 pb-3 sm:px-5">
            <h2 class="text-sm font-medium text-highlighted">{{ queue.length }} {{ queue.length === 1 ? 'row' : 'rows' }} to review</h2>
            <p class="mt-0.5 text-xs text-muted">Newest first, from every month of the ledger. Open a row to see what the rules say about it.</p>
          </header>
          <ul class="border-t border-default">
            <ReviewQueueItem
              v-for="entry in queue"
              :key="entry.transaction.sheetRow"
              :transaction="entry.transaction"
              :verdict="entry.verdict"
              :categories="ledger.workbook.categories"
              :expanded="expandedRow === entry.transaction.sheetRow"
              :link="entry.link"
              :busy="busy"
              @toggle="toggle(entry.transaction.sheetRow)"
              @confirm="confirm(entry.transaction)"
              @recategorise="recategorise(entry.transaction, $event)"
              @make-rule="makeRule(entry.transaction)"
            />
          </ul>
        </section>

        <RuleCoverage :coverage="coverage" :categories="ledger.workbook.categories" :busy="busy" @make-rule="makeRuleForGroup" />
        <RuleEditor v-model:open="editorOpen" :source="editorSource" />
      </template>
    </LedgerGate>
  </section>
</template>
