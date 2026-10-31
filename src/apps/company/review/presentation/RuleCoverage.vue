<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import AppCard from '../../../../shared/ui/AppCard.vue'
import type { CoverageGroup, RuleCoverage } from '../../rules/domain/ruleCoverage'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import type { SuggestionKind } from '../../workbook/domain/dismissals'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import { plural } from '../../../../shared/text/translation'
import { words as transactionWords } from '../../transactions/presentation/words'
import { words } from './words'

/**
 * Rows a person filed that the rules would not file the same way, by counterparty. Rows no rule
 * settles may want a rule. Rows a rule settles in another category are exceptions to that rule,
 * and a new rule for them would file the rule's other rows wrongly. A group the person dismissed
 * is left out before it gets here.
 */
const props = defineProps<{
  coverage: RuleCoverage<Transaction>
  categories: readonly Category[]
  busy: boolean
  /** How many of the groups the dismissed tab hides, for the summary. */
  dismissedCount: number
}>()

const emit = defineEmits<{
  makeRule: [group: CoverageGroup<Transaction>]
  dismiss: [kind: SuggestionKind, group: CoverageGroup<Transaction>]
}>()

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

const groupCount = computed(() => props.coverage.notCovered.length + props.coverage.exceptions.length)
const summary = computed(() => words.coverage.summary(groupCount.value, props.dismissedCount))

const rowCount = computed(() => [...props.coverage.notCovered, ...props.coverage.exceptions].reduce((total, group) => total + group.rows.length, 0))

function rowsInWords(count: number): string {
  return plural(transactionWords.rows(count), count)
}
</script>

<template>
  <AppCard :title="words.coverage.title" collapse-id="review.no-rule-repeats" :summary="summary" start-collapsed data-testid="rule-coverage">
    <template #subtitle>
      <template v-if="rowCount">{{ plural(words.coverage.filedDifferently(rowCount), rowCount) }}</template>
      <template v-else-if="dismissedCount > 0">{{ words.coverage.allSameApartFromDismissed }}</template>
      <template v-else>{{ words.coverage.allSame }}</template>
    </template>

    <template v-if="coverage.notCovered.length">
      <header class="group-heading">
        <UIcon name="i-lucide-list-plus" class="size-4 shrink-0 self-center text-muted" aria-hidden="true" />
        <h3 class="text-sm font-medium text-highlighted">{{ words.coverage.notCovered }}</h3>
        <span class="figure text-sm text-muted">{{ coverage.notCovered.length }}</span>
        <p class="basis-full text-xs text-muted">{{ words.coverage.notCoveredHelp }}</p>
      </header>
      <ul class="border-t border-default" data-testid="coverage-not-covered">
        <li v-for="group in coverage.notCovered" :key="group.key" class="group-row" data-testid="coverage-gap">
          <div class="min-w-0">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium text-highlighted">{{ group.name || transactionWords.noCounterparty }}</span>
              <span class="figure text-xs text-muted">{{ rowsInWords(group.rows.length) }}</span>
              <UBadge v-if="group.categories.length > 1" :label="plural(words.coverage.categories(group.categories.length), group.categories.length)" color="warning" variant="subtle" size="sm" />
            </p>
            <p class="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <UIcon :name="group.iban ? 'i-lucide-landmark' : 'i-lucide-store'" class="size-3.5 shrink-0" aria-hidden="true" />
              <span v-if="group.iban" class="identifier break-all">{{ group.iban }}</span>
              <span v-else>{{ words.coverage.byName }}</span>
            </p>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              <li v-for="entry in group.categories" :key="entry.category" class="flex items-center gap-1">
                <CategoryChip :category="entry.category" :bucket="bucketOf(entry.category)" />
                <span v-if="group.categories.length > 1" class="figure text-xs text-muted">{{ entry.count }}</span>
              </li>
            </ul>
          </div>
          <div class="group-actions">
            <UButton
              :label="words.coverage.makeThisARule"
              icon="i-lucide-list-plus"
              color="neutral"
              variant="outline"
              size="sm"
              :disabled="busy"
              data-testid="coverage-make-rule"
              @click="emit('makeRule', group)"
            />
            <UButton
              :label="words.coverage.dismiss"
              icon="i-lucide-eye-off"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="words.coverage.dismissName(group.name)"
              :disabled="busy"
              data-testid="coverage-dismiss"
              @click="emit('dismiss', 'not-covered', group)"
            />
          </div>
        </li>
      </ul>
    </template>

    <template v-if="coverage.exceptions.length">
      <header class="group-heading">
        <UIcon name="i-lucide-split" class="size-4 shrink-0 self-center text-warning" aria-hidden="true" />
        <h3 class="text-sm font-medium text-highlighted">{{ words.coverage.exceptions }}</h3>
        <span class="figure text-sm text-muted">{{ coverage.exceptions.length }}</span>
        <p class="basis-full text-xs text-muted">{{ words.coverage.exceptionsHelp }}</p>
      </header>
      <ul class="border-t border-default" data-testid="coverage-exceptions">
        <li v-for="group in coverage.exceptions" :key="group.key" class="group-row" data-testid="coverage-exception">
          <div class="min-w-0">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium text-highlighted">{{ group.name || transactionWords.noCounterparty }}</span>
              <span class="figure text-xs text-muted">{{ rowsInWords(group.rows.length) }}</span>
            </p>
            <p v-if="group.iban" class="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-landmark" class="size-3.5 shrink-0" aria-hidden="true" />
              <span class="identifier break-all">{{ group.iban }}</span>
            </p>
            <p class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>{{ words.coverage.personFiled }}</span>
              <span v-for="entry in group.categories" :key="entry.category" class="flex items-center gap-1">
                <CategoryChip :category="entry.category" :bucket="bucketOf(entry.category)" />
                <span v-if="group.categories.length > 1" class="figure">{{ entry.count }}</span>
              </span>
            </p>
            <p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span
                ><span class="identifier text-toned">{{ group.ruleId }}</span> {{ words.coverage.filesThemAs }}</span
              >
              <CategoryChip :category="group.ruleCategory" :bucket="bucketOf(group.ruleCategory)" />
            </p>
          </div>
          <div class="group-actions">
            <UButton
              :label="words.coverage.openRule"
              icon="i-lucide-list-ordered"
              color="neutral"
              variant="outline"
              size="sm"
              :to="{ path: '/company/review', query: { tab: 'rules', rule: group.ruleId } }"
              data-testid="coverage-open-rule"
            />
            <UButton
              :label="words.coverage.dismiss"
              icon="i-lucide-eye-off"
              color="neutral"
              variant="ghost"
              size="sm"
              :aria-label="words.coverage.dismissName(group.name)"
              :disabled="busy"
              data-testid="coverage-dismiss"
              @click="emit('dismiss', 'exception', group)"
            />
          </div>
        </li>
      </ul>
    </template>
    <div class="h-2" />
  </AppCard>
</template>

<style scoped>
.group-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.5rem;
  padding: 1rem 1rem 0.75rem;
}

.group-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
}

.group-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 0.5rem;
}

@media (min-width: 640px) {
  .group-actions {
    flex-shrink: 0;
    flex-wrap: nowrap;
  }
}

.group-row + .group-row {
  border-top: 1px solid var(--border-default);
}

@media (min-width: 640px) {
  .group-heading {
    padding-inline: 1.25rem;
  }

  .group-row {
    flex-wrap: nowrap;
    padding-inline: 1.25rem;
  }
}
</style>
