import type { PricesFetchRun } from '../application/pricesUpdate'
import { words } from './words'

/**
 * Why the page's last fetch got nowhere, or null when it did not need to say. A fetch that found another tab
 * fetching is no problem, since that tab writes the prices.
 */
export function runProblem(run: PricesFetchRun | null): string | null {
  if (run?.kind === 'failed') {
    return run.message
  }
  return run?.kind === 'refused' ? words.refused[run.reason] : null
}
