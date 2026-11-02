import { computed, ref, watch } from 'vue'
import type { ComputedRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { words } from './words'
import { changeAsQuoted, changeInEuros, comparedInstrument, comparedKey, comparedSourceOf, comparedSources, tickerNamed } from '../domain/comparedLine'
import type { ComparedLine, ComparedTicker } from '../domain/comparedLine'
import { usePortfolio } from '../../holdings/presentation/usePortfolio'
import type { SearchedListing } from '../../prices/application/symbolSearch'
import { seriesKey } from '../../prices/domain/pricesFile'
import { PRICE_VENDORS } from '../../prices/infrastructure/vendors/priceVendors'
import { usePrices } from '../../prices/presentation/usePrices'
import { words as pricesWords } from '../../prices/presentation/words'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { dayLabel } from '../../../../shared/calendar/dayLabel'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'

/** The address keeps the ticker compared with as its series key, such as `?compare=twelvedata:EXQ`. */
const COMPARE_QUERY = 'compare'

export interface Comparison {
  /** The ticker the address names, or null while nothing is compared. */
  readonly ticker: ComputedRef<ComparedTicker | null>
  /** The ticker's line at each of the chart's days, once its closes are in. */
  readonly line: ComputedRef<ComparedLine | null>
  readonly fetching: ComputedRef<boolean>
  /** Why a ticker compared with has no line, in words, or null while it has one or none is compared. */
  readonly note: ComputedRef<string | null>
  pick(listing: SearchedListing): void
  remove(): void
}

/**
 * The ticker a chart compares with, kept in the address and nowhere in the Investments file, and its line over the
 * chart's days as quoted or in euros. Its closes from the chart's first day go into the prices file as a series, so a
 * chart opened again asks only for the days since.
 */
export function useComparison(days: () => readonly CivilDate[], reading: 'as-quoted' | 'in-euros'): Comparison {
  const route = useRoute()
  const router = useRouter()
  const prices = usePrices()
  const portfolio = usePortfolio()
  /** The currency of each listing picked on this page, until its series in the prices file says it. */
  const picked = ref<Readonly<Record<string, string>>>({})
  const fetchingKey = ref<string | null>(null)

  const ticker = computed(() => tickerNamed(route.query[COMPARE_QUERY]))
  const key = computed(() => (ticker.value === null ? null : comparedKey(ticker.value)))
  const file = computed(() => prices.state.copy?.file ?? null)
  const currency = computed(() => (key.value === null ? null : currencyCodeOf(file.value?.series[key.value]?.currency ?? picked.value[key.value] ?? '')))
  const firstDay = computed(() => days()[0] ?? null)

  const compared = computed(() => {
    if (ticker.value === null || currency.value === null || portfolio.sources.value === null) return null
    const instrument = comparedInstrument(ticker.value, currency.value)
    return { instrument, sources: comparedSources(portfolio.sources.value, instrument, file.value?.splits ?? []) }
  })
  const line = computed((): ComparedLine | null => {
    if (ticker.value === null || compared.value === null) return null
    const { instrument, sources } = compared.value
    const change = (reading === 'in-euros' ? changeInEuros : changeAsQuoted)(instrument, days(), sources)
    return change === null ? null : { name: ticker.value.symbol, change }
  })
  /** Why a series the line needs failed today, as the prices settings say it, or null when it did not. */
  function failureOf(series: string, source: string): string | null {
    const failed = file.value?.failures.find((entry) => entry.series === series)
    const vendor = PRICE_VENDORS.find((candidate) => candidate.id === source)
    return failed === undefined || vendor === undefined ? null : pricesWords.failures.reason[failed.reason](vendor.name)
  }
  const note = computed(() => {
    const shown = ticker.value
    const from = firstDay.value
    if (shown === null || line.value !== null || from === null) return null
    if (currency.value === null || compared.value === null) return words.pickAgain(shown.symbol)
    const { instrument, sources } = compared.value
    const day = dayLabel(from)
    // A line in euros also needs each day's rate, so with the first close in, what is missing is a rate.
    if (sources.prices.closeOnOrBefore(instrument, from) === null) {
      return failureOf(comparedKey(shown), shown.source) ?? words.noCloseThen(shown.symbol, day)
    }
    const ratesVendor = PRICE_VENDORS.find((vendor) => vendor.prices === 'rates')
    return (ratesVendor === undefined ? null : failureOf(seriesKey(ratesVendor.id, currency.value), ratesVendor.id)) ?? words.noRateThen(shown.symbol, currency.value, day)
  })

  watch(
    () => [key.value, currency.value, firstDay.value] as const,
    async ([asked, quoted, from]) => {
      const shown = ticker.value
      if (asked === null || shown === null || quoted === null || from === null) return
      fetchingKey.value = asked
      try {
        await prices.fetchCompared({ source: shown.source, symbol: shown.symbol, currency: quoted, from })
      } catch {
        // A fetch that throws leaves the line out, and the next opening of the chart asks again.
      } finally {
        if (fetchingKey.value === asked) fetchingKey.value = null
      }
    },
    { immediate: true },
  )

  function setQuery(value: string | null): void {
    const { [COMPARE_QUERY]: _left, ...others } = route.query
    void router.replace({ query: value === null ? others : { ...others, [COMPARE_QUERY]: value } })
  }

  return {
    ticker,
    line,
    fetching: computed(() => fetchingKey.value !== null && fetchingKey.value === key.value),
    note,
    pick(listing) {
      const source = comparedSourceOf(listing)
      if (source === null || listing.currency === null) return
      const chosen = { source, symbol: listing.symbol }
      picked.value = { ...picked.value, [comparedKey(chosen)]: listing.currency }
      setQuery(comparedKey(chosen))
    },
    remove() {
      setQuery(null)
    },
  }
}
