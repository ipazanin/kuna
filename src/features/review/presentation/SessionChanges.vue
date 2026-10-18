<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { civilDateFromSerial } from '../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../shared/calendar/civilDate'
import { moneyFromAmount, negateMoney } from '../../../shared/money/money'
import type { Money } from '../../../shared/money/money'
import MoneyText from '../../../shared/ui/MoneyText.vue'
import { cellText } from '../../../shared/text/cellText'
import { rulesChangeInWords } from '../../rules/domain/ruleSummary'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { canUndo, isUndo, wasUndone } from '../../workbook/application/workbookStore'
import type { SessionWrite } from '../../workbook/application/workbookStore'
import type { BucketChange, OwnerAdvanceReceipt } from '../../workbook/application/writePlans'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket, DefinedBucket } from '../../workbook/domain/bucket'
import { isSameLedgerRow, ledgerRowKeyOf } from '../../workbook/domain/ledgerRowKey'
import type { LedgerRowKey } from '../../workbook/domain/ledgerRowKey'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import type { LedgerVerdictChange, VerdictReceipt } from '../domain/verdictChanges'

/** Every write this page made to the workbook, newest first, with Undo on each one that can still be put back. */
const props = defineProps<{
  writes: readonly SessionWrite[]
  transactions: readonly Transaction[]
  categories: readonly Category[]
  bucketLabels: Readonly<Record<DefinedBucket, string>>
  busy: boolean
}>()

const emit = defineEmits<{
  undo: [write: SessionWrite]
}>()

const names = useDisplayNames()

const SHOWN_ROWS = 3

const open = ref(false)

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

function bucketsTitle(changes: readonly BucketChange[], undid: readonly BucketChange[] | null): string {
  if (undid !== null) {
    return 'Undid a bucket change'
  }
  const targets = new Set(changes.map((change) => change.bucket))
  const [only] = targets
  return targets.size === 1 && only !== undefined
    ? `Moved ${changes.length === 1 ? 'a category' : `${changes.length} categories`} to ${props.bucketLabels[only]}`
    : `Changed the bucket of ${changes.length} categories`
}

function titleOf(write: SessionWrite): string {
  switch (write.kind) {
    case 'ledger':
      return ledgerTitle(write.receipt.changes, write.undid)
    case 'rules':
      return rulesChangeInWords(write.change)
    case 'settings':
      return write.changes.length === 1 ? `Set ${write.changes[0]!.key}` : `Changed ${write.changes.length} settings`
    case 'owner-advance-added':
      return 'Added an owner advance'
    case 'owner-advance-removed':
      return 'Undid an owner advance'
    case 'buckets':
      return bucketsTitle(write.changes, write.undid)
  }
}

const ICONS: Readonly<Record<SessionWrite['kind'], string>> = {
  ledger: 'i-lucide-tag',
  rules: 'i-lucide-list-ordered',
  settings: 'i-lucide-sliders-horizontal',
  'owner-advance-added': 'i-lucide-wallet',
  'owner-advance-removed': 'i-lucide-undo-2',
  buckets: 'i-lucide-layers',
}

function iconOf(write: SessionWrite): string {
  return isUndo(write) ? 'i-lucide-undo-2' : ICONS[write.kind]
}

/** An advance as its receipt wrote it: the date as a serial number and the amount as a positive decimal. */
function advanceOf(receipt: OwnerAdvanceReceipt): { readonly date: CivilDate; readonly cost: Money; readonly category: string; readonly description: string } {
  return {
    date: civilDateFromSerial(Number(receipt.cells.date)),
    cost: negateMoney(moneyFromAmount(Number(receipt.cells.amount))),
    category: cellText(receipt.cells.category),
    description: cellText(receipt.cells.description),
  }
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
  <section v-if="writes.length" class="min-w-0 overflow-clip rounded-card border border-default bg-raised shadow-raised" data-testid="session-changes">
    <button type="button" class="session-toggle" :aria-expanded="open" aria-controls="session-changes-list" data-testid="session-toggle" @click="open = !open">
      <span class="flex min-w-0 items-center gap-2">
        <UIcon name="i-lucide-history" class="size-4 shrink-0 text-muted" aria-hidden="true" />
        <span class="text-sm font-medium text-highlighted">Changes in this session</span>
        <UBadge :label="String(writes.length)" color="neutral" variant="subtle" size="sm" class="figure" data-testid="session-count" />
      </span>
      <UIcon name="i-lucide-chevron-down" class="chevron size-4 shrink-0 text-muted" :class="{ turned: open }" aria-hidden="true" />
    </button>

    <div v-if="open" id="session-changes-list" class="border-t border-default">
      <p class="px-4 pt-3 text-xs text-muted sm:px-5">Newest first. Kept until the page reloads. Undo puts back what the workbook held, if nothing changed it since. Rules and settings are changed back on Workbook.</p>
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
          <ul v-else-if="write.kind === 'owner-advance-added' || write.kind === 'owner-advance-removed'" class="detail-list">
            <li class="flex flex-col gap-1">
              <span class="flex min-w-0 items-baseline justify-between gap-3 text-xs">
                <span class="min-w-0 truncate text-toned">{{ advanceOf(write.receipt).description || 'Paid by the owner' }}</span>
                <span class="figure shrink-0 text-muted">{{ dayFormat.format(new Date(advanceOf(write.receipt).date)) }}, <MoneyText :cents="advanceOf(write.receipt).cost" tone="flow" /></span>
              </span>
              <span class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
                <CategoryChip :category="advanceOf(write.receipt).category" :bucket="bucketOf(advanceOf(write.receipt).category)" />
                <span>row {{ write.receipt.sheetRow }} of owner-advances</span>
              </span>
            </li>
          </ul>
          <ul v-else-if="write.kind === 'buckets'" class="detail-list">
            <li v-for="change in write.changes" :key="change.category" class="text-xs text-muted">
              <span class="text-toned">{{ names.category(change.category) }}</span> from {{ bucketLabels[change.expected] }} to {{ bucketLabels[change.bucket] }}
            </li>
          </ul>
        </li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.session-toggle {
  display: flex;
  width: 100%;
  min-height: 3rem;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 1rem;
  text-align: start;
}

.session-toggle:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.chevron {
  transition: transform 160ms ease;
}

.chevron.turned {
  transform: rotate(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .chevron {
    transition: none;
  }
}

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
  .session-toggle,
  .session-write {
    padding-inline: 1.25rem;
  }
}
</style>
