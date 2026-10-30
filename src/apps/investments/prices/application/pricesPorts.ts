import type { PricesFile } from '../domain/pricesFile'

/** The prices file as this browser last read it from Drive, with the revision it read. */
export interface PricesCopy {
  readonly fileId: string
  readonly revision: string
  /** ISO timestamp of the read. */
  readonly readAt: string
  readonly file: PricesFile
}

/** The copy of one prices file in this browser, which each read that finds a new revision replaces whole. */
export interface PricesCache {
  replace(copy: PricesCopy): Promise<void>
  read(): Promise<PricesCopy | null>
  delete(): Promise<void>
  close(): void
}
