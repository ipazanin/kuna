import type { VendorFetch } from './priceVendor'
import type { PricesFile } from '../domain/pricesFile'
import type { InvestmentBook } from '../../workbook/domain/investmentBook'

/** The prices file as this browser last read or wrote it, with the revision it read. */
export interface PricesCopy {
  /** The prices file on Drive, or null where the Investments file is kept in this browser and this copy is the only one. */
  readonly fileId: string | null
  readonly revision: string
  /** ISO timestamp of the read. */
  readonly readAt: string
  readonly file: PricesFile
}

/** The copy of the prices of one Investments file in this browser, which each read that finds a new revision replaces whole. */
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
  /** The series asked for so far, of all the fetch asks for, called before each one and once with none asked. */
  progress(asked: number, of: number): void
}

/** The Drive requests the prices file needs, over Google's API or the fake Drive. */
export interface PricesDrive {
  parentOf(fileId: string): Promise<string>
  /** The ids of the files, never folders, with this name in the folder. */
  filesNamed(folderId: string, name: string): Promise<readonly string[]>
  createFile(parentId: string, name: string, text: string): Promise<{ readonly id: string; readonly revision: string }>
  /** The file's head revision, or null when Drive no longer has the file. */
  headRevision(fileId: string): Promise<string | null>
  download(fileId: string): Promise<string>
  /** Replaces the content and gives the new head revision, which Drive does not keep forever. */
  overwrite(fileId: string, text: string): Promise<string>
}

/** Where the prices of the Investments file on screen are kept. */
export interface PricesPlace {
  readonly investmentsFileId: string
  readonly cache: PricesCache
  /** Drive, where the Investments file is on Drive, or null where it is kept in this browser and the cache is the only copy. */
  readonly drive: PricesDrive | null
}
