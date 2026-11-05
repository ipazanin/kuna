<script setup lang="ts">
import { ref } from 'vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UFormField from '@nuxt/ui/components/FormField.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import type { ComparisonReading } from './useComparison'
import { words } from './words'
import { comparedSourceOf } from '../domain/comparedLine'
import type { ComparedPick } from '../domain/comparedLine'
import { INDEX_FUNDS, INDEX_FUNDS_SOURCE } from '../domain/indexFunds'
import InstrumentSearch from '../../holdings/presentation/InstrumentSearch.vue'
import { INVESTMENTS_PRICES_ROUTE } from '../../overview/presentation/investmentLinks'
import type { SearchedListing } from '../../prices/application/symbolSearch'
import { useSymbolSearch } from '../../prices/presentation/useSymbolSearch'
import { storedSecret } from '../../../../shared/secrets/infrastructure/browserSecrets'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { words as pricesWords } from '../../prices/presentation/words'
import AppDialog from '../../../../shared/ui/AppDialog.vue'
import RemovableChip from '../../../../shared/ui/RemovableChip.vue'

/**
 * A chart's Compare with: the button that opens the named index funds and a search of the price sources, and once a
 * ticker is picked, a chip that names it and removes it, with a line while its closes are fetched or when they did not come.
 */
defineProps<{
  /** What the ticker compared with is called, or null while nothing is. */
  name: string | null
  fetching: boolean
  /** Why the compared line is missing, or null when it is drawn. */
  note: string | null
  reading: ComparisonReading
}>()

const emit = defineEmits<{
  pick: [chosen: ComparedPick]
  remove: []
}>()

const fundsPriced = storedSecret(INDEX_FUNDS_SOURCE) !== null
const searchable = useSymbolSearch().canSearch()
const fundsVendor = PRICE_VENDORS.find((vendor) => vendor.id === INDEX_FUNDS_SOURCE)?.name ?? INDEX_FUNDS_SOURCE
const open = ref(false)

function pick(chosen: ComparedPick): void {
  open.value = false
  emit('pick', chosen)
}

function pickListing(listing: SearchedListing): void {
  const source = comparedSourceOf(listing)
  if (source !== null && listing.currency !== null) pick({ source, symbol: listing.symbol, currency: listing.currency })
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-3 gap-y-1.5" data-testid="compare-with">
    <RemovableChip v-if="name !== null" :label="name" :remove-label="words.remove(name)" data-testid="compare-chip" @remove="emit('remove')" />
    <span v-if="name !== null && fetching" role="status" class="inline-flex items-center gap-1.5 type-caption" data-testid="compare-fetching">
      <UIcon name="i-lucide-loader-circle" class="size-3.5 animate-spin" aria-hidden="true" />
      {{ words.fetching }}
    </span>
    <span v-else-if="name !== null && note !== null" role="status" class="type-caption" data-testid="compare-note">{{ note }}</span>
    <UButton :label="words.button" icon="i-lucide-git-compare-arrows" color="neutral" variant="ghost" size="xs" class="text-muted" data-testid="compare-open" @click="open = true" />
    <AppDialog v-model:open="open" :title="words.button" :description="words.description">
      <div class="flex flex-col gap-5">
        <UFormField :label="words.funds" data-testid="compare-funds">
          <div class="flex flex-wrap gap-1.5" role="group" :aria-label="words.funds">
            <UButton
              v-for="fund in INDEX_FUNDS"
              :key="fund.symbol"
              :label="words.fundNames[fund.symbol]"
              :disabled="!fundsPriced"
              size="sm"
              color="neutral"
              variant="outline"
              data-testid="compare-fund"
              @click="pick(fund)"
            />
          </div>
          <template #help>
            <span v-if="fundsPriced" data-testid="compare-funds-note">{{ reading === 'in-euros' ? words.fundsInEuros : words.fundsAsQuoted }}</span>
            <span v-else data-testid="compare-funds-note">
              <template v-if="searchable">{{ pricesWords.failures.reason['no-key'](fundsVendor) }} {{ pricesWords.advice['no-key'](fundsVendor) }}</template>
              <template v-else>{{ words.noKeyAtAll(fundsVendor) }}</template>
              <UButton :to="INVESTMENTS_PRICES_ROUTE" :label="pricesWords.advice.toSettings" color="neutral" variant="link" size="sm" class="inline-target px-0" data-testid="compare-funds-settings" />
            </span>
          </template>
        </UFormField>
        <InstrumentSearch :label="words.searchLabel" :help="words.searchHelp" :pickable="(listing) => comparedSourceOf(listing) !== null" @pick="pickListing" />
      </div>
    </AppDialog>
  </div>
</template>
