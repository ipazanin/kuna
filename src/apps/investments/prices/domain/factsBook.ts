import { OLDER_SHAPE_ASKED, isDay, seriesKey } from './pricesFile'
import type { FactFailure, FetchedFacts, FundFact, ProfileFact } from './pricesFile'
import { sectorOfFundSector, sectorOfIndustry, typeOfListing } from './vendorWords'
import type { Instrument, InstrumentType } from '../../workbook/domain/instrument'
import { countryOf } from '../../workbook/domain/mixGroup'
import type { Country, Sector } from '../../workbook/domain/mixGroup'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, addDecimal, decimalOfText, scaledDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'

/** A company's market capitalisation as the vendor gave it, in the vendor's unit, and the currency of its filings where the profile names one. */
export interface MarketCap {
  readonly amount: Decimal
  readonly currency: CurrencyCode | null
}

/** A company's profile in Kuna's words, each part null where the profile does not say or Kuna does not know the vendor's word. */
export interface ProfileFacts {
  /** The id of the vendor that gave the profile, such as `finnhub`. */
  readonly vendor: string
  readonly sector: Sector | null
  readonly country: Country | null
  /** The exchange in the vendor's words, such as `NASDAQ NMS - GLOBAL MARKET`. */
  readonly exchange: string | null
  readonly marketCap: MarketCap | null
  readonly ipo: CivilDate | null
}

/** A fund's profile in Kuna's words, each part null where the vendor did not say. */
export interface FundProfile {
  /** The id of the vendor that gave it, such as `alphavantage`. */
  readonly vendor: string
  /** The yearly cost in percent of the fund, as a typed TER is. */
  readonly ter: Decimal | null
  /** In the vendor's unit, which it does not state. */
  readonly netAssets: Decimal | null
  readonly inception: CivilDate | null
  readonly leveraged: boolean | null
  readonly holdings: number | null
}

/** What a vendor sent for a fact of a holding when it sent nothing Kuna can use: a failure it answered, or an answer with nothing in it. */
export interface FactProblem {
  readonly vendor: string
  readonly fact: 'profile' | 'fund'
  /** The ISIN or symbol the vendor was asked by. */
  readonly asked: string
  readonly askedOn: CivilDate
  readonly failure: FactFailure | 'empty'
}

/** The part of a fund in one sector, in percent of the fund. */
export interface SectorWeight {
  readonly sector: Sector
  readonly percent: Decimal
}

/** A fund's parts by sector as one vendor gave them. */
export interface FundWeights {
  /** The id of the vendor that gave them, such as `alphavantage`. */
  readonly vendor: string
  readonly weights: readonly SectorWeight[]
}

/** A dividend a vendor announced, a unit in the instrument's quote currency. */
export interface AnnouncedDividend {
  readonly exDay: CivilDate
  readonly paymentDay: CivilDate
  readonly amount: Decimal
}

/** What vendors answered about the instruments, read into Kuna's words. Every answer is a fallback for what is typed in the Investments file. */
export interface FactsBook {
  /** Its type as typed, else what a search of its own price vendor calls it, or null where neither says. */
  typeOf(instrument: Instrument): InstrumentType | null
  /** Null where no vendor gave a profile. */
  profileOf(instrument: Instrument): ProfileFacts | null
  /** Null where no vendor gave a fund profile. */
  fundProfileOf(instrument: Instrument): FundProfile | null
  /** Null where no vendor gave weights Kuna can read. */
  sectorWeightsOf(instrument: Instrument): FundWeights | null
  /**
   * The profile a share was asked for and the fund profile a fund was asked for, where the vendor sent nothing Kuna can
   * use. An untyped holding is asked for a fund profile too, for its sectors, but warns of none, as it may be a share.
   * A fact read from an older prices file is left out, as the next fetch asks it again.
   */
  problemsOf(instrument: Instrument): readonly FactProblem[]
  /** Oldest payment first. */
  announcedOf(instrument: Instrument): readonly AnnouncedDividend[]
}

/** The symbol a vendor is asked about an instrument by: the one it prices the instrument by, else the instrument's own. */
export function vendorSymbolOf(instrument: Instrument, vendorId: string): string {
  return instrument.prices === vendorId && instrument.sourceSymbol !== '' ? instrument.sourceSymbol : instrument.symbol
}

/** A profile is asked by ISIN, which names one company wherever it lists, else by symbol. */
export function profileQueryOf(instrument: Instrument): string {
  return instrument.isin ?? instrument.symbol
}

/** The key of the type a search of its own price vendor gave, or null for an instrument priced by hand. */
export function typeKeyOf(instrument: Instrument): string | null {
  return instrument.prices === 'manual' || instrument.sourceSymbol === '' ? null : seriesKey(instrument.prices, instrument.sourceSymbol)
}

/** The vendor and the symbol or ISIN of a fact's key, such as `finnhub` and `US0378331005`. */
function keyParts(key: string): { readonly vendorId: string; readonly asked: string } {
  const split = key.indexOf(':')
  return { vendorId: key.slice(0, split), asked: key.slice(split + 1) }
}

/** The first fact, by key, that a vendor gave for the instrument, with the vendor's id. */
function factFor<Fact>(facts: Readonly<Record<string, Fact>>, matches: (vendorId: string, asked: string) => boolean): { readonly vendor: string; readonly fact: Fact } | null {
  const key = Object.keys(facts)
    .sort()
    .find((candidate) => {
      const { vendorId, asked } = keyParts(candidate)
      return matches(vendorId, asked)
    })
  return key === undefined ? null : { vendor: keyParts(key).vendorId, fact: facts[key]! }
}

const PERCENT = 100n

function parsedDay(text: string | null): CivilDate | null {
  return text !== null && isDay(text) ? parseCivilDate(text) : null
}

function decimalOrNull(text: string | null): Decimal | null {
  return text === null ? null : decimalOfText(text)
}

function profileIsEmpty(profile: ProfileFact): boolean {
  return [profile.industry, profile.country, profile.exchange, profile.marketCap, profile.ipo].every((part) => part === null)
}

function fundIsEmpty(fund: FundFact): boolean {
  return [fund.expenseRatio, fund.netAssets, fund.inception, fund.leveraged, fund.dividendYield].every((part) => part === null) && (fund.holdings ?? 0) === 0 && fund.sectors.length === 0
}

/** Why a fact gave nothing Kuna can use, or null for one that gave something. */
function problemOf(fact: ProfileFact | FundFact, empty: boolean): FactFailure | 'empty' | null {
  return fact.failed ?? (empty ? 'empty' : null)
}

/** The facts kept in the prices file, read in the vendors' words through the tables of `vendorWords.ts`. */
export function fetchedFactsBook(facts: FetchedFacts): FactsBook {
  const bySymbol = (instrument: Instrument) => (vendorId: string, asked: string) => asked === vendorSymbolOf(instrument, vendorId)
  const typeOf = (instrument: Instrument): InstrumentType | null => {
    if (instrument.type !== null) {
      return instrument.type
    }
    const key = typeKeyOf(instrument)
    const word = key === null ? null : (facts.types[key]?.type ?? null)
    return word === null ? null : typeOfListing(word)
  }
  return {
    typeOf,
    profileOf(instrument) {
      const query = profileQueryOf(instrument)
      const found = factFor(facts.profiles, (_vendorId, asked) => asked === query)
      if (found === null || problemOf(found.fact, profileIsEmpty(found.fact)) !== null) {
        return null
      }
      const { vendor, fact: profile } = found
      const amount = decimalOrNull(profile.marketCap)
      return {
        vendor,
        sector: profile.industry === null ? null : sectorOfIndustry(profile.industry),
        country: profile.country === null ? null : countryOf(profile.country),
        exchange: profile.exchange,
        marketCap: amount === null || amount <= DECIMAL_ZERO ? null : { amount, currency: profile.currency === null ? null : currencyCodeOf(profile.currency) },
        ipo: parsedDay(profile.ipo),
      }
    },
    fundProfileOf(instrument) {
      const found = factFor(facts.funds, bySymbol(instrument))
      if (found === null || problemOf(found.fact, fundIsEmpty(found.fact)) !== null) {
        return null
      }
      const { vendor, fact: fund } = found
      const ratio = decimalOrNull(fund.expenseRatio)
      const leveraged = fund.leveraged?.trim().toUpperCase()
      return {
        vendor,
        ter: ratio === null ? null : scaledDecimal(ratio, PERCENT, 1n),
        netAssets: decimalOrNull(fund.netAssets),
        inception: parsedDay(fund.inception),
        leveraged: leveraged === 'YES' ? true : leveraged === 'NO' ? false : null,
        holdings: fund.holdings === 0 ? null : fund.holdings,
      }
    },
    problemsOf(instrument) {
      const type = typeOf(instrument)
      const query = profileQueryOf(instrument)
      const profile = type === 'share' ? factFor(facts.profiles, (_vendorId, asked) => asked === query) : null
      const fund = type === 'fund' ? factFor(facts.funds, bySymbol(instrument)) : null
      const found: FactProblem[] = []
      const profileFailure = profile === null ? null : problemOf(profile.fact, profileIsEmpty(profile.fact))
      if (profile !== null && profileFailure !== null) found.push({ vendor: profile.vendor, fact: 'profile', asked: query, askedOn: parseCivilDate(profile.fact.asked)!, failure: profileFailure })
      const fundFailure = fund === null ? null : problemOf(fund.fact, fundIsEmpty(fund.fact))
      if (fund !== null && fundFailure !== null)
        found.push({ vendor: fund.vendor, fact: 'fund', asked: vendorSymbolOf(instrument, fund.vendor), askedOn: parseCivilDate(fund.fact.asked)!, failure: fundFailure })
      return found.filter((problem) => problem.askedOn !== OLDER_SHAPE_ASKED)
    },
    sectorWeightsOf(instrument) {
      const found = factFor(facts.funds, bySymbol(instrument))
      const weights = new Map<Sector, Decimal>()
      for (const [name, weight] of found?.fact.sectors ?? []) {
        const sector = sectorOfFundSector(name)
        const fraction = decimalOfText(weight)
        if (sector !== null && fraction !== null && fraction > DECIMAL_ZERO) {
          weights.set(sector, addDecimal(weights.get(sector) ?? DECIMAL_ZERO, scaledDecimal(fraction, PERCENT, 1n)))
        }
      }
      return found === null || weights.size === 0 ? null : { vendor: found.vendor, weights: [...weights].map(([sector, percent]) => ({ sector, percent })) }
    },
    announcedOf(instrument) {
      return (factFor(facts.dividends, bySymbol(instrument))?.fact.dividends ?? [])
        .map(([exDay, paymentDay, amount]) => ({ exDay: parseCivilDate(exDay)!, paymentDay: parseCivilDate(paymentDay)!, amount: decimalOfText(amount)! }))
        .sort((earlier, later) => earlier.paymentDay.localeCompare(later.paymentDay))
    },
  }
}
