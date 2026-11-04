import type { PricesUpdate } from '../application/pricesUpdate'
import { fetchedFactsBook } from '../domain/factsBook'
import { holdingsWithFactProblems } from '../../holdings/domain/factProblems'
import { holdingLink } from '../../holdings/presentation/holdingLinks'
import { INVESTMENTS_PRICES_ROUTE, PORTFOLIO_CHECKS_ROUTE } from '../../overview/presentation/investmentLinks'
import { words as overviewWords } from '../../overview/presentation/words'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'
import type { SyncStep } from '../../../../shared/sync/application/sync'
import { BOOKS_STEP } from '../../../../shared/sync/application/syncRun'
import { plural } from '../../../../shared/text/translation'
import { withFullStop } from '../../../../shared/text/withFullStop'
import { words } from './words'

/** Starts the day's fetch without waiting for it. A check that fails writes nothing, and the next sync or open checks again. */
export function fetchInBackground(prices: PricesUpdate): void {
  prices.fetchIfDue().catch(() => {
    // Nothing was written, so the copy and the file stay as they were.
  })
}

/** Starts the fetch of the series the records just gained, such as an import's holdings, once a fetch under way is over. */
export function fetchAddedInBackground(prices: PricesUpdate): void {
  prices.fetchAdded().catch(() => {
    // Nothing was written, so the next sync or return to the page fetches what is still missing.
  })
}

/**
 * The Prices step of the Investments sync: reads the prices file on Drive into this browser's copy, then starts the
 * day's fetch when it is due. It counts the holdings a vendor sent nothing usable for and links to the one, or to the
 * Overview's checks, which list them all. It counts them in the copy it read, before the day's fetch, so a problem that
 * fetch finds shows on the holding and the Overview at once and in this step at the next sync.
 */
export function pricesStep(prices: PricesUpdate, investments: () => InvestmentBook | null): SyncStep {
  return {
    id: 'prices',
    label: words.step.label,
    scopes: () => BOOKS_STEP.scopes,
    startLine: words.step.reading,
    on: () => true,
    async run() {
      const read = await prices.read()
      if (read.kind === 'refused') {
        return { kind: 'failed', line: words.refused[read.reason], link: { label: words.step.settings, to: INVESTMENTS_PRICES_ROUTE } }
      }
      fetchInBackground(prices)
      const line = read.kind === 'read' ? words.step.read : words.step.unchanged
      const book = investments()
      const troubled = book === null || read.kind === 'not-on-drive' ? [] : holdingsWithFactProblems(book, fetchedFactsBook(read.copy.file.facts))
      const [only] = troubled
      if (only === undefined) {
        return { kind: 'done', line, writeId: null, link: null }
      }
      return {
        kind: 'done',
        line: `${withFullStop(line)} ${withFullStop(plural(overviewWords.checks.factProblems(troubled.length), troubled.length))}`,
        writeId: null,
        link: troubled.length === 1 ? { label: only.instrument.name, to: holdingLink(only.instrument) } : { label: words.step.checks, to: PORTFOLIO_CHECKS_ROUTE },
      }
    },
  }
}
