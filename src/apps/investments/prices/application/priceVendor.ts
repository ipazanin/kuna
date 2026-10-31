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

/** A limit a vendor answered that it reached: the minute's, which passes, or the day's, which stops it until tomorrow. */
export type VendorLimit = 'minute' | 'day'

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

/** The splits a vendor lists for a symbol, oldest first. */
export interface VendorSplits {
  readonly kind: 'splits'
  readonly splits: readonly ReportedSplit[]
}

/**
 * One place Kuna fetches closes or rates from. A new vendor is one module under infrastructure/vendors that exports
 * this, plus its entry in PRICE_VENDORS and its source in PRICE_SOURCES when instruments name it. It supplies its id,
 * name and coverage in both languages, what it prices, whether it needs a key and where to claim one, the address its
 * requests go to, its free limits, how to read a limit from its answers, a test symbol, and the closes of a symbol from
 * a day. It may list splits too. The Prices settings, the pacing and the fetch read everything from here, so nothing
 * else names a vendor.
 */
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
  /** The address every request of the vendor starts with, which this browser counts each day's requests by. */
  readonly origin: string
  readonly limits: VendorLimits
  /** Which limit an answer says is reached, read from the vendor's own words, or null for an answer that is no limit. */
  limitOf(answer: VendorAnswer): VendorLimit | null
  /** A symbol, or for the ECB a currency, that a free key gets closes of, which the Test in Settings asks for. */
  readonly testSymbol: string
  /** The closes of a symbol, or the rates of a currency, from the day on. The key is null for a vendor that needs none. */
  closes(fetch: VendorFetch, key: string | null, symbol: string, from: string): Promise<Fetched<VendorCloses>>
  /** The splits of a symbol, for a vendor that lists them. A factor that is no ratio of small whole numbers is left out. */
  splits?(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorSplits>>
}
