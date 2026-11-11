import { words } from './words'
import type { SearchedListing } from '../../prices/application/symbolSearch'
import type { InstrumentTexts } from '../domain/instrumentDraft'
import { FUND_DISTRIBUTIONS, INSTRUMENT_TYPES, PRICE_SOURCES, TYPE_OF_QUOTING } from '../../workbook/domain/instrument'
import type { FundDistribution, InstrumentType, Quoting } from '../../workbook/domain/instrument'
import { COUNTRY_CODES, REGIONS, SECTORS } from '../../workbook/domain/mixGroup'
import type { Sector } from '../../workbook/domain/mixGroup'
import { currencyCodeOf } from '../../../../shared/money/currencyCode'
import { countryName } from '../../../../shared/text/countryName'
import { naturalOrder } from '../../../../shared/text/naturalOrder'

/** The value of a list's Not set row, since a list item cannot carry a blank value. No type, sector, country or record id is a dash. */
export const NOT_SET = '-' as const

/** The types the quoting allows: only a bond is quoted in percent and only gold in grams. */
export function typeItems(quoted: Quoting['kind']): { readonly value: InstrumentType; readonly label: string }[] {
  const allowed = quoted === 'unit' ? INSTRUMENT_TYPES : [TYPE_OF_QUOTING[quoted]]
  return allowed.map((value) => ({ value, label: words.types[value] }))
}

export const DISTRIBUTION_ITEMS: { readonly value: FundDistribution; readonly label: string }[] = FUND_DISTRIBUTIONS.map((value) => ({ value, label: words.distributions[value] }))

export const SECTOR_ITEMS: { readonly value: Sector; readonly label: string }[] = SECTORS.map((value) => ({ value, label: words.sectors[value] }))

/** The regions, then the countries by name with their code, so a search finds either. */
export const COUNTRY_ITEMS: { readonly value: string; readonly label: string }[] = [
  ...REGIONS.map((value) => ({ value, label: words.regions[value] })),
  ...COUNTRY_CODES.map((value) => ({ value, label: `${countryName(value)} (${value})` })).sort((left, right) => naturalOrder(left.label, right.label)),
]

/**
 * The fields with a listing a search found: its symbol where none is typed, its name where none is typed, the type
 * its vendor's words propose where the quoting allows it, and its market's code and currency where the vendor gives
 * them. Where a vendor that found it gives its closes on a free key, that vendor becomes the price source with the
 * listing's symbol at the source, the source already chosen first. Otherwise the price source stays as it was.
 */
export function withListing(texts: InstrumentTexts, listing: SearchedListing): InstrumentTexts {
  const sources = listing.sources.flatMap((vendorId) => PRICE_SOURCES.filter((known) => known === vendorId))
  const source = sources.find((known) => known === texts.prices) ?? sources[0]
  const proposed = listing.proposedType
  return {
    ...texts,
    symbol: texts.symbol.trim() === '' ? listing.symbol : texts.symbol,
    name: texts.name.trim() === '' ? listing.name : texts.name,
    type: proposed !== null && typeItems(texts.quoted).some((item) => item.value === proposed) ? proposed : texts.type,
    exchange: listing.mic ?? texts.exchange,
    currency: listing.currency !== null && currencyCodeOf(listing.currency) !== null ? listing.currency : texts.currency,
    ...(source === undefined ? {} : { prices: source, sourceSymbol: listing.symbol }),
  }
}
