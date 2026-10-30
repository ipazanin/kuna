import type { FailureReason } from '../../domain/pricesFile'
import type { Fetched, VendorAnswer, VendorFetch } from '../../application/priceVendor'

/** The vendor's answer, or no-answer when the request got none. */
export async function answerOf(fetch: VendorFetch, url: string): Promise<Fetched<{ readonly kind: 'answer'; readonly answer: VendorAnswer }>> {
  try {
    return { kind: 'answer', answer: await fetch(url) }
  } catch {
    return { kind: 'failed', reason: 'no-answer' }
  }
}

/** Why an HTTP status other than 200 got nothing. */
export function statusFailure(status: number): FailureReason {
  return status === 404 ? 'unknown-symbol' : status === 429 ? 'limit' : 'refused'
}

/** The JSON a body holds, or undefined for a body that is not JSON. */
export function parsedJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
