<script setup lang="ts">
import { computed } from 'vue'
import UBadge from '@nuxt/ui/components/Badge.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CoverageGroup, RuleCoverage } from '../../rules/domain/ruleCoverage'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Bucket } from '../../workbook/domain/bucket'
import type { Category, Transaction } from '../../workbook/domain/workbook'

/**
 * Rows a person filed that the rules would not file the same way, by counterparty. Rows no rule
 * settles may want a rule. Rows a rule settles in another category are exceptions to that rule,
 * and a new rule for them would file the rule's other rows wrongly.
 */
const props = defineProps<{
  coverage: RuleCoverage<Transaction>
  categories: readonly Category[]
  busy: boolean
}>()

const emit = defineEmits<{
  makeRule: [group: CoverageGroup<Transaction>]
}>()

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

function bucketOf(category: string): Bucket {
  return bucketBySlug.value.get(category) ?? UNCLASSIFIED
}

const rowCount = computed(() => [...props.coverage.notCovered, ...props.coverage.exceptions].reduce((total, group) => total + group.rows.length, 0))

function rowsInWords(count: number): string {
  return `${count} ${count === 1 ? 'row' : 'rows'}`
}
</script>

<template>
  <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" data-testid="rule-coverage">
    <header class="px-4 pt-4 sm:px-5">
      <h2 class="text-sm font-medium text-highlighted">Confirmed rows no rule repeats</h2>
      <p class="mt-0.5 text-xs text-muted">
        <template v-if="rowCount">{{ rowsInWords(rowCount) }} a person filed that the rules would not file the same way.</template>
        <template v-else>Every row a person filed is one the rules would file the same way.</template>
      </p>
    </header>

    <template v-if="coverage.notCovered.length">
      <header class="group-heading">
        <UIcon name="i-lucide-list-plus" class="size-4 shrink-0 self-center text-muted" aria-hidden="true" />
        <h3 class="text-sm font-medium text-highlighted">Not covered</h3>
        <span class="figure text-sm text-muted">{{ coverage.notCovered.length }}</span>
        <p class="basis-full text-xs text-muted">No rule settles these. With a rule for each, the rules file the next one the same way.</p>
      </header>
      <ul class="border-t border-default" data-testid="coverage-not-covered">
        <li v-for="group in coverage.notCovered" :key="group.key" class="group-row" data-testid="coverage-gap">
          <div class="min-w-0">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium text-highlighted">{{ group.name || 'No counterparty' }}</span>
              <span class="figure text-xs text-muted">{{ rowsInWords(group.rows.length) }}</span>
              <UBadge v-if="group.categories.length > 1" :label="`${group.categories.length} categories`" color="warning" variant="subtle" size="sm" />
            </p>
            <p class="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <UIcon :name="group.iban ? 'i-lucide-landmark' : 'i-lucide-store'" class="size-3.5 shrink-0" aria-hidden="true" />
              <span v-if="group.iban" class="identifier break-all">{{ group.iban }}</span>
              <span v-else>Grouped by name, since the rows carry no IBAN</span>
            </p>
            <ul class="mt-2 flex flex-wrap gap-1.5">
              <li v-for="entry in group.categories" :key="entry.category" class="flex items-center gap-1">
                <CategoryChip :category="entry.category" :bucket="bucketOf(entry.category)" />
                <span v-if="group.categories.length > 1" class="figure text-xs text-muted">{{ entry.count }}</span>
              </li>
            </ul>
          </div>
          <UButton
            label="Make this a rule"
            icon="i-lucide-list-plus"
            color="neutral"
            variant="outline"
            size="sm"
            class="self-start"
            :disabled="busy"
            data-testid="coverage-make-rule"
            @click="emit('makeRule', group)"
          />
        </li>
      </ul>
    </template>

    <template v-if="coverage.exceptions.length">
      <header class="group-heading">
        <UIcon name="i-lucide-split" class="size-4 shrink-0 self-center text-[var(--tone-warning)]" aria-hidden="true" />
        <h3 class="text-sm font-medium text-highlighted">Exceptions</h3>
        <span class="figure text-sm text-muted">{{ coverage.exceptions.length }}</span>
        <p class="basis-full text-xs text-muted">
          A rule files these differently than the person did. A new rule would file that rule's other rows the same way, so these stay as filed.
        </p>
      </header>
      <ul class="border-t border-default" data-testid="coverage-exceptions">
        <li v-for="group in coverage.exceptions" :key="group.key" class="group-row" data-testid="coverage-exception">
          <div class="min-w-0">
            <p class="flex flex-wrap items-baseline gap-x-2">
              <span class="font-medium text-highlighted">{{ group.name || 'No counterparty' }}</span>
              <span class="figure text-xs text-muted">{{ rowsInWords(group.rows.length) }}</span>
            </p>
            <p v-if="group.iban" class="mt-0.5 flex items-center gap-1 text-xs text-muted">
              <UIcon name="i-lucide-landmark" class="size-3.5 shrink-0" aria-hidden="true" />
              <span class="identifier break-all">{{ group.iban }}</span>
            </p>
            <p class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>Person filed</span>
              <span v-for="entry in group.categories" :key="entry.category" class="flex items-center gap-1">
                <CategoryChip :category="entry.category" :bucket="bucketOf(entry.category)" />
                <span v-if="group.categories.length > 1" class="figure">{{ entry.count }}</span>
              </span>
            </p>
            <p class="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span><span class="identifier text-toned">{{ group.ruleId }}</span> files them as</span>
              <CategoryChip :category="group.ruleCategory" :bucket="bucketOf(group.ruleCategory)" />
            </p>
          </div>
          <UButton
            label="Open the rule"
            icon="i-lucide-list-ordered"
            color="neutral"
            variant="outline"
            size="sm"
            class="self-start"
            :to="{ path: '/workbook', query: { tab: 'rules', rule: group.ruleId } }"
            data-testid="coverage-open-rule"
          />
        </li>
      </ul>
    </template>
    <div class="h-2" />
  </section>
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
