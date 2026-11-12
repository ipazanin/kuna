import { jsonChoice } from '../../../../shared/device/deviceChoice'

/** This browser's requests to each vendor on one day, kept beside the keys so Settings can set them against the daily limit. */
const USAGE_PREFIX = 'kuna.price-vendor-usage.'

/** The vendors' daily limits reset at midnight UTC, so the requests are counted by the UTC day. */
function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

/** Where storage is denied, as in a private window, nothing is counted. */
function usageOf(vendorId: string) {
  return jsonChoice(`${USAGE_PREFIX}${vendorId}`, (stored): { readonly day: string; readonly count: number } | null =>
    typeof stored === 'object' && stored !== null && 'day' in stored && 'count' in stored && typeof stored.day === 'string' && typeof stored.count === 'number'
      ? { day: stored.day, count: stored.count }
      : null,
  )
}

/** The requests this browser sent the vendor on the UTC day of `at`. */
export function requestsToday(vendorId: string, at: Date): number {
  const usage = usageOf(vendorId).read()
  return usage !== null && usage.day === utcDay(at) ? usage.count : 0
}

/** Sets the requests this browser sent the vendor on the UTC day of `at`. */
export function setRequestsToday(vendorId: string, at: Date, count: number): void {
  usageOf(vendorId).remember({ day: utcDay(at), count })
}

/** Counts one request to the vendor, starting the count afresh on a new UTC day. */
export function countRequest(vendorId: string, at: Date): void {
  setRequestsToday(vendorId, at, requestsToday(vendorId, at) + 1)
}
