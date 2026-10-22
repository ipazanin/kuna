<script setup lang="ts">
import { computed } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'

import AppCard from '../../../shared/ui/AppCard.vue'
import type { Dismissal } from '../../workbook/domain/dismissals'
import { UNCLASSIFIED } from '../../workbook/domain/bucket'
import type { Category, Transaction } from '../../workbook/domain/workbook'
import CategoryChip from '../../transactions/presentation/CategoryChip.vue'
import type { DismissedSuggestion } from '../domain/dismissedSuggestions'

/** The suggestions a person dismissed, collapsed, each with Restore, which takes its row off the dismissed tab. */
const props = defineProps<{
  dismissed: readonly DismissedSuggestion<Transaction>[]
  categories: readonly Category[]
  busy: boolean
}>()

const emit = defineEmits<{
  restore: [dismissal: Dismissal]
}>()

const KIND_LABELS: Readonly<Record<Dismissal['kind'], string>> = {
  'not-covered': 'No rule settles these',
  exception: 'A rule files these otherwise',
}

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

const bucketBySlug = computed(() => new Map(props.categories.map((category) => [category.slug, category.bucket])))

/** The group's name when its rows are still there, else what the key says: the IBAN, or the folded name, without an exception's rule. */
function nameOf(entry: DismissedSuggestion<Transaction>): string {
  if (entry.group !== null) return entry.group.name || 'No counterparty'
  const counterparty = entry.dismissal.kind === 'exception' ? entry.dismissal.key.replace(/\|[^|]*$/, '') : entry.dismissal.key
  return counterparty.replace(/^(iban|name):/, '') || 'No counterparty'
}

function rowsOf(entry: DismissedSuggestion<Transaction>): string {
  const count = entry.group?.rows.length ?? 0
  return count === 0 ? 'No such rows left' : `${count} ${count === 1 ? 'row' : 'rows'}`
}
</script>

<template>
  <AppCard
    :title="`Dismissed suggestions (${dismissed.length})`"
    subtitle="Groups you dismissed stay hidden as new rows join them. Restore one to see it in the list above again."
    collapse-id="review.dismissed"
    :summary="`${dismissed.length} ${dismissed.length === 1 ? 'group' : 'groups'} hidden from the list above`"
    start-collapsed
    data-testid="dismissed-suggestions"
  >
    <ul class="mt-3 border-t border-default">
      <li v-for="entry in dismissed" :key="entry.dismissal.id" class="dismissed-row" data-testid="dismissed-suggestion">
        <div class="min-w-0">
          <p class="flex flex-wrap items-baseline gap-x-2">
            <span class="font-medium break-words text-highlighted">{{ nameOf(entry) }}</span>
            <span class="figure text-xs text-muted">{{ rowsOf(entry) }}</span>
          </p>
          <p class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            <span>{{ KIND_LABELS[entry.dismissal.kind] }}</span>
            <CategoryChip v-if="entry.dismissal.category" :category="entry.dismissal.category" :bucket="bucketBySlug.get(entry.dismissal.category) ?? UNCLASSIFIED" />
            <span v-if="entry.dismissal.dismissedOn">dismissed on {{ dayFormat.format(new Date(entry.dismissal.dismissedOn)) }}</span>
          </p>
        </div>
        <UButton
          label="Restore"
          icon="i-lucide-eye"
          color="neutral"
          variant="outline"
          size="sm"
          class="self-start"
          :aria-label="`Restore ${nameOf(entry)}`"
          :disabled="busy"
          data-testid="restore-suggestion"
          @click="emit('restore', entry.dismissal)"
        />
      </li>
    </ul>
    <div class="h-2" />
  </AppCard>
</template>

<style scoped>
.dismissed-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.75rem 1rem;
  padding: 0.75rem 1rem;
}

.dismissed-row + .dismissed-row {
  border-top: 1px solid var(--border-default);
}

@media (min-width: 640px) {
  .dismissed-row {
    flex-wrap: nowrap;
    padding-inline: 1.25rem;
  }
}
</style>
