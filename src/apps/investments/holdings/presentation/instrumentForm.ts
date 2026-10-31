import { words } from './words'
import type { Instrument, InstrumentClass, PriceSource } from '../../workbook/domain/instrument'
import { ISIN, MIC } from '../../workbook/domain/instrumentReading'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A holding's facts as its fields hold them. */
export interface InstrumentTexts {
  name: string
  symbol: string
  class: InstrumentClass
  isin: string
  exchange: string
  currency: string
  prices: PriceSource
  sourceSymbol: string
  note: string
}

export interface InstrumentErrors {
  readonly name: string | null
  readonly symbol: string | null
  readonly isin: string | null
  readonly exchange: string | null
  readonly currency: string | null
}

/** The fields of an instrument, or of a new one priced by Twelve Data in euros. */
export function instrumentTexts(instrument: Omit<Instrument, 'id'> | null): InstrumentTexts {
  return {
    name: instrument?.name ?? '',
    symbol: instrument?.symbol ?? '',
    class: instrument?.class ?? 'stocks',
    isin: instrument?.isin ?? '',
    exchange: instrument?.exchange ?? '',
    currency: instrument?.currency ?? EURO,
    prices: instrument?.prices ?? 'twelvedata',
    sourceSymbol: instrument?.sourceSymbol ?? '',
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
  }
}

export function hasInstrumentErrors(errors: InstrumentErrors): boolean {
  return Object.values(errors).some((error) => error !== null)
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
    class: texts.class,
    isin: texts.isin.trim() === '' ? null : texts.isin.trim().toUpperCase(),
    symbol,
    exchange: texts.exchange.trim() === '' ? null : texts.exchange.trim().toUpperCase(),
    currency,
    quoted: kept.quoted,
    prices: texts.prices,
    sourceSymbol: texts.prices === 'manual' ? '' : texts.sourceSymbol.trim() || symbol,
    benchmark: kept.benchmark,
    note: texts.note.trim(),
  }
}
