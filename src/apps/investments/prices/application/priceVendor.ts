import type { CloseRow, DividendRow, FailureReason, SectorWeightRow } from '../domain/pricesFile'

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

/** A company's profile as the vendor wrote it, each part null where the answer had none. An empty answer is a profile of nulls. */
export interface VendorProfile {
  readonly kind: 'profile'
  readonly industry: string | null
  readonly country: string | null
  readonly exchange: string | null
  /** Decimal text in the vendor's unit. */
  readonly marketCap: string | null
  /** The currency of the company's filings. */
  readonly currency: string | null
  readonly ipo: string | null
}

/** A fund's profile as the vendor wrote it, each part null where the answer had none. An answer for a listing that is no fund the vendor covers has nothing in it. */
export interface VendorFundProfile {
  readonly kind: 'fund-profile'
  /** Decimal text of a fraction, such as `0.0018` for 0.18%. */
  readonly expenseRatio: string | null
  readonly netAssets: string | null
  readonly inception: string | null
  /** The vendor's word, such as `NO`. */
  readonly leveraged: string | null
  /** How many holdings the answer lists. */
  readonly holdings: number | null
  /** Decimal text of a fraction. */
  readonly dividendYield: string | null
  readonly sectors: readonly SectorWeightRow[]
}

/** The dividends the vendor lists whose payment day is known, oldest first. */
export interface VendorDividends {
  readonly kind: 'dividends'
  readonly dividends: readonly DividendRow[]
}

/** One listing a search found, as the vendor wrote it. */
export interface FoundListing {
  readonly symbol: string
  readonly name: string
  /** The market identifier code, such as XNAS, where the vendor gives one. */
  readonly mic: string | null
  /** Where it trades in the vendor's words, such as NASDAQ or United Kingdom, or null where the answer had none. */
  readonly market: string | null
  readonly currency: string | null
  /** What the vendor calls it, such as Common Stock or ETF, or null where the answer had none. */
  readonly type: string | null
  /** Whether the vendor's free key gives its closes, as far as the vendor's documentation says. False for a vendor that prices nothing. */
  readonly freeCloses: boolean
}

export interface VendorSearch {
  readonly kind: 'found'
  readonly listings: readonly FoundListing[]
}

/** What an instrument is asked by: its ISIN where it has one, and the symbol the vendor knows it by. */
export interface ProfileQuery {
  readonly isin: string | null
  readonly symbol: string
}

/** What every vendor in the registry states, whatever it gives. */
interface VendorEntry {
  /** The source an instrument names and the prefix of its series and fact keys, such as `twelvedata`. */
  readonly id: string
  readonly name: string
  /** What it covers, in words for Settings. */
  readonly covers: string
  readonly needsKey: boolean
  /** Where a user claims a free key, or null for a vendor that needs none. */
  readonly keyAddress: string | null
  /** The address every request of the vendor starts with, which this browser counts each day's requests by. */
  readonly origin: string
  readonly limits: VendorLimits
  /** Which limit an answer says is reached, read from the vendor's own words, or null for an answer that is no limit. */
  limitOf(answer: VendorAnswer): VendorLimit | null
  /** A symbol, or for the ECB a currency, that a free key gets an answer for, which the Test in Settings asks for. */
  readonly testSymbol: string
  /** The splits of a symbol, for a vendor that lists them. A factor that is no ratio of small whole numbers is left out. */
  splits?(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorSplits>>
  /** A company's profile, for a vendor that has them. */
  profile?(fetch: VendorFetch, key: string | null, query: ProfileQuery): Promise<Fetched<VendorProfile>>
  /** A fund's profile with its weights by sector, for a vendor that has them. */
  fundProfile?(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorFundProfile>>
  /** A listing's dividends, announced ones among them, for a vendor that lists them. */
  dividends?(fetch: VendorFetch, key: string | null, symbol: string): Promise<Fetched<VendorDividends>>
  /** The listings whose symbol or name matches the text, for a vendor that searches. */
  search?(fetch: VendorFetch, key: string | null, text: string): Promise<Fetched<VendorSearch>>
}

/** A vendor of closes: `listings` prices the instruments that name it, `rates` gives the euro rates of currencies. */
export interface ClosesVendor extends VendorEntry {
  readonly prices: 'listings' | 'rates'
  /** The closes of a symbol, or the rates of a currency, from the day on. The key is null for a vendor that needs none. */
  closes(fetch: VendorFetch, key: string | null, symbol: string, from: string): Promise<Fetched<VendorCloses>>
}

/** A vendor of facts alone, such as company profiles, which prices nothing and whose Test asks for its test symbol's profile. */
export interface FactsVendor extends VendorEntry {
  readonly prices: 'facts'
  profile(fetch: VendorFetch, key: string | null, query: ProfileQuery): Promise<Fetched<VendorProfile>>
}

/**
 * One place Kuna fetches closes, rates or facts from. A new vendor is one module under infrastructure/vendors that
 * exports this, plus its entry in PRICE_VENDORS and its source in PRICE_SOURCES when instruments name it. It supplies
 * its id, name and coverage in both languages, what it gives, whether it needs a key and where to claim one, the
 * address its requests go to, its free limits, how to read a limit from its answers and a test symbol. A vendor of
 * closes gives the closes of a symbol from a day, and any vendor may give splits, profiles, fund profiles,
 * dividends or a search. The Prices settings, the pacing and the fetch read everything from here, so nothing else
 * names a vendor.
 */
export type PriceVendor = ClosesVendor | FactsVendor
