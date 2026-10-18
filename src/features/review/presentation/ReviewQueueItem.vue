<script setup lang="ts">
import { computed, ref } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import MoneyText from '../../../shared/ui/MoneyText.vue'
import type { Verdict } from '../../rules/domain/categorise'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import CategoryPicker from '../../transactions/presentation/CategoryPicker.vue'
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Category, Transaction, TransactionSignals } from '../../workbook/domain/workbook'

/** One row waiting for review: what it is, what the rules say about it now, and what a person can do. */
const props = defineProps<{
  transaction: Transaction
  /** What the rules on the tab would file it as today. */
  verdict: Verdict
  categories: readonly Category[]
  expanded: boolean
  /** A link to the row in the Sheet, or null in Excel mode or before the tab's id is known. */
  link: string | null
  busy: boolean
}>()

const emit = defineEmits<{
  toggle: []
  confirm: []
  recategorise: [category: string]
  makeRule: []
}>()

const names = useDisplayNames()

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const SIGNAL_LABELS: Readonly<Record<keyof TransactionSignals, string>> = {
  purpose: 'Purpose code',
  txDomain: 'Bank domain code',
  txFamily: 'Bank family code',
  txSubFamily: 'Bank sub-family code',
  creditorReference: 'Creditor reference',
  instructedCurrency: 'Instructed currency',
}

const signals = computed(() =>
  (Object.keys(SIGNAL_LABELS) as (keyof TransactionSignals)[])
    .filter((field) => props.transaction.signals[field] !== '')
    .map((field) => ({ label: SIGNAL_LABELS[field], value: props.transaction.signals[field] })),
)

const reasons = computed(() => [
  ...(props.transaction.bucket === UNCLASSIFIED ? [{ label: 'Unclassified', color: 'warning' as const }] : []),
  ...(props.transaction.flaggedBy === 'ai' ? [{ label: 'AI guess', color: 'info' as const }] : []),
  ...props.transaction.reviewReasons.map((reason) => ({ label: reason.charAt(0).toUpperCase() + reason.slice(1), color: 'warning' as const })),
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
        <span class="min-w-0 truncate font-medium text-highlighted">{{ transaction.counterparty || 'No counterparty' }}</span>
        <MoneyText :cents="transaction.amount" tone="flow" class="shrink-0 font-medium" />
      </span>
      <span class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 text-xs text-muted">
        <span class="flex min-w-0 flex-wrap items-center gap-1.5">
          <CategoryChip :category="transaction.category" :bucket="transaction.bucket" />
          <UBadge v-for="reason in reasons" :key="reason.label" :label="reason.label" :color="reason.color" variant="subtle" size="sm" />
        </span>
        <span class="figure shrink-0">{{ dayFormat.format(new Date(transaction.date)) }}, {{ names.account(transaction.account) }}</span>
      </span>
    </button>

    <div v-if="expanded" class="queue-details" data-testid="review-details">
      <p v-if="transaction.description" class="text-sm text-toned">{{ transaction.description }}</p>

      <dl class="facts">
        <div>
          <dt>The rules say</dt>
          <dd class="flex flex-wrap items-center gap-1.5">
            <CategoryChip :category="verdict.category" :bucket="bucketOf(verdict.category)" />
            <span v-if="verdict.ruleId" class="text-xs text-muted">
              by <span class="identifier">{{ verdict.ruleId }}</span>{{ verdict.flaggedBy === 'ai' ? ', which sends it to review' : '' }}
            </span>
            <span v-else class="text-xs text-muted">No rule decides it</span>
          </dd>
        </div>
        <div v-if="transaction.counterpartyIban">
          <dt>Counterparty IBAN</dt>
          <dd class="identifier break-all">{{ transaction.counterpartyIban }}</dd>
        </div>
        <div v-for="signal in signals" :key="signal.label">
          <dt>{{ signal.label }}</dt>
          <dd class="identifier break-all">{{ signal.value }}</dd>
        </div>
        <div v-if="transaction.reviewReasons.length">
          <dt>Why the statement asks</dt>
          <dd>{{ transaction.reviewReasons.join(', ') }}</dd>
        </div>
      </dl>

      <a v-if="link" :href="link" target="_blank" rel="noopener noreferrer" class="sheet-link inline-target inline-flex items-center gap-1 text-sm text-toned">
        Row {{ transaction.sheetRow }} in the Sheet
        <UIcon name="i-lucide-external-link" class="size-3.5" aria-hidden="true" />
        <span class="sr-only">(opens the Google Sheet in a new tab)</span>
      </a>

      <p v-if="!confirmable" class="text-xs text-muted">
        Its category is not on the categories tab, so it cannot be confirmed as it is. Recategorise it, and the toast offers to make a rule
        from it.
      </p>
      <div class="flex flex-wrap items-center gap-2 pt-1">
        <UButton
          v-if="confirmable"
          :label="`Confirm ${names.category(transaction.category)}`"
          icon="i-lucide-check"
          size="sm"
          :disabled="busy"
          data-testid="confirm-row"
          @click="emit('confirm')"
        />
        <CategoryPicker
          v-model="picked"
          :categories="categories"
          placeholder="Recategorise"
          :disabled="busy"
          size="sm"
          data-testid="recategorise-row"
          @update:model-value="recategorise"
        />
        <UButton
          v-if="confirmable"
          label="Make this a rule"
          icon="i-lucide-list-plus"
          color="neutral"
          variant="outline"
          size="sm"
          :disabled="busy"
          data-testid="make-rule"
          @click="emit('makeRule')"
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

.sheet-link {
  width: fit-content;
  text-decoration-line: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: text-decoration-color 120ms ease;
}

.sheet-link:hover {
  color: var(--ink-strong);
  text-decoration-color: var(--accent);
}
</style>
