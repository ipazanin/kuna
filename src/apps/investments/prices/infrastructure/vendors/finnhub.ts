import { words } from './words'
import { answerOf, parsedJson, statusFailure } from './vendorAnswers'
import { isJsonObject } from '../../domain/pricesFile'
import type { FactsVendor, Fetched, FoundListing, ProfileQuery, VendorFetch, VendorProfile, VendorSearch } from '../../application/priceVendor'

// Finnhub's field names below are read from its documentation (profile2's `finnhubIndustry` and `country`, search's
// `result` of `symbol`, `description` and `type`), unconfirmed until a request with a real key.

const API = 'https://finnhub.io/api/v1'

/** The answer's JSON, or why there is none. Finnhub answers a bad key with 401, a paid endpoint with 403 and its limit with 429. */
async function answerJson(fetch: VendorFetch, path: string, key: string): Promise<Fetched<{ readonly kind: 'json'; readonly parsed: unknown }>> {
  // The key goes in the address, as `token`, because a header of its own would make the browser ask Finnhub first with a CORS preflight.
  const fetched = await answerOf(fetch, `${API}${path}&token=${encodeURIComponent(key)}`)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const { status, text } = fetched.answer
  if (status === 403) {
    return { kind: 'failed', reason: 'not-on-free-key' }
  }
  if (status !== 200) {
    return { kind: 'failed', reason: status === 401 ? 'refused' : statusFailure(status) }
  }
  const parsed = parsedJson(text)
  return parsed === undefined ? { kind: 'failed', reason: 'unreadable' } : { kind: 'json', parsed }
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** A company's industry and home country, by ISIN where the instrument has one. An unknown company answers an empty object, kept as a profile of nulls. */
async function finnhubProfile(fetch: VendorFetch, key: string | null, query: ProfileQuery): Promise<Fetched<VendorProfile>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const asked = query.isin === null ? `symbol=${encodeURIComponent(query.symbol)}` : `isin=${encodeURIComponent(query.isin)}`
  const fetched = await answerJson(fetch, `/stock/profile2?${asked}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  if (!isJsonObject(fetched.parsed)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  return { kind: 'profile', industry: textOrNull(fetched.parsed.finnhubIndustry), country: textOrNull(fetched.parsed.country) }
}

/** The listings Finnhub finds for the text. It gives no market and no currency. */
async function finnhubSearch(fetch: VendorFetch, key: string | null, text: string): Promise<Fetched<VendorSearch>> {
  if (key === null) {
    return { kind: 'failed', reason: 'no-key' }
  }
  const fetched = await answerJson(fetch, `/search?q=${encodeURIComponent(text)}`, key)
  if (fetched.kind === 'failed') {
    return fetched
  }
  const result = isJsonObject(fetched.parsed) ? fetched.parsed.result : undefined
  if (!Array.isArray(result)) {
    return { kind: 'failed', reason: 'unreadable' }
  }
  const listings = result.flatMap((found): FoundListing[] => {
    const symbol = isJsonObject(found) ? textOrNull(found.symbol) : null
    if (symbol === null || !isJsonObject(found)) {
      return []
    }
    return [{ symbol, name: textOrNull(found.description) ?? symbol, mic: null, market: null, currency: null, type: textOrNull(found.type), freeCloses: false }]
  })
  return { kind: 'found', listings }
}

export const finnhub: FactsVendor & Required<Pick<FactsVendor, 'search'>> = {
  id: 'finnhub',
  name: words.finnhub.name,
  covers: words.finnhub.covers,
  prices: 'facts',
  needsKey: true,
  keyAddress: 'https://finnhub.io/register',
  origin: 'https://finnhub.io/',
  limits: { perMinute: 60, perDay: null, gapMilliseconds: null },
  limitOf: (answer) => (answer.status === 429 ? 'minute' : null),
  // The symbol of Finnhub's own examples.
  testSymbol: 'AAPL',
  profile: finnhubProfile,
  search: finnhubSearch,
}
