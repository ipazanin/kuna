import type { RatesFetch } from '../../../../shared/rates/infrastructure/ecbRates'

/** A plain GET with no headers of its own, so the browser sends it without a CORS preflight. */
export const browserRatesFetch: RatesFetch = async (url) => {
  const response = await window.fetch(url, { signal: AbortSignal.timeout(10_000) })
  return { status: response.status, text: await response.text() }
}
