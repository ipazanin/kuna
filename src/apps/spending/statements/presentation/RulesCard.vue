<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { deleteRule } from '../application/statementWrites'
import { ruleTestOf } from './ruleTest'
import { words } from './words'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { SpendingRule } from '../../workbook/domain/spendingRule'
import { words as spendingWords } from '../../words'
import { useRecordWrites } from '../../../../shared/storage/presentation/useRecordWrites'
import AppCard from '../../../../shared/ui/AppCard.vue'
import EmptyState from '../../../../shared/ui/EmptyState.vue'

/** Spending's rules in the order they are tried, each with Delete, which sends the rows it filed to the rules left or back to review. */
const store = useSpendingBooks()
const writes = useRecordWrites(store)

const rules = computed(() => {
  const book = store.state.workbook
  if (book === null) return []
  const categories = new Map(book.categories.map((category) => [category.id, category.name]))
  return book.rules.map((rule) => ({ rule, tests: ruleTestOf(rule.condition), category: categories.get(rule.category) ?? '' }))
})

async function remove(rule: SpendingRule): Promise<void> {
  const book = store.state.workbook
  if (book !== null) await writes.write(words.rules.deleted, (unit) => deleteRule(unit, book, rule), { key: `delete-${rule.id}`, failedTitle: spendingWords.form.notDeleted })
}
</script>

<template>
  <EmptyState v-if="rules.length === 0" icon="i-lucide-list-ordered" :title="words.rules.empty" :description="words.rules.emptyDescription" data-testid="spending-rules-empty" />
  <AppCard v-else :title="words.rules.title" :subtitle="words.rules.subtitle" data-testid="spending-rules">
    <ul class="divide-y divide-default pt-1 pb-1">
      <li v-for="{ rule, tests, category } in rules" :key="rule.id" class="flex items-center gap-3 px-4 py-2 sm:px-5" data-testid="spending-rule">
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="break-words text-sm text-highlighted">{{ tests }}</span>
          <span class="break-words type-caption">{{ category }}</span>
        </span>
        <UButton
          icon="i-lucide-trash-2"
          color="neutral"
          variant="ghost"
          class="size-11 shrink-0 justify-center"
          :aria-label="words.rules.delete(tests)"
          :loading="writes.saving(`delete-${rule.id}`)"
          data-testid="spending-rule-delete"
          @click="remove(rule)"
        />
      </li>
    </ul>
  </AppCard>
</template>
