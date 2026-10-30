import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { PricesCache, PricesCopy } from '../application/pricesPorts'

const COPY_KEY = 'prices'

/** Each Investments file's prices have a database of their own, named with this and the file's id. */
export const PRICES_DATABASE_PREFIX = 'kuna-prices-'

interface StoredCopy extends PricesCopy {
  readonly key: typeof COPY_KEY
}

type PricesDatabase = Dexie & {
  copy: EntityTable<StoredCopy, 'key'>
}

/** The prices of one Investments file in this browser, as Dexie keeps them: the prices file whole, in its own database beside the books'. */
export function openPricesCache(investmentsFileId: string): PricesCache {
  const database = new Dexie(`${PRICES_DATABASE_PREFIX}${investmentsFileId}`) as PricesDatabase
  database.version(1).stores({ copy: 'key' })

  return {
    async replace(copy) {
      await database.copy.put({ key: COPY_KEY, ...copy })
    },

    async read() {
      const stored = await database.copy.get(COPY_KEY)
      if (stored === undefined) {
        return null
      }
      const { key: _key, ...copy } = stored
      return copy
    },

    async delete() {
      await database.delete()
    },

    close() {
      database.close()
    },
  }
}
