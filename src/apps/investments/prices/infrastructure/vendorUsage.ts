/** This browser's requests to each vendor on one day, kept beside the keys so Settings can set them against the daily limit. */
const USAGE_PREFIX = 'kuna.price-vendor-usage.'

/** The vendors' daily limits reset at midnight UTC, so the requests are counted by the UTC day. */
function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10)
}

function usageOf(vendorId: string): { readonly day: string; readonly count: number } | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(`${USAGE_PREFIX}${vendorId}`) ?? 'null')
    if (typeof stored === 'object' && stored !== null && 'day' in stored && 'count' in stored && typeof stored.day === 'string' && typeof stored.count === 'number') {
      return { day: stored.day, count: stored.count }
    }
    return null
  } catch {
    return null
  }
}

/** The requests this browser sent the vendor on the UTC day of `at`. */
export function requestsToday(vendorId: string, at: Date): number {
  const usage = usageOf(vendorId)
  return usage !== null && usage.day === utcDay(at) ? usage.count : 0
}

/** Counts one request to the vendor, starting the count afresh on a new UTC day. */
export function countRequest(vendorId: string, at: Date): void {
  try {
    localStorage.setItem(`${USAGE_PREFIX}${vendorId}`, JSON.stringify({ day: utcDay(at), count: requestsToday(vendorId, at) + 1 }))
  } catch {
    // Storage can be denied in a private window, and then nothing is counted.
  }
}
