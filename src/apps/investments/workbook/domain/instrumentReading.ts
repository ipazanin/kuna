import { CLASS_OF_TYPE, FUND_DISTRIBUTIONS, INSTRUMENT_CLASSES, INSTRUMENT_TYPES, PRICE_SOURCES, TYPE_OF_QUOTING } from './instrument'
import type { FundDistribution, Instrument, InstrumentClass, InstrumentType, Quoting } from './instrument'
import { decimalField, optionalCountry, optionalUnsigned, requiredCurrency } from './investmentFields'
import { INSTRUMENT_RECORDS } from './investmentKinds'
import { SECTORS } from './mixGroup'
import type { Sector } from './mixGroup'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { booleanOf, optionalDate, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

const QUOTINGS = ['unit', 'percent', 'gram'] as const

/** Two letters of the country, nine of the security and a check digit. */
export const ISIN = /^[A-Z]{2}[A-Z0-9]{9}\d$/
/** A market identifier code, ISO 10383. */
export const MIC = /^[A-Z0-9]{4}$/

function requiredText(fields: StoredFields, name: string): string {
  const text = textOf(fields[name])
  return text === '' ? refuse(storedWords.reasons.none(name, '')) : text
}

function optionalMatching(fields: StoredFields, name: string, pattern: RegExp, refusal: (text: string) => string): string | null {
  const text = textOf(fields[name]).toUpperCase()
  if (text === '') return null
  return pattern.test(text) ? text : refuse(refusal(textOf(fields[name])))
}

function quotingOf(fields: StoredFields): Quoting {
  const kind = requiredChoice(fields, 'quoted', QUOTINGS, 'way of quoting')
  const coupon = optionalUnsigned(fields, 'coupon')
  const maturity = optionalDate(fields, 'maturity')
  if (kind !== 'percent') {
    return coupon === null && maturity === null ? { kind } : refuse(words.bondFieldsWithout)
  }
  return {
    kind,
    coupon: coupon ?? refuse(storedWords.reasons.none('coupon', '')),
    maturity: maturity ?? refuse(storedWords.reasons.noDate('maturity')),
  }
}

/** Blank is false, so only the benchmark carries the field. */
function benchmarkFlag(fields: StoredFields): boolean {
  const field = fields.benchmark
  return field === undefined ? false : (booleanOf(field) ?? refuse(words.notAFlag('benchmark', field.text)))
}

function optionalSector(fields: StoredFields): Sector | null {
  return textOf(fields.sector) === '' ? null : requiredChoice(fields, 'sector', SECTORS, 'sector')
}

/** Blank until typed. A type that holds one class needs that class, and a bond quoted in percent or gold in grams needs its own type. */
function optionalType(fields: StoredFields, instrumentClass: InstrumentClass, quoted: Quoting): InstrumentType | null {
  const type = textOf(fields.type) === '' ? null : requiredChoice(fields, 'type', INSTRUMENT_TYPES, 'type')
  if (type === null) return null
  const held = CLASS_OF_TYPE[type]
  if (held !== null && held !== instrumentClass) refuse(words.typeOfOtherClass(type, held))
  if (quoted.kind !== 'unit' && TYPE_OF_QUOTING[quoted.kind] !== type) refuse(words.quotingOfOtherType(quoted.kind, TYPE_OF_QUOTING[quoted.kind]))
  return type
}

/** Blank until typed, and refused on anything but a fund. */
function optionalDistribution(fields: StoredFields, type: InstrumentType | null): FundDistribution | null {
  if (textOf(fields.distribution) === '') return null
  const distribution = requiredChoice(fields, 'distribution', FUND_DISTRIBUTIONS, 'distribution')
  return type === 'fund' ? distribution : refuse(words.distributionOfFundOnly)
}

export function instrumentOf(fields: StoredFields, id: RecordId | null): Instrument {
  const prices = requiredChoice(fields, 'prices', PRICE_SOURCES, 'price source')
  const sourceSymbol = textOf(fields.source_symbol)
  if (prices === 'manual' && sourceSymbol !== '') refuse(words.sourceSymbolByHand)
  if (prices !== 'manual' && sourceSymbol === '') refuse(storedWords.reasons.none('source_symbol', ''))
  const read = {
    id: ownId(id),
    name: requiredText(fields, 'name'),
    class: requiredChoice(fields, 'class', INSTRUMENT_CLASSES, 'class'),
    isin: optionalMatching(fields, 'isin', ISIN, words.notAnIsin),
    symbol: requiredText(fields, 'symbol'),
    exchange: optionalMatching(fields, 'exchange', MIC, words.notAnExchange),
    currency: requiredCurrency(fields, 'currency'),
    quoted: quotingOf(fields),
    prices,
    sourceSymbol,
    benchmark: benchmarkFlag(fields),
    sector: optionalSector(fields),
    country: optionalCountry(fields, 'country'),
    ter: optionalUnsigned(fields, 'ter'),
    note: textOf(fields.note),
  }
  const type = optionalType(fields, read.class, read.quoted)
  return { ...read, type, distribution: optionalDistribution(fields, type) }
}

export const INSTRUMENT_CODEC: RecordCodec<Instrument> = withIdField(
  INSTRUMENT_RECORDS,
  (fields) => labelWords([textOf(fields.name), textOf(fields.symbol)]),
  instrumentOf,
  (instrument) =>
    filledFields({
      name: instrument.name,
      type: instrument.type,
      class: instrument.class,
      isin: instrument.isin,
      symbol: instrument.symbol,
      exchange: instrument.exchange,
      currency: instrument.currency,
      quoted: instrument.quoted.kind,
      coupon: instrument.quoted.kind === 'percent' ? decimalField(instrument.quoted.coupon) : null,
      maturity: instrument.quoted.kind === 'percent' ? instrument.quoted.maturity : null,
      prices: instrument.prices,
      source_symbol: instrument.sourceSymbol,
      benchmark: instrument.benchmark ? true : null,
      sector: instrument.sector,
      country: instrument.country,
      ter: decimalField(instrument.ter),
      distribution: instrument.distribution,
      note: instrument.note,
    }),
)
