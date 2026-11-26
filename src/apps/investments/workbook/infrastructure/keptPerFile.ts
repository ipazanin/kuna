import Dexie from 'dexie'

import { MAIL_READING_DATABASE_PREFIX } from '../../mail/infrastructure/mailReadingCache'
import { PRICES_DATABASE_PREFIX } from '../../prices/infrastructure/pricesCache'

/** The databases this browser keeps for each Investments file beside its books, each named with its prefix and the file's id. */
const DATABASE_PREFIXES: readonly string[] = [PRICES_DATABASE_PREFIX, MAIL_READING_DATABASE_PREFIX]

/**
 * Deletes what this browser keeps beside the books of every Investments file it held: their prices and their reading of the report mail. This browser
 * shows one file at a time, so what it keeps for any other is left over.
 */
export async function forgetKeptForEveryFile(): Promise<void> {
  const names = await Dexie.getDatabaseNames()
  await Promise.all(names.filter((name) => DATABASE_PREFIXES.some((prefix) => name.startsWith(prefix))).map((name) => Dexie.delete(name)))
}
