import { CLASS_OF_TYPE, TYPE_OF_QUOTING } from '../../workbook/domain/instrument'
import type { FundDistribution, Instrument, InstrumentClass, InstrumentType, PriceSource, Quoting } from '../../workbook/domain/instrument'
import { ISIN, MIC } from '../../workbook/domain/instrumentReading'
import { countryOf } from '../../workbook/domain/mixGroup'
import type { Sector } from '../../workbook/domain/mixGroup'
import { parseCivilDate } from '../../../../shared/calendar/civilDate'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import { decimalShown, typedDecimal } from '../../../../shared/money/decimal'
import type { RecordId } from '../../../../shared/storage/domain/recordId'

/** A holding's facts as its fields hold them. */
export interface InstrumentTexts {
  name: string
  symbol: string
  /** How its price reads, which limits its type. */
  quoted: Quoting['kind']
  /** A bond's yearly coupon in percent. Blank unless it is quoted in percent. */
  coupon: string
  /** A bond's maturity as a date. Blank unless it is quoted in percent. */
  maturity: string
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
  /** Blank for none. Read only for a fund. */
  distribution: FundDistribution | ''
  note: string
}

/**
 * What is wrong with one field of a holding. An ISIN another holding has already names that holding, and a type that
 * does not go with the quoting names the one that does.
 */
export type InstrumentFault =
  | { readonly kind: 'name' | 'symbol' | 'isin' | 'exchange' | 'currency' | 'ter' | 'coupon' | 'couponOfBond' | 'maturity' | 'maturityOfBond' }
  | { readonly kind: 'isinTaken'; readonly holder: string }
  | { readonly kind: 'quotedType'; readonly type: InstrumentType }

export type InstrumentFaults = Readonly<Record<'name' | 'type' | 'coupon' | 'maturity' | 'symbol' | 'isin' | 'exchange' | 'currency' | 'ter', InstrumentFault | null>>

/** The class the type holds, or null when the class field says, for a fund or an instrument with no type. */
export function classOfType(type: InstrumentType | ''): InstrumentClass | null {
  return type === '' ? null : CLASS_OF_TYPE[type]
}

/** The fields of an instrument, or of a new one priced by Twelve Data in euros. */
export function instrumentTexts(instrument: Omit<Instrument, 'id'> | null): InstrumentTexts {
  return {
    name: instrument?.name ?? '',
    symbol: instrument?.symbol ?? '',
    quoted: instrument?.quoted.kind ?? 'unit',
    coupon: instrument?.quoted.kind === 'percent' ? decimalShown(instrument.quoted.coupon) : '',
    maturity: instrument?.quoted.kind === 'percent' ? instrument.quoted.maturity : '',
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
    distribution: instrument?.distribution ?? '',
    note: instrument?.note ?? '',
  }
}

/** The one type a bond or gold quoting allows, or null for a quoting per unit. */
function typeOfQuoting(quoted: Quoting['kind']): InstrumentType | null {
  return quoted === 'unit' ? null : TYPE_OF_QUOTING[quoted]
}

/**
 * The fields with the way of quoting changed. A bond or gold takes its own type, and a quoting without a coupon leaves none.
 * Back to per unit, a type that only the earlier quoting set goes back to the instrument's own, blank for a new one.
 */
export function withQuoting(texts: InstrumentTexts, quoted: Quoting['kind'], ownType: InstrumentType | ''): InstrumentTexts {
  const setByQuoting = typeOfQuoting(texts.quoted) === texts.type
  return {
    ...texts,
    quoted,
    type: typeOfQuoting(quoted) ?? (setByQuoting ? ownType : texts.type),
    coupon: quoted === 'percent' ? texts.coupon : '',
    maturity: quoted === 'percent' ? texts.maturity : '',
  }
}

/** The quoting the fields describe, or null while a bond lacks its coupon or maturity. */
function quotingOfTexts(texts: InstrumentTexts): Quoting | null {
  if (texts.quoted !== 'percent') return { kind: texts.quoted }
  const coupon = typedDecimal(texts.coupon)
  const maturity = parseCivilDate(texts.maturity)
  return coupon === null || maturity === null ? null : { kind: 'percent', coupon, maturity }
}

/** What each field lacks, with an ISIN that one of the other instruments has already. */
export function instrumentFaults(texts: InstrumentTexts, others: readonly Instrument[]): InstrumentFaults {
  const isin = texts.isin.trim().toUpperCase()
  const sharing = isin === '' ? undefined : others.find((other) => other.isin === isin)
  const percent = texts.quoted === 'percent'
  const quotedType = typeOfQuoting(texts.quoted)
  return {
    name: texts.name.trim() === '' ? { kind: 'name' } : null,
    type: quotedType !== null && texts.type !== '' && texts.type !== quotedType ? { kind: 'quotedType', type: quotedType } : null,
    coupon: percent ? (typedDecimal(texts.coupon) === null ? { kind: 'coupon' } : null) : texts.coupon.trim() === '' ? null : { kind: 'couponOfBond' },
    maturity: percent ? (parseCivilDate(texts.maturity) === null ? { kind: 'maturity' } : null) : texts.maturity.trim() === '' ? null : { kind: 'maturityOfBond' },
    symbol: texts.symbol.trim() === '' ? { kind: 'symbol' } : null,
    isin: isin !== '' && !ISIN.test(isin) ? { kind: 'isin' } : sharing === undefined ? null : { kind: 'isinTaken', holder: sharing.name },
    exchange: texts.exchange.trim() !== '' && !MIC.test(texts.exchange.trim().toUpperCase()) ? { kind: 'exchange' } : null,
    currency: currencyCodeOf(texts.currency) === null ? { kind: 'currency' } : null,
    ter: texts.ter.trim() !== '' && typedDecimal(texts.ter) === null ? { kind: 'ter' } : null,
  }
}

/** What an instrument keeps that its fields do not show, from the record changed or a new one's start. */
export type UnshownFacts = Pick<Instrument, 'benchmark'>

/** The instrument the fields describe, or null while one of them is wrong. A blank source symbol takes the symbol. */
export function instrumentOfTexts(texts: InstrumentTexts, others: readonly Instrument[], id: RecordId, kept: UnshownFacts): Instrument | null {
  const currency = currencyCodeOf(texts.currency)
  const quoted = quotingOfTexts(texts)
  if (Object.values(instrumentFaults(texts, others)).some((fault) => fault !== null) || currency === null || quoted === null) return null
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
    quoted,
    prices: texts.prices,
    sourceSymbol: texts.prices === 'manual' ? '' : texts.sourceSymbol.trim() || symbol,
    benchmark: kept.benchmark,
    sector: texts.sector === '' ? null : texts.sector,
    country: countryOf(texts.country),
    ter: typedDecimal(texts.ter),
    distribution: texts.type === 'fund' && texts.distribution !== '' ? texts.distribution : null,
    note: texts.note.trim(),
  }
}
