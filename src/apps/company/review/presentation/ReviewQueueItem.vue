<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { capitalised } from '../../../../shared/text/capitalised'
import MoneyText from '../../../../shared/ui/MoneyText.vue'
import { reviewReasonLabel } from '../../imports/domain/camtStatement'
import type { Verdict } from '../../rules/domain/categorise'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import CategoryPicker from '../../transactions/presentation/CategoryPicker.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Category, Transaction, TransactionSignals } from '../../workbook/domain/workbook'
import { words as transactionWords } from '../../transactions/presentation/words'
import { words } from './words'

/** One row waiting for review: what it is, what the rules say about it now, and what a person can do. */
const props = defineProps<{
  transaction: Transaction
  /** What the rules on the tab would file it as today. */
  verdict: Verdict
  categories: readonly Category[]
  expanded: boolean
  /** True when the splits tab already splits the row, so Split edits its parts. */
  split: boolean
  busy: boolean
}>()

const emit = defineEmits<{
  toggle: []
  confirm: []
  recategorise: [category: string]
  makeRule: []
  split: []
}>()

const names = useDisplayNames()

const SIGNAL_LABELS: Readonly<Record<keyof TransactionSignals, string>> = words.item.signals

const signals = computed(() =>
  (Object.keys(SIGNAL_LABELS) as (keyof TransactionSignals)[])
    .filter((field) => props.transaction.signals[field] !== '')
    .map((field) => ({ label: SIGNAL_LABELS[field], value: props.transaction.signals[field] })),
)

const reasons = computed(() => [
  ...(props.transaction.bucket === UNCLASSIFIED ? [{ label: transactionWords.unclassified, color: 'warning' as const }] : []),
  ...(props.transaction.flaggedBy === 'ai' ? [{ label: transactionWords.aiGuess, color: 'info' as const }] : []),
  ...props.transaction.reviewReasons.map((reason) => ({ label: capitalised(reviewReasonLabel(reason)), color: 'warning' as const })),
])

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

const confirmable = computed(() => props.transaction.bucket !== UNCLASSIFIED)

const picked = ref<string | undefined>(undefined)

function recategorise(category: string | undefined): void {
  if (category !== undefined && category !== '') {
    emit('recategorise', category)
  }
  picked.value = undefined
}
</script>

<template>
  <li class="queue-item" data-testid="review-row">
    <button type="button" class="queue-summary" :aria-expanded="expanded" @click="emit('toggle')">
      <span class="flex items-baseline justify-between gap-3">
        <span class="min-w-0 truncate font-medium text-highlighted">{{ transaction.counterparty || transactionWords.noCounterparty }}</span>
        <MoneyText :cents="transaction.amount" tone="flow" class="shrink-0 font-medium" />
      </span>
      <span class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted">
        <span class="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryChip :category="transaction.category" :bucket="transaction.bucket" />
          <UBadge v-for="reason in reasons" :key="reason.label" :label="reason.label" :color="reason.color" variant="subtle" size="sm" />
        </span>
        <span class="figure shrink-0">{{ dayLabel(transaction.date) }}, {{ names.account(transaction.account) }}</span>
      </span>
    </button>

    <div v-if="expanded" class="queue-details" data-testid="review-details">
      <p v-if="transaction.description" class="text-sm text-toned">{{ transaction.description }}</p>

      <dl class="facts">
        <div>
          <dt>{{ words.item.rulesSay }}</dt>
          <dd class="flex flex-wrap items-center gap-1.5">
            <CategoryChip :category="verdict.category" :bucket="bucketOf(verdict.category)" />
            <span v-if="verdict.ruleId" class="text-xs text-muted">
              {{ words.item.by }} <span class="identifier">{{ verdict.ruleId }}</span
              >{{ verdict.flaggedBy === 'ai' ? words.item.sendsToReview : '' }}
            </span>
            <span v-else class="text-xs text-muted">{{ words.item.noRuleDecides }}</span>
          </dd>
        </div>
        <div v-if="transaction.counterpartyIban">
          <dt>{{ words.item.counterpartyIban }}</dt>
          <dd class="identifier break-all">{{ transaction.counterpartyIban }}</dd>
        </div>
        <div v-for="signal in signals" :key="signal.label">
          <dt>{{ signal.label }}</dt>
          <dd class="identifier break-all">{{ signal.value }}</dd>
        </div>
        <div v-if="transaction.reviewReasons.length">
          <dt>{{ words.item.statementAsks }}</dt>
          <dd>{{ transaction.reviewReasons.map(reviewReasonLabel).join(', ') }}</dd>
        </div>
      </dl>

      <p v-if="!confirmable" class="text-xs text-muted">{{ words.item.notConfirmable }}</p>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <UButton
          v-if="confirmable"
          :label="words.item.confirm(names.category(transaction.category))"
          icon="i-lucide-check"
          size="sm"
          :disabled="busy"
          data-testid="confirm-row"
          @click="emit('confirm')"
        />
        <CategoryPicker v-model="picked" :categories="categories" :placeholder="words.item.recategorise" :disabled="busy" size="sm" data-testid="recategorise-row" @update:model-value="recategorise" />
        <UButton
          v-if="confirmable"
          :label="words.item.makeThisARule"
          icon="i-lucide-list-plus"
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="busy"
          data-testid="make-rule"
          @click="emit('makeRule')"
        />
        <UButton
          v-if="transaction.amount !== 0"
          :label="split ? words.item.editSplit : words.item.split"
          :icon="split ? 'i-lucide-pencil' : 'i-lucide-split'"
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="busy"
          :data-testid="split ? 'edit-split' : 'split-row'"
          @click="emit('split')"
        />
      </div>
    </div>
  </li>
</template>

<style scoped>
.queue-item + .queue-item {
  border-top: 1px solid var(--border-default);
}

.queue-summary {
  display: flex;
  width: 100%;
  min-height: 4rem;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  text-align: start;
}

.queue-summary:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.queue-summary[aria-expanded='true'],
.queue-details {
  background: var(--surface-elevated);
}

.queue-details {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0 1rem 1rem;
}

.facts {
  display: grid;
  gap: 0.5rem 1.5rem;
}

.facts dt {
  font-size: 0.75rem;
  color: var(--ink-muted);
}

.facts dd {
  margin-top: 0.125rem;
  font-size: 0.875rem;
  color: var(--ink);
}

@media (min-width: 640px) {
  .queue-summary,
  .queue-details {
    padding-inline: 1.25rem;
  }

  .facts {
    grid-template-columns: repeat(auto-fill, minmax(14rem, 1fr));
  }
}
</style>
