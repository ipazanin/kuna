import type { CloseRow, FailureReason } from '../domain/pricesFile'

/** What a vendor answered: its HTTP status and the body as text. */
export interface VendorAnswer {
  readonly status: number
  readonly text: string
}

/** A plain GET to a vendor's address. It throws when no answer comes at all. */
export type VendorFetch = (url: string) => Promise<VendorAnswer>

/** The most requests a vendor's free key takes, or null where the vendor states none. */
export interface VendorLimits {
  readonly perMinute: number | null
  readonly perDay: number | null
  /** The least time between two requests, or null where the vendor states none. */
  readonly gapMilliseconds: number | null
}

/** A split on the day it took effect, as whole numbers of new and old units. */
export interface ReportedSplit {
  readonly date: string
  readonly newUnits: string
  readonly oldUnits: string
}

export interface VendorCloses {
  readonly kind: 'closes'
  /** Oldest first, each close the text the vendor sent. */
  readonly closes: readonly CloseRow[]
  readonly splits: readonly ReportedSplit[]
  /** Why closes before the first one returned are missing, or null when they reach back to the day asked from. */
  readonly earlierFailure: FailureReason | null
}

export type Fetched<Answer> = Answer | { readonly kind: 'failed'; readonly reason: FailureReason }

/** One place Kuna fetches closes from. Adding a vendor is one adapter like this and its entry in the registry. */
export interface PriceVendor {
  /** The source an instrument names and the prefix of its series keys, such as `twelvedata`. */
  readonly id: string
  readonly name: string
  /** What it prices, in words for Settings. */
  readonly covers: string
  /** `listings` prices the instruments that name it, `rates` gives the euro rates of currencies. */
  readonly prices: 'listings' | 'rates'
  readonly needsKey: boolean
  /** Where a user claims a free key, or null for a vendor that needs none. */
  readonly keyAddress: string | null
  readonly limits: VendorLimits
  /** A symbol, or for the ECB a currency, that a free key gets closes of, which the Test in Settings asks for. */
  readonly testSymbol: string
  /** The closes of a symbol, or the rates of a currency, from the day on. The key is null for a vendor that needs none. */
  closes(fetch: VendorFetch, key: string | null, symbol: string, from: string): Promise<Fetched<VendorCloses>>
}
