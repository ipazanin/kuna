import { words } from './words'
import type { SearchedListing } from '../../prices/application/symbolSearch'
import { CLASS_OF_TYPE, INSTRUMENT_TYPES, PRICE_SOURCES, TYPE_OF_QUOTING } from '../../workbook/domain/instrument'
import type { Instrument, InstrumentClass, InstrumentType, PriceSource, Quoting } from '../../workbook/domain/instrument'
import { ISIN, MIC } from '../../workbook/domain/instrumentReading'
import { COUNTRY_CODES, REGIONS, SECTORS, countryOf } from '../../workbook/domain/mixGroup'
import type { Sector } from '../../workbook/domain/mixGroup'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import { countryName } from '../../../../shared/text/countryName'
import { naturalOrder } from '../../../../shared/text/naturalOrder'
import { decimalShown, typedDecimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A holding's facts as its fields hold them. */
export interface InstrumentTexts {
  name: string
  symbol: string
  /** Blank for none. */
  type: InstrumentType | ''
  /** Read only when the type holds no one class, as a fund does. */
  class: InstrumentClass
  isin: string
  exchange: string
  currency: string
  prices: PriceSource
  sourceSymbol: string
  /** Blank for none. */
  sector: Sector | ''
  /** A country code or a region, blank for none. */
  country: string
  ter: string
  note: string
}

/** Not set, then the types the quoting allows: only a bond is quoted in percent and only gold in grams. */
export function typeItems(quoted: Quoting['kind']): { readonly value: InstrumentType | ''; readonly label: string }[] {
  const allowed = quoted === 'unit' ? INSTRUMENT_TYPES : [TYPE_OF_QUOTING[quoted]]
  return [{ value: '', label: words.instrumentDialog.notSet }, ...allowed.map((value) => ({ value, label: words.types[value] }))]
}

/** The class the type holds, or null when the class field says, for a fund or an instrument with no type. */
export function classOfType(type: InstrumentType | ''): InstrumentClass | null {
  return type === '' ? null : CLASS_OF_TYPE[type]
}

export const SECTOR_ITEMS: { readonly value: Sector; readonly label: string }[] = SECTORS.map((value) => ({ value, label: words.sectors[value] }))

/** The regions, then the countries by name with their code, so a search finds either. */
export const COUNTRY_ITEMS: { readonly value: string; readonly label: string }[] = [
  ...REGIONS.map((value) => ({ value, label: words.regions[value] })),
  ...COUNTRY_CODES.map((value) => ({ value, label: `${countryName(value)} (${value})` })).sort((left, right) => naturalOrder(left.label, right.label)),
]

export interface InstrumentErrors {
  readonly name: string | null
  readonly symbol: string | null
  readonly isin: string | null
  readonly exchange: string | null
  readonly currency: string | null
  readonly ter: string | null
}

/** The fields of an instrument, or of a new one priced by Twelve Data in euros. */
export function instrumentTexts(instrument: Omit<Instrument, 'id'> | null): InstrumentTexts {
  return {
    name: instrument?.name ?? '',
    symbol: instrument?.symbol ?? '',
    type: instrument?.type ?? '',
    class: instrument?.class ?? 'stocks',
    isin: instrument?.isin ?? '',
    exchange: instrument?.exchange ?? '',
    currency: instrument?.currency ?? EURO,
    prices: instrument?.prices ?? 'twelvedata',
    sourceSymbol: instrument?.sourceSymbol ?? '',
    sector: instrument?.sector ?? '',
    country: instrument?.country ?? '',
    ter: decimalShown(instrument?.ter ?? null),
    note: instrument?.note ?? '',
  }
}

/** What each field lacks, with an ISIN that one of the other instruments has already. */
export function instrumentErrors(texts: InstrumentTexts, others: readonly Instrument[]): InstrumentErrors {
  const text = words.instrumentDialog
  const isin = texts.isin.trim().toUpperCase()
  const sharing = isin === '' ? undefined : others.find((other) => other.isin === isin)
  return {
    name: texts.name.trim() === '' ? text.errors.name : null,
    symbol: texts.symbol.trim() === '' ? text.errors.symbol : null,
    isin: isin !== '' && !ISIN.test(isin) ? text.errors.isin : sharing === undefined ? null : text.errors.isinTaken(sharing.name),
    exchange: texts.exchange.trim() !== '' && !MIC.test(texts.exchange.trim().toUpperCase()) ? text.errors.exchange : null,
    currency: currencyCodeOf(texts.currency) === null ? text.errors.currency : null,
    ter: texts.ter.trim() !== '' && typedDecimal(texts.ter) === null ? text.errors.ter : null,
  }
}

export function hasInstrumentErrors(errors: InstrumentErrors): boolean {
  return Object.values(errors).some((error) => error !== null)
}

/**
 * The fields with a listing a search found: its symbol where none is typed, its name where none is typed, the type
 * its vendor's words propose where the quoting allows it, and its market's code and currency where the vendor gives
 * them. Where a vendor that found it gives its closes on a free key, that vendor becomes the price source with the
 * listing's symbol at the source, the source already chosen first. Otherwise the price source stays as it was.
 */
export function withListing(texts: InstrumentTexts, listing: SearchedListing, quoted: Quoting['kind']): InstrumentTexts {
  const sources = listing.sources.flatMap((vendorId) => PRICE_SOURCES.filter((known) => known === vendorId))
  const source = sources.find((known) => known === texts.prices) ?? sources[0]
  const proposed = listing.proposedType
  return {
    ...texts,
    symbol: texts.symbol.trim() === '' ? listing.symbol : texts.symbol,
    name: texts.name.trim() === '' ? listing.name : texts.name,
    type: proposed !== null && typeItems(quoted).some((item) => item.value === proposed) ? proposed : texts.type,
    exchange: listing.mic ?? texts.exchange,
    currency: listing.currency !== null && currencyCodeOf(listing.currency) !== null ? listing.currency : texts.currency,
    ...(source === undefined ? {} : { prices: source, sourceSymbol: listing.symbol }),
  }
}

/** What an instrument keeps that its fields do not show, from the record changed or a new one's start. */
export type UnshownFacts = Pick<Instrument, 'quoted' | 'benchmark'>

/** The instrument the fields describe, or null while one of them has an error. A blank source symbol takes the symbol. */
export function instrumentOfTexts(texts: InstrumentTexts, others: readonly Instrument[], id: RecordId, kept: UnshownFacts): Instrument | null {
  const currency = currencyCodeOf(texts.currency)
  if (hasInstrumentErrors(instrumentErrors(texts, others)) || currency === null) return null
  const symbol = texts.symbol.trim()
  return {
    id,
    name: texts.name.trim(),
    type: texts.type === '' ? null : texts.type,
    class: classOfType(texts.type) ?? texts.class,
    isin: texts.isin.trim() === '' ? null : texts.isin.trim().toUpperCase(),
    symbol,
    exchange: texts.exchange.trim() === '' ? null : texts.exchange.trim().toUpperCase(),
    currency,
    quoted: kept.quoted,
    prices: texts.prices,
    sourceSymbol: texts.prices === 'manual' ? '' : texts.sourceSymbol.trim() || symbol,
    benchmark: kept.benchmark,
    sector: texts.sector === '' ? null : texts.sector,
    country: countryOf(texts.country),
    ter: typedDecimal(texts.ter),
    note: texts.note.trim(),
  }
}
