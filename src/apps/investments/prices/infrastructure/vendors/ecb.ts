import { words } from './words'
import { statusFailure } from './vendorAnswers'
import { ECB_SOURCE } from '../../domain/pricesFile'
import type { ClosesVendor, Fetched, VendorCloses, VendorFetch } from '../../application/priceVendor'
import { ecbRates } from '../../../../../shared/rates/infrastructure/ecbRates'

/** The ECB's rates of a currency from the day on, as the closes of its series. */
async function ecbCloses(fetch: VendorFetch, _key: string | null, currency: string, from: string): Promise<Fetched<VendorCloses>> {
  const answer = await ecbRates(fetch, currency, from)
  switch (answer.kind) {
    case 'rates':
      return { kind: 'closes', closes: answer.rates, splits: [], earlierFailure: null }
    case 'no-answer':
      return { kind: 'failed', reason: 'no-answer' }
    case 'status':
      return { kind: 'failed', reason: statusFailure(answer.status) }
    case 'unreadable':
      return { kind: 'failed', reason: 'unreadable' }
  }
}

export const ecb: ClosesVendor = {
  id: ECB_SOURCE,
  name: words.ecb.name,
  covers: words.ecb.covers,
  prices: 'rates',
  needsKey: false,
  keyAddress: null,
  origin: 'https://data-api.ecb.europa.eu/',
  limits: { perMinute: null, perDay: null, gapMilliseconds: null },
  // The ECB states no limits, so a 429 can only be a request to slow down for a while.
  limitOf: (answer) => (answer.status === 429 ? 'minute' : null),
  testSymbol: 'USD',
  closes: ecbCloses,
}
