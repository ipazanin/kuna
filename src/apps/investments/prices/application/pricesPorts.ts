import type { VendorFetch } from './priceVendor'
import type { PricesFile } from '../domain/pricesFile'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

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

/** What a price fetch needs from the page. */
export interface PriceFetchPorts {
  readonly fetch: VendorFetch
  pause(milliseconds: number): Promise<void>
  /** The vendor's key as this browser keeps it, or null when it keeps none. */
  key(vendorId: string): string | null
  /** The Investments records as the page holds them. */
  investments(): InvestmentBook
  /** The prices file's text as Drive holds it now. */
  readPrices(): Promise<string>
  /** Overwrites the prices file on Drive. */
  writePrices(text: string): Promise<void>
}
