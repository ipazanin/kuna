<script setup lang="ts">
import { computed, ref } from 'vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'

import PageHeader from '../../../shared/ui/PageHeader.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
import { categorise } from '../../rules/domain/categorise'
import type { CoverageGap } from '../../rules/domain/ruleCoverage'
import { ruleCoverageGaps } from '../../rules/domain/ruleCoverage'
import { draftForRow } from '../../rules/domain/ruleDraft'
import { categorisationContextOf } from '../../rules/domain/transactionFacts'
import RuleEditor from '../../rules/presentation/RuleEditor.vue'
import type { RuleEditorSource } from '../../rules/presentation/RuleEditor.vue'
import { useFilteredLedger } from '../../transactions/application/useFilteredLedger'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { needsReview } from '../../workbook/domain/needsReview'
import type { Transaction } from '../../workbook/domain/workbook'
import { sheetRowLink } from '../../workbook/infrastructure/sheetRowLink'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useLedgerWrites } from '../application/useLedgerWrites'
import { confirmation, recategorisation } from '../domain/verdictChanges'
import ReviewQueueItem from './ReviewQueueItem.vue'
import RuleCoverage from './RuleCoverage.vue'

const ledger = useFilteredLedger()
const { state } = useWorkbook()
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

const gaps = computed(() => (ledger.value === null || context.value === null ? [] : ruleCoverageGaps(ledger.value.scoped, ledger.value.workbook.rules, context.value)))

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

function makeRule(transaction: Transaction, title = 'Make a rule from this row'): void {
  const workbook = state.workbook
  if (workbook === null) return
  editorSource.value = { title, draft: draftForRow(transaction, workbook, categorisationContextOf(workbook)), edited: null }
  editorOpen.value = true
}

function makeRuleForGap(gap: CoverageGap<Transaction>): void {
  const [newest] = gap.rows
  if (newest !== undefined) makeRule(newest, `Make a rule for ${gap.name || 'these rows'}`)
}
</script>

<template>
  <section class="flex flex-col gap-6">
    <PageHeader title="Review" :description="description" />
    <LedgerGate>
      <template v-if="ledger">
        <FilterBar :workbook="ledger.workbook" :window="ledger.window" :show-period="false" />

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

        <RuleCoverage :gaps="gaps" :categories="ledger.workbook.categories" :busy="busy" @make-rule="makeRuleForGap" />
        <RuleEditor v-model:open="editorOpen" :source="editorSource" />
      </template>
    </LedgerGate>
  </section>
</template>
