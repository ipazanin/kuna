import type { PricesUpdate } from '../application/pricesUpdate'
import { INVESTMENTS_SETTINGS_ROUTE } from '../../overview/presentation/investmentLinks'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import { words } from './words'

/** Starts the day's fetch without waiting for it. A check that fails writes nothing, and the next sync or open checks again. */
export function fetchInBackground(prices: PricesUpdate): void {
  prices.fetchIfDue().catch(() => {
    // Nothing was written, so the copy and the file stay as they were.
  })
}

/** The Prices step of the Investments sync: reads the prices file on Drive into this browser's copy, then starts the day's fetch when it is due. */
export function pricesStep(prices: PricesUpdate): SyncStep {
  return {
    id: 'prices',
    label: words.step.label,
    scopes: () => BOOKS_STEP.scopes,
    startLine: words.step.reading,
    on: () => true,
    async run() {
      const read = await prices.read()
      if (read.kind === 'refused') {
        return { kind: 'failed', line: words.refused[read.reason], link: { label: words.step.settings, to: INVESTMENTS_SETTINGS_ROUTE } }
      }
      fetchInBackground(prices)
      return { kind: 'done', line: read.kind === 'read' ? words.step.read : words.step.unchanged, writeId: null, link: null }
    },
  }
}
