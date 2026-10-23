<script setup lang="ts">
import { useDisplayNames } from '../../workbook/application/useDisplayNames'
import type { Bucket } from '../../workbook/domain/bucket'
import { useCategoryColours } from '../../workbook/presentation/categoryColours'

/** A category as rows and groups show it: its colour, or its bucket's, and its name. */
defineProps<{
  /** Empty for a row with no category. */
  category: string
  bucket: Bucket
}>()

const names = useDisplayNames()
const colours = useCategoryColours()
</script>

<template>
  <span class="category-chip" :class="{ uncategorised: category === '' }">
    <span class="size-2 shrink-0 rounded-[2px]" :style="{ background: colours(category, bucket) }" aria-hidden="true" />
    <span class="truncate">{{ category === '' ? 'No category' : names.category(category) }}</span>
  </span>
</template>

<style scoped>
.category-chip {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.375rem;
  padding: 0.1875rem 0.625rem;
  border: 1px solid var(--border-default);
  border-radius: 999px;
  background: var(--surface-elevated);
  font-size: 0.75rem;
  color: var(--ink-secondary);
}

.category-chip.uncategorised {
  color: var(--ink-muted);
}
</style>
