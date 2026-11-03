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

/** A vendor's pause in a fetch, which its pacing or its limit asked for. */
export interface FetchPause {
  readonly vendorId: string
  readonly milliseconds: number
}

/** How far a fetch has come: the series asked for so far of all it asks for, the time the pacing still needs, and the pause it is in. */
export interface FetchProgress {
  readonly asked: number
  readonly of: number
  readonly leftMilliseconds: number
  readonly pause: FetchPause | null
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
  /** Called once with none asked, before each series and at the start of each pause. */
  progress(progress: FetchProgress): void
}

/** The Drive requests the prices file needs, over Google's API or the fake Drive. */
export interface PricesDrive {
  parentOf(fileId: string): Promise<string>
  /** The ids of the files, never folders, with this name in the folder. */
  filesNamed(folderId: string, name: string): Promise<readonly string[]>
  createFile(parentId: string, name: string, text: string): Promise<{ readonly id: string; readonly revision: string }>
  /** The file's head revision, or null when the file is in the bin or Drive no longer has it. */
  headRevision(fileId: string): Promise<string | null>
  download(fileId: string): Promise<string>
  /** Replaces the content and gives the new head revision, which Drive does not keep forever. */
  overwrite(fileId: string, text: string): Promise<string>
  /** Moves the file to the bin, from which the person can restore it for 30 days. */
  trash(fileId: string): Promise<void>
}

/** The Drive requests the keys file needs in the app's hidden folder, which only Kuna sees and nobody can share. */
export interface KeysDrive {
  /** The ids of the files in the app's folder with this name. */
  filesNamed(name: string): Promise<readonly string[]>
  /** Makes the file in the app's folder and gives its id. */
  createFile(name: string, text: string): Promise<string>
  download(fileId: string): Promise<string>
  overwrite(fileId: string, text: string): Promise<void>
  /** Deletes the file for good, since Drive keeps no file of the app's folder in the bin. */
  delete(fileId: string): Promise<void>
}

/** Where the prices of the Investments file on screen are kept. */
export interface PricesPlace {
  readonly investmentsFileId: string
  readonly cache: PricesCache
  /** Drive, where the Investments file is on Drive, or null where it is kept in this browser and the cache is the only copy. */
  readonly drive: PricesDrive | null
}
