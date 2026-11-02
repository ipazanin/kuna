import { seriesKey } from './pricesFile'
import type { FetchedFacts } from './pricesFile'
import { sectorOfFundSector, sectorOfIndustry, typeOfListing } from './vendorWords'
import type { Instrument, InstrumentType } from '../../workbook/domain/instrument'
import { countryOf } from '../../workbook/domain/mixGroup'
import type { Country, Sector } from '../../workbook/domain/mixGroup'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import type { CivilDate } from '../../../../shared/calendar/civilDate'
import { DECIMAL_ZERO, addDecimal, decimalOfText, scaledDecimal } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'

/** A company's sector and home country from its profile, each null where the profile does not say or Kuna does not know the vendor's word. */
export interface ProfileFacts {
  readonly sector: Sector | null
  readonly country: Country | null
}

/** The part of a fund in one sector, in percent of the fund. */
export interface SectorWeight {
  readonly sector: Sector
  readonly percent: Decimal
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
  profileOf(instrument: Instrument): ProfileFacts
  /** Empty where no vendor gave weights Kuna can read. */
  sectorWeightsOf(instrument: Instrument): readonly SectorWeight[]
  /** Oldest payment first. */
  announcedOf(instrument: Instrument): readonly AnnouncedDividend[]
}

const NO_PROFILE: ProfileFacts = { sector: null, country: null }

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

/** The first fact, by key, that a vendor gave for the instrument. */
function factFor<Fact>(facts: Readonly<Record<string, Fact>>, matches: (vendorId: string, asked: string) => boolean): Fact | null {
  const key = Object.keys(facts)
    .sort()
    .find((candidate) => {
      const { vendorId, asked } = keyParts(candidate)
      return matches(vendorId, asked)
    })
  return key === undefined ? null : facts[key]!
}

const PERCENT = 100n

/** The facts kept in the prices file, read in the vendors' words through the tables of `vendorWords.ts`. */
export function fetchedFactsBook(facts: FetchedFacts): FactsBook {
  const bySymbol = (instrument: Instrument) => (vendorId: string, asked: string) => asked === vendorSymbolOf(instrument, vendorId)
  return {
    typeOf(instrument) {
      if (instrument.type !== null) {
        return instrument.type
      }
      const key = typeKeyOf(instrument)
      const word = key === null ? null : (facts.types[key]?.type ?? null)
      return word === null ? null : typeOfListing(word)
    },
    profileOf(instrument) {
      const query = profileQueryOf(instrument)
      const profile = factFor(facts.profiles, (_vendorId, asked) => asked === query)
      if (profile === null) {
        return NO_PROFILE
      }
      return { sector: profile.industry === null ? null : sectorOfIndustry(profile.industry), country: profile.country === null ? null : countryOf(profile.country) }
    },
    sectorWeightsOf(instrument) {
      const weights = new Map<Sector, Decimal>()
      for (const [name, weight] of factFor(facts.sectors, bySymbol(instrument))?.sectors ?? []) {
        const sector = sectorOfFundSector(name)
        const fraction = decimalOfText(weight)
        if (sector !== null && fraction !== null && fraction > DECIMAL_ZERO) {
          weights.set(sector, addDecimal(weights.get(sector) ?? DECIMAL_ZERO, scaledDecimal(fraction, PERCENT, 1n)))
        }
      }
      return [...weights].map(([sector, percent]) => ({ sector, percent }))
    },
    announcedOf(instrument) {
      return (factFor(facts.dividends, bySymbol(instrument))?.dividends ?? [])
        .map(([exDay, paymentDay, amount]) => ({ exDay: parseCivilDate(exDay)!, paymentDay: parseCivilDate(paymentDay)!, amount: decimalOfText(amount)! }))
        .sort((earlier, later) => earlier.paymentDay.localeCompare(later.paymentDay))
    },
  }
}
