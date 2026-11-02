<script setup lang="ts">
import { computed, ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UInput from '@nuxt/ui/components/Input.vue'

import type { SearchedListing, SymbolSearchResult } from '../../prices/application/symbolSearch'
import { useSymbolSearch } from '../../prices/presentation/useSymbolSearch'
import { words as pricesWords } from '../../prices/presentation/words'
import { listInWords } from '../../../../shared/text/listInWords'
import { words } from './words'

/**
 * A search of the price vendors for a listing, as a whole row of the instrument form or in Compare with. Picking one
 * hands it on, such as to the form to fill its fields.
 */
const props = withDefaults(
  defineProps<{
    label?: string
    help?: string
    /** The listings that can be picked, such as those with a vendor whose free key gives their closes. Every listing found by default. */
    pickable?: (listing: SearchedListing) => boolean
  }>(),
  { label: words.instrumentDialog.search, help: words.instrumentDialog.searchHelp, pickable: () => true },
)

const emit = defineEmits<{
  pick: [listing: SearchedListing]
}>()

const search = useSymbolSearch()
const text = words.instrumentDialog
const available = search.canSearch()
const typed = ref('')
const searching = ref(false)
const result = ref<SymbolSearchResult | null>(null)

const rows = computed(() =>
  (result.value?.listings ?? []).filter(props.pickable).map((listing) => ({
    listing,
    key: `${listing.symbol} ${listing.mic ?? listing.market ?? ''}`,
    details: [listing.market, listing.currency, listing.proposedType === null ? listing.type : words.types[listing.proposedType], listInWords(listing.foundBy)]
      .filter((part) => part !== null)
      .join(' · '),
  })),
)
const failures = computed(() => (result.value?.failures ?? []).map((failure) => pricesWords.failures.reason[failure.reason](failure.vendor)))

async function find(): Promise<void> {
  const asked = typed.value.trim()
  if (asked === '' || searching.value) return
  searching.value = true
  try {
    result.value = await search.search(asked)
  } finally {
    searching.value = false
  }
}

function pick(listing: SearchedListing): void {
  emit('pick', listing)
  result.value = null
}
</script>

<template>
  <div v-if="available" class="flex flex-col gap-2 sm:col-span-2" data-testid="instrument-search">
    <UFormField :label="label" :help="help">
      <div class="flex gap-2">
        <UInput v-model="typed" autocapitalize="characters" :spellcheck="false" class="w-full" data-testid="instrument-search-text" @keydown.enter.prevent="find" />
        <UButton :label="text.searchButton" icon="i-lucide-search" color="neutral" variant="outline" class="shrink-0" :loading="searching" data-testid="instrument-search-button" @click="find" />
      </div>
    </UFormField>
    <ul v-if="rows.length > 0" class="flex flex-col divide-y divide-default rounded-md border border-default" data-testid="instrument-search-results">
      <li v-for="row in rows" :key="row.key">
        <UButton color="neutral" variant="ghost" block class="justify-start rounded-none text-start" data-testid="instrument-search-result" @click="pick(row.listing)">
          <span class="flex min-w-0 flex-col">
            <span class="type-body text-highlighted">{{ row.listing.symbol }} · {{ row.listing.name }}</span>
            <span class="type-caption">{{ row.details }}</span>
          </span>
        </UButton>
      </li>
    </ul>
    <p v-else-if="result !== null" role="status" class="type-caption" data-testid="instrument-search-none">{{ text.noListing }}</p>
    <p v-for="line in failures" :key="line" class="type-caption" data-testid="instrument-search-failure">{{ line }}</p>
  </div>
</template>
