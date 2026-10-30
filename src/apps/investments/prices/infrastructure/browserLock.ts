/** The lock every tab of this browser takes for a price fetch. */
const FETCH_LOCK = 'kuna-investments-price-fetch'

/** Runs `run` while no other tab holds the fetch lock, or answers busy. A browser without Web Locks runs it, and the page's own flag still keeps it to one. */
export async function exclusivelyInBrowser<Result>(run: () => Promise<Result>): Promise<Result | 'busy'> {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  if (locks === undefined) {
    return run()
  }
  return locks.request(FETCH_LOCK, { ifAvailable: true }, (lock) => (lock === null ? 'busy' : run()))
}
