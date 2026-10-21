<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UEmpty from '@nuxt/ui/components/Empty.vue'
import UModal from '@nuxt/ui/components/Modal.vue'
import { useToast } from '@nuxt/ui/composables/useToast'

import { today } from '../../../shared/calendar/civilDate'
import { usePhoneLayout } from '../../../shared/layout/viewport'
import { sumMoney } from '../../../shared/money/money'
import { formatMoney } from '../../../shared/money/moneyFormat'
import AppCard from '../../../shared/ui/AppCard.vue'
import PageHeader from '../../../shared/ui/PageHeader.vue'
import PageTabs from '../../../shared/ui/PageTabs.vue'
import { ownerAdvances } from '../../../packs/hr-doo/domain/ownerAdvances'
import AddAdvanceDialog from '../../../packs/hr-doo/presentation/AddAdvanceDialog.vue'
import type { AdvancePrefill } from '../../../packs/hr-doo/presentation/AddAdvanceDialog.vue'
import UnaccountedReimbursements from '../../../packs/hr-doo/presentation/UnaccountedReimbursements.vue'
import FilterBar from '../../filters/presentation/FilterBar.vue'
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
import { rowCellsOf } from '../../workbook/application/tabRowWrites'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import type { SessionWrite } from '../../workbook/application/workbookStore'
import type { Dismissal, SuggestionKind } from '../../workbook/domain/dismissals'
import { needsReview } from '../../workbook/domain/needsReview'
import type { LedgerSplit } from '../../workbook/domain/splits'
import { newestBookingOf } from '../../workbook/domain/workbook'
import type { Transaction } from '../../workbook/domain/workbook'
import { sheetRowLink } from '../../workbook/infrastructure/sheetRowLink'
import { TEMPLATE_COLUMNS } from '../../workbook/infrastructure/workbookTemplate'
import AddTabNotice from '../../workbook/presentation/AddTabNotice.vue'
import LedgerGate from '../../workbook/presentation/LedgerGate.vue'
import { useRowWrites } from '../../workbook/presentation/useRowWrites'
import { DISMISSED_ROWS, dismissalCells } from '../application/dismissedRows'
import { useLedgerWrites } from '../application/useLedgerWrites'
import { withoutDismissed } from '../domain/dismissedSuggestions'
import { confirmation, recategorisation } from '../domain/verdictChanges'
import DismissedSuggestions from './DismissedSuggestions.vue'
import ReviewQueueItem from './ReviewQueueItem.vue'
import RuleCoverage from './RuleCoverage.vue'
import SessionChanges from './SessionChanges.vue'

const ledger = useFilteredLedger()
const store = useWorkbook()
const { state } = store
const toast = useToast()
const names = useDisplayNames()
const writes = useLedgerWrites()
const dismissWrites = useRowWrites(DISMISSED_ROWS)
const phone = usePhoneLayout()

const context = computed(() => (ledger.value === null ? null : categorisationContextOf(ledger.value.workbook)))
const busy = computed(() => writes.busy.value || dismissWrites.busy.value || state.writing)

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
    link: sheetRowLink(workbook.id, workbook.ledgerSheetId, transaction.sheetRow),
  }))
})

const tabs = computed(() => [
  { label: 'Queue', value: 'queue', icon: 'i-lucide-inbox', count: queue.value.length },
  { label: 'Rules', value: 'rules', icon: 'i-lucide-list-ordered' },
])

const settings = useSettings()

/** Payments to the owner that no cost the owner paid accounts for, which wait until a person adds the cost. */
const unaccounted = computed(() => {
  const current = ledger.value
  if (current === null || !settings.value.ownerPayModule) return []
  return ownerAdvances(current.scopedAdvances, current.scoped, current.workbook.categories).unaccounted
})
const unaccountedSummary = computed(() => `${formatMoney(sumMoney(unaccounted.value.map((payment) => payment.amount)))} in all, counted as paid to the owner`)
const newestBooking = computed(() => newestBookingOf(ledger.value?.workbook.transactions ?? []))
const addingCost = ref(false)
const costPrefill = ref<AdvancePrefill | null>(null)

function addCost(prefill: AdvancePrefill): void {
  costPrefill.value = prefill
  addingCost.value = true
}

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

const expandedRow = ref<number | null>(null)

function toggle(sheetRow: number): void {
  expandedRow.value = expandedRow.value === sheetRow ? null : sheetRow
}

const description = computed(() =>
  ledger.value?.workbook.source === 'google'
    ? 'Rows that wait for a person, and the rules that decide the rest. Confirm or recategorise a row and the app writes its category and flagged_by to the Sheet.'
    : 'Rows that wait for a person, and the rules that decide the rest. Confirm or recategorise a row and the app keeps its category and flagged_by in this browser.',
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

/** The payment the split editor is open on, with its split on the splits tab or null. */
const splitting = ref<{ readonly row: Transaction; readonly split: LedgerSplit | null } | null>(null)
const splitOpen = ref(false)

function splitOf(row: Transaction): LedgerSplit | null {
  return state.workbook?.splits.find((split) => split.row.sheetRow === row.sheetRow) ?? null
}

function openSplit(row: Transaction): void {
  splitting.value = { row, split: splitOf(row) }
  splitOpen.value = true
}

const dismissedTabMissing = computed(() => state.choice?.source === 'google' && (state.snapshot?.meta.missingTabs.includes('dismissed') ?? false))
const dismissedHeaders = TEMPLATE_COLUMNS.dismissed.map((column) => column.name).join(', ')

/** A dismissal waiting for the person to agree that the Sheet gets a dismissed tab. */
const asking = ref<{ readonly kind: SuggestionKind; readonly group: CoverageGroup<Transaction> } | null>(null)
const askingOpen = computed({
  get: () => asking.value !== null,
  set: (opened: boolean) => {
    if (!opened) asking.value = null
  },
})

async function writeDismissal(kind: SuggestionKind, group: CoverageGroup<Transaction>, addTab: boolean): Promise<void> {
  const written = await dismissWrites.write(
    { added: [dismissalCells(kind, group, today())], changed: [], removed: [] },
    { title: `Dismissed ${group.name || 'the rows with no counterparty'}` },
    'Not dismissed',
    addTab,
  )
  if (written) asking.value = null
}

function dismiss(kind: SuggestionKind, group: CoverageGroup<Transaction>): void {
  if (dismissedTabMissing.value) {
    asking.value = { kind, group }
    return
  }
  void writeDismissal(kind, group, false)
}

function restore(dismissal: Dismissal): void {
  const row = state.snapshot?.dismissed.find((candidate) => candidate.sheetRow === dismissal.sheetRow)
  if (row === undefined) return
  void dismissWrites.write(
    { added: [], changed: [], removed: [{ sheetRow: row.sheetRow, cells: rowCellsOf(row, DISMISSED_ROWS.columns) }] },
    { title: 'Suggestion restored' },
    'Not restored',
  )
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

              <UEmpty
                v-if="queue.length === 0 && unaccounted.length === 0"
                icon="i-lucide-check-check"
                title="Nothing waits for review"
                description="Every row in view has a category a rule or a person set."
                variant="outline"
                class="rounded-card bg-raised"
              />
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
                    :key="entry.transaction.sheetRow"
                    :transaction="entry.transaction"
                    :verdict="entry.verdict"
                    :categories="ledger.workbook.categories"
                    :expanded="expandedRow === entry.transaction.sheetRow"
                    :link="entry.link"
                    :split="splitOf(entry.transaction) !== null"
                    :busy="busy"
                    @toggle="toggle(entry.transaction.sheetRow)"
                    @confirm="confirm(entry.transaction)"
                    @recategorise="recategorise(entry.transaction, $event)"
                    @make-rule="makeRule(entry.transaction)"
                    @split="openSplit(entry.transaction)"
                  />
                </ul>
              </AppCard>

              <AppCard
                v-if="unaccounted.length > 0"
                :title="`${unaccounted.length} ${unaccounted.length === 1 ? 'reimbursement' : 'reimbursements'} with no cost on file`"
                collapse-id="review.unaccounted"
                :summary="unaccountedSummary"
                data-testid="review-unaccounted"
              >
                <template #subtitle>
                  Paid to the owner on a reimbursement category, with no cost on the owner-advances tab to repay. Net owed counts each as paid to the owner until its
                  cost is added.
                </template>
                <div class="px-4 pt-1 pb-2 sm:px-5">
                  <UnaccountedReimbursements :payments="unaccounted" :editable="!busy" @add-cost="addCost" />
                </div>
              </AppCard>

              <SessionChanges
                :writes="sessionWrites"
                :transactions="state.workbook?.transactions ?? []"
                :categories="ledger.workbook.categories"
                :busy="busy"
                @undo="undoSessionWrite"
              />

              <SplitDialog v-if="splitting" v-model:open="splitOpen" :row="splitting.row" :split="splitting.split" :categories="ledger.workbook.categories" />
              <AddAdvanceDialog
                v-if="newestBooking"
                v-model:open="addingCost"
                :categories="ledger.workbook.categories"
                :default-date="newestBooking"
                :prefill="costPrefill"
              />
            </template>
          </LedgerGate>
        </div>
      </template>

      <template #rules>
        <div v-if="state.workbook" class="flex flex-col gap-6">
          <RulesTab />
          <RuleCoverage
            :coverage="coverage.coverage"
            :categories="state.workbook.categories"
            :busy="busy"
            :dismissed-count="hiddenGroups"
            @make-rule="makeRuleForGroup"
            @dismiss="dismiss"
          />
          <DismissedSuggestions v-if="coverage.dismissed.length" :dismissed="coverage.dismissed" :categories="state.workbook.categories" :busy="busy" @restore="restore" />
        </div>
      </template>
    </PageTabs>

    <RuleEditor v-model:open="editorOpen" :source="editorSource" />
    <UModal
      v-model:open="askingOpen"
      title="Dismiss and add the dismissed tab"
      :description="asking ? `${asking.group.name || 'The rows with no counterparty'} stays hidden as new rows join it, until you restore it.` : ''"
      :fullscreen="phone"
      :ui="{ header: 'pe-16 sm:pe-6' }"
    >
      <template #body>
        <AddTabNotice tab="dismissed" :headers="dismissedHeaders" />
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton label="Cancel" color="neutral" variant="ghost" :disabled="dismissWrites.busy.value" @click="asking = null" />
          <UButton
            label="Add the tab and dismiss"
            icon="i-lucide-eye-off"
            :loading="dismissWrites.busy.value"
            :disabled="dismissWrites.busy.value"
            data-testid="dismiss-add-tab"
            @click="asking && writeDismissal(asking.kind, asking.group, true)"
          />
        </div>
      </template>
    </UModal>
  </section>
</template>
