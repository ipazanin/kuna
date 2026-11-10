import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { RatesCache } from '../application/ratesPorts'
import { decodeRatesFile, encodeRatesFile } from '../domain/ratesFile'

const COPY_KEY = 'rates'

/** The copy as text in the file's own format, so it is read by the same rules as the file on Drive. */
interface StoredCopy {
  readonly key: typeof COPY_KEY
  readonly text: string
}

type RatesDatabase = Dexie & {
  copy: EntityTable<StoredCopy, 'key'>
}

/** This browser's copy of the rates file, in a database of its own that every app's page shares. */
export function browserRatesCache(): RatesCache {
  const database = new Dexie('kuna-rates') as RatesDatabase
  database.version(1).stores({ copy: 'key' })
  return {
    async read() {
      const stored = await database.copy.get(COPY_KEY)
      if (stored === undefined) {
        return null
      }
      const decoded = decodeRatesFile(stored.text)
      // A copy a newer Kuna wrote, or one that does not read, is fetched again rather than stopping the page.
      return decoded.kind === 'read' ? decoded.file : null
    },

    async replace(file) {
      await database.copy.put({ key: COPY_KEY, text: encodeRatesFile(file) })
    },
  }
}
