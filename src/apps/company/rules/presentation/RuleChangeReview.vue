<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UCheckbox from '@nuxt/ui/components/Checkbox.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { useWorkbook } from '../../workbook/application/workbookStore'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Transaction } from '../../workbook/domain/workbook'
import type { VerdictChange } from '../domain/backtestRule'
import type { RulesChangePreview } from '../domain/rulesChangePreview'
import { words as transactionWords } from '../../transactions/presentation/words'
import { words } from './words'

/**
 * What a rules change would do to the ledger, before it is saved: why it cannot be saved, the rows
 * it settles, the agreements it breaks and the confirmed rows it disagrees with. The last two need
 * an explicit yes.
 */
const props = defineProps<{
  preview: RulesChangePreview<Transaction>
}>()

const accepted = defineModel<boolean>('accepted', { required: true })

const SHOWN_ROWS = 6

const { state } = useWorkbook()
const names = useDisplayNames()
const bucketBySlug = computed(() => new Map((state.workbook?.categories ?? []).map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

const lists = computed(() => [
  {
    key: 'settled',
    title: words.backtest.settled.title,
    help: words.backtest.settled.help,
    fromLabel: words.backtest.settled.from,
    icon: 'i-lucide-check-check',
    tone: 'text-success',
    changes: props.preview.backtest.settled,
  },
  {
    key: 'broken',
    title: words.backtest.broken.title,
    help: words.backtest.broken.help,
    fromLabel: words.backtest.broken.from,
    icon: 'i-lucide-split',
    tone: 'text-warning',
    changes: props.preview.backtest.brokenAgreements,
  },
  {
    key: 'conflicts',
    title: words.backtest.conflicts.title,
    help: words.backtest.conflicts.help,
    fromLabel: words.backtest.conflicts.from,
    icon: 'i-lucide-user-x',
    tone: 'text-error',
    changes: props.preview.backtest.humanConflicts,
  },
])

const needsAcceptance = computed(() => props.preview.backtest.brokenAgreements.length + props.preview.backtest.humanConflicts.length > 0)

function shown(changes: readonly VerdictChange<Transaction>[]): readonly VerdictChange<Transaction>[] {
  return changes.slice(0, SHOWN_ROWS)
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="rule-backtest">
    <UAlert v-if="preview.refusals.length" icon="i-lucide-octagon-x" color="error" variant="subtle" :title="words.backtest.cannotSave" data-testid="rule-refusals">
      <template #description>
        <ul class="list-disc ps-4">
          <li v-for="refusal in preview.refusals" :key="refusal" class="break-words">{{ refusal }}</li>
        </ul>
      </template>
    </UAlert>

    <section v-for="list in lists" :key="list.key" class="flex flex-col gap-2" :data-testid="`backtest-${list.key}`">
      <header class="flex items-baseline gap-2">
        <UIcon :name="list.icon" class="size-4 shrink-0 self-center" :class="list.tone" aria-hidden="true" />
        <h3 class="text-sm font-medium text-highlighted">{{ list.title }}</h3>
        <span class="figure text-sm text-muted">{{ list.changes.length }}</span>
      </header>
      <p class="-mt-1 text-xs text-muted">{{ list.help }}</p>
      <ul v-if="list.changes.length" class="overflow-hidden rounded-control border border-default">
        <li v-for="change in shown(list.changes)" :key="change.transaction.id" class="backtest-row">
          <span class="flex min-w-0 items-baseline justify-between gap-3">
            <span class="min-w-0 truncate text-sm text-highlighted">{{ change.transaction.counterparty || transactionWords.noCounterparty }}</span>
            <MoneyText :cents="change.transaction.amount" tone="flow" class="shrink-0 text-sm" />
          </span>
          <span class="flex min-w-0 flex-wrap items-center gap-1.5 text-xs text-muted">
            <span class="figure">{{ dayLabel(change.transaction.date) }}</span>
            <span class="verdict-pair">
              <span>{{ list.fromLabel }}</span>
              <CategoryChip :category="change.from" :bucket="bucketOf(change.from)" />
              <UIcon name="i-lucide-arrow-right" class="size-3.5 shrink-0" :aria-label="words.backtest.becomes" />
              <span>{{ words.backtest.after }}</span>
              <CategoryChip :category="change.after.category" :bucket="bucketOf(change.after.category)" />
              <span v-if="change.after.flaggedBy === 'ai'" class="text-muted">{{ words.backtest.waitsForReview }}</span>
            </span>
          </span>
          <span v-if="change.from !== change.transaction.category" class="text-xs text-muted" data-testid="backtest-stored">{{
            words.backtest.storedAs(names.category(change.transaction.category))
          }}</span>
        </li>
        <li v-if="list.changes.length > SHOWN_ROWS" class="px-3 py-2 text-xs text-muted">{{ words.backtest.more(list.changes.length - SHOWN_ROWS) }}</li>
      </ul>
      <p v-else class="text-xs text-muted">{{ words.backtest.none }}</p>
    </section>

    <UCheckbox v-if="needsAcceptance && preview.refusals.length === 0" v-model="accepted" :label="words.backtest.accept" :description="words.backtest.acceptHelp" data-testid="accept-backtest" />
  </div>
</template>

<style scoped>
.backtest-row {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding: 0.5rem 0.75rem;
}

.verdict-pair {
  display: inline-flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem;
}

.backtest-row + .backtest-row,
.backtest-row + li {
  border-top: 1px solid var(--border-default);
}
</style>
