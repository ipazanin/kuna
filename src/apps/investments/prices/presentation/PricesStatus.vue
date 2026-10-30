<script setup lang="ts">
import { computed } from 'vue'
import UAlert from '@nuxt/ui/components/Alert.vue'
import UButton from '@nuxt/ui/components/Button.vue'
import UIcon from '@nuxt/ui/components/Icon.vue'

import { pricesDay } from '../application/pricesUpdate'
import { storedVendorKey } from '../infrastructure/vendorKeys'
import { PRICE_VENDORS } from '../infrastructure/vendors/priceVendors'
import { pricesAge } from '../domain/priceBook'
import { pricesFileBook, pricesFileRateBook } from '../domain/pricesFileBooks'
import { portfolioFigures } from '../../holdings/domain/portfolioFigures'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import { useInvestmentsBooks } from '../../workbook/application/investmentsStore'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { plural } from '../../../../shared/text/translation'
import PricesProgress from './PricesProgress.vue'
import { runProblem } from './runProblem'
import { usePrices } from './usePrices'
import { words } from './words'

/** How the prices stand on the Overview: the fetch under way, how recent the holdings' closes are, and a warning once they are behind. */
const prices = usePrices()
const { state } = useInvestmentsBooks()

/** Whether this browser keeps a key for a vendor that needs one, which decides what advice a missing close gets. */
const keyKept = PRICE_VENDORS.some((vendor) => vendor.needsKey && storedVendorKey(vendor.id) !== null)
const problem = computed(() => runProblem(prices.state.lastRun))

const standing = computed(() => {
  const book = state.workbook?.book
  const file = prices.state.copy?.file
  if (book === undefined || !book.instruments.some((instrument) => instrument.prices !== 'manual')) {
    return null
  }
  if (file === undefined) {
    return { kind: 'none' } as const
  }
  const today = pricesDay(new Date().toISOString())
  const figures = portfolioFigures({ book, prices: pricesFileBook(file, book.prices), rates: pricesFileRateBook(file), today })
  const age = pricesAge(
    figures.holdings.flatMap((holding) => holding.valuation?.close ?? []),
    today,
  )
  if (age === null) {
    return { kind: 'none' } as const
  }
  return { kind: age.late ? 'behind' : 'current', newest: dayLabel(age.newest), missed: file.failures.length } as const
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
  <p v-else-if="standing?.kind === 'current'" class="flex items-center gap-1.5 type-caption" data-testid="investments-prices-current">
    <UIcon name="i-lucide-circle-check" class="size-4 shrink-0 text-success" aria-hidden="true" />
    {{ words.status.upTo(standing.newest) }}
  </p>
  <p v-else-if="standing?.kind === 'none'" class="flex flex-wrap items-center gap-x-2 type-caption" data-testid="investments-prices-none">
    {{ keyKept ? words.status.noCloses : words.status.none }}
    <UButton :to="INVESTMENTS_SETTINGS_ROUTE" :label="words.status.settings" color="neutral" variant="link" size="sm" class="inline-target px-0" />
  </p>
</template>
