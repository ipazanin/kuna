import Dexie from 'dexie'
import type { EntityTable } from 'dexie'

import type { KeptReading, MailReadingCache } from '../application/mailReports'

const READING_KEY = 'reading'

/** Each Investments file's reading of the report mail has a database of its own, named with this and the file's id. */
export const MAIL_READING_DATABASE_PREFIX = 'kuna-ibkr-mail-'

/** The reading as IndexedDB keeps it. Structured clone keeps the decimals' bigints, so the plan is stored as it is. */
interface StoredReading extends KeptReading {
  readonly key: typeof READING_KEY
}

type MailReadingDatabase = Dexie & {
  reading: EntityTable<StoredReading, 'key'>
}

/** The last good reading of one Investments file's report mail in this browser, in its own database beside the books'. */
export function openMailReadingCache(investmentsFileId: string): MailReadingCache {
  const database = new Dexie(`${MAIL_READING_DATABASE_PREFIX}${investmentsFileId}`) as MailReadingDatabase
  database.version(1).stores({ reading: 'key' })
  return {
    async read() {
      const stored = await database.reading.get(READING_KEY)
      if (stored === undefined) return null
      const { key: _key, ...kept } = stored
      return kept
    },
    async replace(kept) {
      await database.reading.put({ key: READING_KEY, ...kept })
    },
    async delete() {
      // The keeper may keep a new reading in the same database later, so it opens again when asked.
      await database.delete({ disableAutoOpen: false })
    },
    close() {
      database.close()
    },
  }
}
