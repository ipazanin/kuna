import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { PricesCache, PricesCopy } from '../application/pricesPorts'

const COPY_KEY = 'prices'

interface StoredCopy extends PricesCopy {
  readonly key: typeof COPY_KEY
}

type PricesDatabase = Dexie & {
  copy: EntityTable<StoredCopy, 'key'>
}

/** One prices file in this browser, as Dexie keeps it: the file whole, in its own database beside the books'. */
export function openPricesCache(fileId: string): PricesCache {
  const database = new Dexie(`kuna-prices-${fileId}`) as PricesDatabase
  database.version(1).stores({ copy: 'key' })

  return {
    async replace(copy) {
      if (copy.fileId !== fileId) {
        throw new Error(`Refusing to keep prices file ${copy.fileId} in the database for ${fileId}.`)
      }
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
