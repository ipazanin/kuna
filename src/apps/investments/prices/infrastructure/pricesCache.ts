import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { PricesCache, PricesCopy } from '../application/pricesPorts'
import { NO_FETCHED_FACTS, decodePricesFile, encodePricesFile } from '../domain/pricesFile'
import type { LastFetch, PricesFile } from '../domain/pricesFile'

const COPY_KEY = 'prices'

/** Each Investments file's prices have a database of their own, named with this and the file's id. */
export const PRICES_DATABASE_PREFIX = 'kuna-prices-'

/** The copy as text in the prices file's own format, so it is read by the same rules as the file on Drive. */
interface StoredCopy extends Omit<PricesCopy, 'file'> {
  readonly key: typeof COPY_KEY
  readonly text: string
}

/** The prices file as the first database version kept it, an object from before the file had facts. */
type FirstVersionFile = Omit<PricesFile, 'facts' | 'lastFetch'> & { readonly lastFetch: Pick<LastFetch, 'asked' | 'upToDate'> | null }

/** A row the upgrade rewrites in place, from its `file` to its `text`. */
interface UpgradedCopy {
  file?: FirstVersionFile
  text?: string
}

type PricesDatabase = Dexie & {
  copy: EntityTable<StoredCopy, 'key'>
}

/** The prices of one Investments file in this browser, as Dexie keeps them: the prices file whole, in its own database beside the books'. */
export function openPricesCache(investmentsFileId: string): PricesCache {
  const database = new Dexie(`${PRICES_DATABASE_PREFIX}${investmentsFileId}`) as PricesDatabase
  database.version(1).stores({ copy: 'key' })
  database
    .version(2)
    .stores({ copy: 'key' })
    .upgrade((transaction) =>
      transaction
        .table('copy')
        .toCollection()
        .modify((copy: UpgradedCopy) => {
          const { file } = copy
          if (file === undefined) return
          const lastFetch = file.lastFetch === null ? null : { ...file.lastFetch, factsAsked: 0, factsLeft: 0, factsKeyless: [] }
          copy.text = encodePricesFile({ ...file, lastFetch, facts: NO_FETCHED_FACTS })
          delete copy.file
        }),
    )

  return {
    async replace({ file, ...copy }) {
      await database.copy.put({ key: COPY_KEY, ...copy, text: encodePricesFile(file) })
    },

    async read() {
      const stored = await database.copy.get(COPY_KEY)
      if (stored === undefined) {
        return null
      }
      const { key: _key, text, ...copy } = stored
      const decoded = decodePricesFile(text)
      if (decoded.kind === 'refused') {
        throw new Error(`The prices kept in this browser cannot be read (${decoded.reason}). Reload the page.`)
      }
      return { ...copy, file: decoded.file }
    },

    async delete() {
      await database.delete()
    },

    close() {
      database.close()
    },
  }
}
