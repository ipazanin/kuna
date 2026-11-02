<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { words } from './words'
import { comparedSourceOf } from '../domain/comparedLine'
import InstrumentSearch from '../../holdings/presentation/InstrumentSearch.vue'
import type { SearchedListing } from '../../prices/application/symbolSearch'
import { useSymbolSearch } from '../../prices/presentation/useSymbolSearch'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import RemovableChip from '../../../../shared/ui/RemovableChip.vue'

/**
 * A chart's Compare with: the button that opens a search of the price sources, and once a ticker is picked, a chip that
 * names it and removes it, with a line while its closes are fetched or when they did not come.
 */
defineProps<{
  /** The symbol compared with, or null while nothing is. */
  symbol: string | null
  fetching: boolean
  /** Why the compared line is missing, or null when it is drawn. */
  note: string | null
}>()

const emit = defineEmits<{
  pick: [listing: SearchedListing]
  remove: []
}>()

const searchable = useSymbolSearch().canSearch()
const open = ref(false)

function pick(listing: SearchedListing): void {
  open.value = false
  emit('pick', listing)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="compare-with">
    <RemovableChip v-if="symbol !== null" :label="symbol" :remove-label="words.remove(symbol)" data-testid="compare-chip" @remove="emit('remove')" />
    <span v-if="symbol !== null && fetching" role="status" class="inline-flex items-center gap-1.5 type-caption" data-testid="compare-fetching">
      <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" aria-hidden="true" />
      {{ words.fetching }}
    </span>
    <span v-else-if="symbol !== null && note !== null" role="status" class="type-caption" data-testid="compare-note">{{ note }}</span>
    <UButton v-if="searchable" :label="words.button" icon="i-lucide-git-compare-arrows" color="neutral" variant="ghost" size="xs" class="text-muted" data-testid="compare-open" @click="open = true" />
    <AppDialog v-model:open="open" :title="words.button" :description="words.description">
      <InstrumentSearch :label="words.searchLabel" :help="words.searchHelp" :pickable="(listing) => comparedSourceOf(listing) !== null" @pick="pick" />
    </AppDialog>
  </div>
</template>
