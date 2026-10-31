<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dateFormat } from '../../../../shared/calendar/dateFormat'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import AppCard from '../../../../shared/ui/AppCard.vue'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import CategoryChip from './CategoryChip.vue'
import { canUndo, isUndo, wasUndone } from '../../../../shared/storage/application/createWorkbookStore'
import type { SessionWrite } from '../../../../shared/storage/application/createWorkbookStore'
import type { WriteReceipt, WrittenRecord } from '../../../../shared/storage/application/recordWrites'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import { LEDGER_RECORDS } from '../../workbook/domain/coreKinds'
import type { LedgerEntry } from '../../workbook/domain/ledgerReading'
import type { Category } from '../../workbook/domain/workbook'
import { recordsChangeInWords } from '../../../../shared/storage/presentation/recordsChangeInWords'
import { words as storageWords } from '../../../../shared/storage/presentation/words'
import { plural } from '../../../../shared/text/translation'
import { words } from './words'

/** Every write this page made to the workbook, newest first, with Undo on each one that can still be put back. */
const props = defineProps<{
  writes: readonly SessionWrite[]
  categories: readonly Category[]
  busy: boolean
}>()

const emit = defineEmits<{
  undo: [write: SessionWrite]
}>()

const SHOWN_ROWS = 3

const timeFormat = dateFormat({ hour: '2-digit', minute: '2-digit', second: '2-digit' })

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

/** A ledger row's verdict as one change of a write gave it: the row before and after. */
interface VerdictChange {
  readonly before: LedgerEntry
  readonly after: LedgerEntry
}

/** The verdicts a write changed, or null for a write that did anything else. */
function verdictsOf(receipt: WriteReceipt): VerdictChange[] | null {
  const verdicts = receipt.records.flatMap(({ change }) =>
    change.kind.name === LEDGER_RECORDS.name && change.verb === 'change' ? [{ before: change.before as LedgerEntry, after: change.after as LedgerEntry }] : [],
  )
  return verdicts.length === receipt.records.length && verdicts.length > 0 ? verdicts : null
}

function verdictsTitle(verdicts: readonly VerdictChange[], undid: WriteReceipt | null): string {
  const count = verdicts.length
  if (undid !== null) {
    return count === 1 ? words.review.session.undidOne : plural(words.review.session.undidRows(count), count)
  }
  if (verdicts.every((verdict) => verdict.after.flaggedBy === 'rule')) {
    return plural(words.review.session.filedByRule(count), count)
  }
  const [only] = verdicts
  if (count === 1 && only !== undefined) {
    return only.before.category === only.after.category ? words.review.session.confirmedRow : words.review.session.recategorisedRow
  }
  return plural(words.review.session.changedRows(count), count)
}

function titleOf(write: SessionWrite): string {
  const verdicts = verdictsOf(write.receipt)
  return verdicts === null ? recordsChangeInWords(write.receipt, write.undid) : verdictsTitle(verdicts, write.undid)
}

function iconOf(write: SessionWrite): string {
  if (isUndo(write)) return 'i-lucide-undo-2'
  return verdictsOf(write.receipt) === null ? 'i-lucide-table-properties' : 'i-lucide-tag'
}

const VERBS: Readonly<Record<WrittenRecord['change']['verb'], string>> = words.review.session.verbs

function flaggedByInWords(flaggedBy: string): string {
  return flaggedBy === '' ? words.review.session.flaggedByNobody : words.review.session.flaggedBy(flaggedBy)
}
</script>

<template>
  <AppCard
    v-if="writes.length"
    class="overflow-clip"
    :title="words.review.session.title"
    collapse-id="review.session-changes"
    :summary="words.review.session.newest(titleOf(writes[0]!))"
    start-collapsed
    data-testid="session-changes"
  >
    <template #title>
      <UIcon name="i-lucide-history" class="size-4 shrink-0 text-muted" aria-hidden="true" />
      {{ words.review.session.title }}
      <UBadge :label="String(writes.length)" color="neutral" variant="subtle" size="sm" class="figure" data-testid="session-count" />
    </template>
    <div class="mt-3 border-t border-default">
      <p class="px-4 pt-3 text-xs text-muted sm:px-5">
        {{ words.review.session.about }}
      </p>
      <ol class="mt-2">
        <li v-for="write in writes" :key="write.id" class="session-write" data-testid="session-write">
          <span class="flex items-start justify-between gap-3">
            <span class="flex min-w-0 items-start gap-2">
              <UIcon :name="iconOf(write)" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
              <span class="min-w-0">
                <span class="block text-sm text-highlighted">{{ titleOf(write) }}</span>
                <time :datetime="write.at" class="figure text-xs text-muted">{{ timeFormat(new Date(write.at)) }}</time>
              </span>
            </span>
            <UBadge v-if="wasUndone(write, writes)" :label="storageWords.undone" color="neutral" variant="outline" size="sm" class="shrink-0" />
            <UButton
              v-else-if="canUndo(write, writes)"
              :label="storageWords.undo"
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

          <ul v-if="verdictsOf(write.receipt) !== null" class="detail-list">
            <li v-for="verdict in verdictsOf(write.receipt)!.slice(0, SHOWN_ROWS)" :key="verdict.after.id" class="flex flex-col gap-1">
              <span class="flex min-w-0 items-baseline justify-between gap-3 text-xs">
                <span class="min-w-0 truncate text-toned">{{ verdict.after.counterparty || words.noCounterparty }}</span>
                <span class="figure shrink-0 text-muted">{{ dayLabel(verdict.after.date) }}, <MoneyText :cents="verdict.after.amount" tone="flow" /></span>
              </span>
              <span class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
                <span class="verdict">
                  <CategoryChip :category="verdict.before.category" :bucket="bucketOf(verdict.before.category)" />
                  <span>{{ flaggedByInWords(verdict.before.flaggedBy) }}</span>
                </span>
                <UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0" :aria-label="words.review.session.became" />
                <span class="verdict">
                  <CategoryChip :category="verdict.after.category" :bucket="bucketOf(verdict.after.category)" />
                  <span>{{ flaggedByInWords(verdict.after.flaggedBy) }}</span>
                </span>
              </span>
            </li>
            <li v-if="write.receipt.records.length > SHOWN_ROWS" class="text-xs text-muted">
              {{ plural(words.review.session.moreRows(write.receipt.records.length - SHOWN_ROWS), write.receipt.records.length - SHOWN_ROWS) }}
            </li>
          </ul>
          <ul v-else class="detail-list">
            <li v-for="(record, index) in write.receipt.records.slice(0, SHOWN_ROWS)" :key="`record-${index}`" class="text-xs text-muted">
              {{ VERBS[record.change.verb] }} <span class="text-toned">{{ record.label }}</span
              >{{ words.review.session.recordNoun(record.change.kind.noun) }}
            </li>
            <li v-if="write.receipt.records.length > SHOWN_ROWS" class="text-xs text-muted">{{ words.review.session.more(write.receipt.records.length - SHOWN_ROWS) }}</li>
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
