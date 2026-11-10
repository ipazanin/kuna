import type { CivilDate } from '../../calendar/civilDate'
import type { CurrencyCode } from '../../money/currencyCode'
import type { DatedRate } from '../../money/rateBook'
import type { RatesFile } from '../domain/ratesFile'

/** The rates file on Drive, found by its mark wherever the person moved it. */
export interface RatesDrive {
  /** The id of the rates file, or null before any device made one. */
  find(): Promise<string | null>
  download(fileId: string): Promise<string>
  overwrite(fileId: string, text: string): Promise<void>
  /** Makes the file in the Kuna folder, or beside the app's file while there is no Kuna folder, and gives its id. */
  create(text: string, besideFileId: string): Promise<string>
}

/** This browser's copy of the rates file, the only copy while no app's file is on Drive. */
export interface RatesCache {
  read(): Promise<RatesFile | null>
  replace(file: RatesFile): Promise<void>
}

/** What the ECB answered for a currency from a day on, oldest first, or that it gave none. */
export type EcbAnswer = { readonly kind: 'rates'; readonly rates: readonly DatedRate[] } | { readonly kind: 'failed' }

export interface RatesUpdatePorts {
  readonly cache: RatesCache
  ecbRates(currency: CurrencyCode, from: CivilDate): Promise<EcbAnswer>
  today(): CivilDate
  /** The time now, as an ISO timestamp. */
  now(): string
}
