<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'

import { storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { pricesAge } from '../domain/priceBook'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plural } from '../../../../shared/text/translation'
import PricesProgress from './PricesProgress.vue'
import { runProblem } from './runProblem'
import { usePrices } from './usePrices'
import { words } from './words'

/**
 * How the prices stand on the Overview: the fetch under way, and a warning once the closes are behind or the last
 * fetch failed. The close the figures are at is in the Overview's header.
 */
const prices = usePrices()
const { sources, figures } = usePortfolio()

/** Whether this browser keeps a key for a vendor that needs one, which decides what advice a missing close gets. */
const keyKept = PRICE_VENDORS.some((vendor) => vendor.needsKey && storedVendorKey(vendor.id) !== null)
const problem = computed(() => runProblem(prices.state.lastRun))

const standing = computed(() => {
  const file = prices.state.copy?.file
  if (sources.value === null || figures.value === null || !sources.value.book.instruments.some((instrument) => instrument.prices !== 'manual')) {
    return null
  }
  const age =
    file === undefined
      ? null
      : pricesAge(
          figures.value.holdings.flatMap((holding) => holding.valuation?.close ?? []),
          sources.value.today,
        )
  if (file === undefined || age === null) {
    return { kind: 'none' } as const
  }
  return age.late ? ({ kind: 'behind', newest: dayLabel(age.newest), missed: file.failures.length } as const) : null
})

const behindNote = computed(() => {
  const shown = standing.value
  if (shown?.kind !== 'behind') return ''
  return [words.status.behindNote(shown.newest), shown.missed === 0 ? '' : `${plural(words.failures.title(shown.missed), shown.missed)}.`].filter((sentence) => sentence !== '').join(' ')
})
</script>

<template>
  <PricesProgress v-if="prices.state.fetching !== null" :fetching="prices.state.fetching" />
  <UAlert
    v-else-if="problem !== null"
    icon="i-lucide-triangle-alert"
    color="warning"
    variant="subtle"
    :title="words.status.fetchProblem"
    :description="problem"
    :actions="[{ label: words.status.settings, to: INVESTMENTS_SETTINGS_ROUTE, color: 'neutral', variant: 'outline', size: 'sm' }]"
    data-testid="investments-prices-problem"
  />
  <UAlert
    v-else-if="standing?.kind === 'behind'"
    icon="i-lucide-clock-alert"
    color="warning"
    variant="subtle"
    :title="words.status.behind"
    :description="behindNote"
    :actions="[{ label: words.status.settings, to: INVESTMENTS_SETTINGS_ROUTE, color: 'neutral', variant: 'outline', size: 'sm' }]"
    data-testid="investments-prices-behind"
  />
  <p v-else-if="standing?.kind === 'none'" class="flex flex-wrap items-center gap-x-2 type-caption" data-testid="investments-prices-none">
    {{ keyKept ? words.status.noCloses : words.status.none }}
    <UButton :to="INVESTMENTS_SETTINGS_ROUTE" :label="words.status.settings" color="neutral" variant="link" size="sm" class="inline-target px-0" />
  </p>
</template>
