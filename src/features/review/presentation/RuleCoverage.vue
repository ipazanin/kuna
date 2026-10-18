<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { CoverageGap } from '../../rules/domain/ruleCoverage'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Category, Transaction } from '../../workbook/domain/workbook'

/** Counterparties a person filed by hand that no rule repeats yet, each a rule the workbook could have. */
const props = defineProps<{
  gaps: readonly CoverageGap<Transaction>[]
  categories: readonly Category[]
  busy: boolean
}>()

const emit = defineEmits<{
  makeRule: [gap: CoverageGap<Transaction>]
}>()

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))
const rowCount = computed(() => props.gaps.reduce((total, gap) => total + gap.rows.length, 0))
</script>

<template>
  <section class="min-w-0 rounded-card border border-default bg-raised shadow-raised" data-testid="rule-coverage">
    <header class="px-4 pt-4 sm:px-5">
      <h2 class="text-sm font-medium text-highlighted">Confirmed rows no rule repeats</h2>
      <p class="mt-0.5 text-xs text-muted">
        <template v-if="gaps.length">
          {{ rowCount }} {{ rowCount === 1 ? 'row' : 'rows' }} from {{ gaps.length }} {{ gaps.length === 1 ? 'counterparty' : 'counterparties' }} that a person filed. With a
          rule for each, the rules file the next one the same way.
        </template>
        <template v-else>Every row a person filed is one the rules would file the same way.</template>
      </p>
    </header>
    <ul v-if="gaps.length" class="mt-3 border-t border-default">
      <li v-for="gap in gaps" :key="gap.key" class="gap-row" data-testid="coverage-gap">
        <div class="min-w-0">
          <p class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-medium text-highlighted">{{ gap.name || 'No counterparty' }}</span>
            <span class="figure text-xs text-muted">{{ gap.rows.length }} {{ gap.rows.length === 1 ? 'row' : 'rows' }}</span>
          </p>
          <p class="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <UIcon :name="gap.iban ? 'i-lucide-landmark' : 'i-lucide-store'" class="size-3.5 shrink-0" aria-hidden="true" />
            <span v-if="gap.iban" class="identifier break-all">{{ gap.iban }}</span>
            <span v-else>Grouped by name, since the rows carry no IBAN</span>
          </p>
          <ul class="mt-2 flex flex-wrap gap-1.5">
            <li v-for="entry in gap.categories" :key="entry.category" class="flex items-center gap-1">
              <CategoryChip :category="entry.category" :bucket="bucketBySlug.get(entry.category) ?? UNCLASSIFIED" />
              <span v-if="gap.categories.length > 1" class="figure text-xs text-muted">{{ entry.count }}</span>
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
          @click="emit('makeRule', gap)"
        />
      </li>
    </ul>
    <div class="h-2" />
  </section>
</template>

<style scoped>
.gap-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
}

.gap-row + .gap-row {
  border-top: 1px solid var(--border-default);
}

@media (min-width: 640px) {
  .gap-row {
    flex-wrap: nowrap;
    padding-inline: 1.25rem;
  }
}
</style>
