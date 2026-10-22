<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { cellText } from '../../../shared/text/cellText'
import { rulesChangeInWords } from '../../rules/domain/ruleSummary'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { canUndo, isUndo, wasUndone } from '../../workbook/application/workbookStore'
import type { SessionWrite } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import { isSameLedgerRow, ledgerRowKeyOf } from '../../workbook/domain/ledgerRowKey'
import type { LedgerRowKey } from '../../workbook/domain/ledgerRowKey'
import type { TabRowsReceipt } from '../../workbook/domain/rowChanges'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { changedCellsInWords, rowsChangeInWords } from '../../workbook/presentation/rowsInWords'
import type { LedgerVerdictChange, VerdictReceipt } from '../domain/verdictChanges'

/** Every write this page made to the workbook, newest first, with Undo on each one that can still be put back. */
const props = defineProps<{
  writes: readonly SessionWrite[]
  transactions: readonly Transaction[]
  categories: readonly Category[]
  busy: boolean
}>()

const emit = defineEmits<{
  undo: [write: SessionWrite]
}>()

const SHOWN_ROWS = 3

const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

function counterpartyOf(key: LedgerRowKey): string {
  const row = props.transactions.find((transaction) => isSameLedgerRow(key, ledgerRowKeyOf(transaction)))
  return row?.counterparty || 'No counterparty'
}

function rows(count: number): string {
  return `${count} ${count === 1 ? 'row' : 'rows'}`
}

function ledgerTitle(changes: readonly LedgerVerdictChange[], undid: VerdictReceipt | null): string {
  if (undid !== null) {
    return changes.length === 1 ? 'Undid a change' : `Undid a change to ${rows(changes.length)}`
  }
  if (changes.every((change) => change.to.flaggedBy === 'rule')) {
    return `Filed ${rows(changes.length)} by a rule`
  }
  const [only] = changes
  if (changes.length === 1 && only !== undefined) {
    return only.from.category.toLowerCase() === only.to.category.toLowerCase() ? 'Confirmed a row' : 'Recategorised a row'
  }
  return `Changed ${rows(changes.length)}`
}

function titleOf(write: SessionWrite): string {
  switch (write.kind) {
    case 'ledger':
      return ledgerTitle(write.receipt.changes, write.undid)
    case 'rules':
      return rulesChangeInWords(write.change)
    case 'settings':
      return write.changes.length === 1 ? `Set ${write.changes[0]!.key}` : `Changed ${write.changes.length} settings`
    case 'rows':
      return rowsChangeInWords(write.rules, write.receipt, write.undid)
  }
}

const ICONS: Readonly<Record<SessionWrite['kind'], string>> = {
  ledger: 'i-lucide-tag',
  rules: 'i-lucide-list-ordered',
  settings: 'i-lucide-sliders-horizontal',
  rows: 'i-lucide-table-properties',
}

function iconOf(write: SessionWrite): string {
  return isUndo(write) ? 'i-lucide-undo-2' : ICONS[write.kind]
}

/** The rows of a write beyond the ones listed: up to three added or deleted, and up to three changed. */
function rowsNotShown(receipt: TabRowsReceipt): number {
  return Math.max(0, receipt.added.length + receipt.removed.length - SHOWN_ROWS) + Math.max(0, receipt.changed.length - SHOWN_ROWS)
}

function flaggedByInWords(flaggedBy: string): string {
  return flaggedBy === '' ? 'flagged by nobody' : `by ${flaggedBy}`
}

function quoted(cell: string | number | boolean | null): string {
  const text = cellText(cell)
  return text === '' ? 'blank' : `"${text}"`
}
</script>

<template>
  <AppCard
    v-if="writes.length"
    class="overflow-clip"
    title="Changes in this session"
    collapse-id="review.session-changes"
    :summary="`The newest: ${titleOf(writes[0]!)}`"
    start-collapsed
    data-testid="session-changes"
  >
    <template #title>
      <UIcon name="i-lucide-history" class="size-4 shrink-0 text-muted" aria-hidden="true" />
      Changes in this session
      <UBadge :label="String(writes.length)" color="neutral" variant="subtle" size="sm" class="figure" data-testid="session-count" />
    </template>
    <div class="mt-3 border-t border-default">
      <p class="px-4 pt-3 text-xs text-muted sm:px-5">Newest first. Kept until the page reloads. Undo puts back what the workbook held, if nothing changed it since. Rules are changed back on the Rules tab, and settings on Settings.</p>
      <ol class="mt-2">
        <li v-for="write in writes" :key="write.id" class="session-write" data-testid="session-write">
          <span class="flex items-start justify-between gap-3">
            <span class="flex min-w-0 items-start gap-2">
              <UIcon :name="iconOf(write)" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span class="min-w-0">
                <span class="block text-sm text-highlighted">{{ titleOf(write) }}</span>
                <time :datetime="write.at" class="figure text-xs text-muted">{{ timeFormat.format(new Date(write.at)) }}</time>
              </span>
            </span>
            <UBadge v-if="wasUndone(write, writes)" label="Undone" color="neutral" variant="outline" size="sm" class="shrink-0" />
            <UButton
              v-else-if="canUndo(write, writes)"
              label="Undo"
              icon="i-lucide-undo-2"
              color="neutral"
              variant="outline"
              size="sm"
              class="shrink-0"
              :disabled="busy"
              data-testid="session-undo"
              @click="emit('undo', write)"
            />
          </span>

          <ul v-if="write.kind === 'ledger'" class="detail-list">
            <li v-for="change in write.receipt.changes.slice(0, SHOWN_ROWS)" :key="`${change.key.account}-${change.key.reference}-${change.key.date}-${change.key.amount}`" class="flex flex-col gap-1">
              <span class="flex min-w-0 items-baseline justify-between gap-3 text-xs">
                <span class="min-w-0 truncate text-toned">{{ counterpartyOf(change.key) }}</span>
                <span class="figure shrink-0 text-muted">{{ dayFormat.format(new Date(change.key.date)) }}, <MoneyText :cents="change.key.amount" tone="flow" /></span>
              </span>
              <span class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
                <span class="verdict">
                  <CategoryChip :category="change.from.category" :bucket="bucketOf(change.from.category)" />
                  <span>{{ flaggedByInWords(change.from.flaggedBy) }}</span>
                </span>
                <UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0" aria-label="became" />
                <span class="verdict">
                  <CategoryChip :category="change.to.category" :bucket="bucketOf(change.to.category)" />
                  <span>{{ flaggedByInWords(change.to.flaggedBy) }}</span>
                </span>
              </span>
            </li>
            <li v-if="write.receipt.changes.length > SHOWN_ROWS" class="text-xs text-muted">and {{ rows(write.receipt.changes.length - SHOWN_ROWS) }} more</li>
          </ul>
          <ul v-else-if="write.kind === 'settings'" class="detail-list">
            <li v-for="change in write.changes" :key="change.key" class="text-xs text-muted">
              <span class="identifier text-toned">{{ change.key }}</span> from {{ quoted(change.expected) }} to {{ quoted(change.value) }}
            </li>
          </ul>
          <ul v-else-if="write.kind === 'rows'" class="detail-list">
            <li v-for="row in [...write.receipt.added, ...write.receipt.removed].slice(0, SHOWN_ROWS)" :key="`row-${row.sheetRow}`" class="text-xs text-muted">
              <span class="text-toned">{{ write.rules.label(row.cells) }}</span>, row {{ row.sheetRow }} of {{ write.rules.tab }}
            </li>
            <li v-for="change in write.receipt.changed.slice(0, SHOWN_ROWS)" :key="`changed-${change.sheetRow}`" class="flex flex-col gap-1 text-xs text-muted">
              <span><span class="text-toned">{{ write.rules.label(change.after) }}</span>, row {{ change.sheetRow }} of {{ write.rules.tab }}</span>
              <span v-for="cell in changedCellsInWords(write.rules, change.before, change.after)" :key="cell.column">
                <span class="identifier text-toned">{{ cell.column }}</span> from {{ cell.from }} to {{ cell.to }}
              </span>
            </li>
            <li v-if="rowsNotShown(write.receipt) > 0" class="text-xs text-muted">and {{ rows(rowsNotShown(write.receipt)) }} more</li>
          </ul>
        </li>
      </ol>
    </div>
  </AppCard>
</template>

<style scoped>
.session-write {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}

.session-write + .session-write {
  border-top: 1px solid var(--border-default);
}

.verdict {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 0.375rem;
}

.detail-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-inline-start: 1.5rem;
}

@media (min-width: 640px) {
  .session-write {
    padding-inline: 1.25rem;
  }
}
</style>
