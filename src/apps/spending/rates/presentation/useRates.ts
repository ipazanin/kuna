import { shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { ratesNeeded } from '../domain/ratesNeeded'
import { ratesIn, ratesStateOf } from '../domain/ratesState'
import type { RatesState } from '../domain/ratesState'
import { browserRatesFetch } from '../infrastructure/browserRatesFetch'
import { useSpendingBooks } from '../../workbook/application/spendingStore'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import type { EcbRate } from '../../../../shared/money/rateBook'
import { ecbRates } from '../../../../shared/rates/infrastructure/ecbRates'
import type { RatesFetch } from '../../../../shared/rates/infrastructure/ecbRates'

const store = useSpendingBooks()
const rates = shallowRef<RatesState>('loading')
/** Each currency's rates in hand, and the day they start from. */
const fetched = new Map<CurrencyCode, { readonly from: CivilDate; readonly rates: readonly EcbRate[] | null }>()

async function ratesFetch(): Promise<RatesFetch> {
  // Inline, not hoisted into a constant, so a production build folds it away with the fixture.
  if (import.meta.env.VITE_FAKE_WORKBOOK === 'true') {
    const { fakeRatesFetch } = await import('../infrastructure/fake/fakeRatesFetch')
    return fakeRatesFetch(new URLSearchParams(window.location.search).get('rates'))
  }
  return browserRatesFetch
}

/** Asks the ECB for each currency the file needs that is not in hand from early enough, or for all of them again. */
async function fetchRates(needed: ReadonlyMap<CurrencyCode, CivilDate>, again: boolean): Promise<void> {
  const asked = [...needed].filter(([currency, from]) => again || (fetched.get(currency)?.from ?? '9999-12-31') > from)
  if (asked.length === 0 && rates.value !== 'loading') return
  // A currency with no answer yet waits, rather than reading as one whose rates failed.
  if (asked.some(([currency]) => !fetched.has(currency))) rates.value = 'loading'
  const fetch = await ratesFetch()
  await Promise.all(
    asked.map(async ([currency, from]) => {
      const answer = await ecbRates(fetch, currency, from)
      fetched.set(currency, { from, rates: answer.kind === 'rates' ? answer.rates : null })
    }),
  )
  rates.value = ratesStateOf(new Map([...needed.keys()].map((currency) => [currency, fetched.get(currency)?.rates ?? null])))
}

/** The page's one set of ECB rates for the Spending file on screen, kept in memory only. */
export function useRates(): Readonly<Ref<RatesState>> {
  return rates
}

/** Fetches the rates of the file on screen again, as the page's sync does. */
export function refreshRates(): Promise<void> {
  return store.state.workbook === null ? Promise.resolve() : fetchRates(ratesNeeded(store.state.workbook), true)
}

/** Asks for the rates the Spending file on screen needs, once per currency and page load, and again when it needs older ones. Returns the function that stops watching. */
export function startRates(): () => void {
  return watch(
    () => (store.state.workbook === null ? null : JSON.stringify([...ratesNeeded(store.state.workbook)])),
    (key) => {
      if (key === null || store.state.workbook === null) return
      fetchRates(ratesNeeded(store.state.workbook), false).catch(() => {
        rates.value = { book: ratesIn(rates.value), failed: true }
      })
    },
    { immediate: true },
  )
}
