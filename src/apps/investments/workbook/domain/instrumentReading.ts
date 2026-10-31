import { INSTRUMENT_CLASSES, PRICE_SOURCES } from './instrument'
import type { Instrument, Quoting } from './instrument'
import { decimalField, optionalUnsigned, requiredCurrency } from './investmentFields'
import { INSTRUMENT_RECORDS } from './investmentKinds'
import { words } from './words'
import { labelWords, withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { optionalDate, ownId, refuse, requiredChoice, textOf } from '../../../../shared/storage/domain/storedFields'
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

export function instrumentOf(fields: StoredFields, id: RecordId | null): Instrument {
  const prices = requiredChoice(fields, 'prices', PRICE_SOURCES, 'price source')
  const sourceSymbol = textOf(fields.source_symbol)
  if (prices === 'manual' && sourceSymbol !== '') refuse(words.sourceSymbolByHand)
  if (prices !== 'manual' && sourceSymbol === '') refuse(storedWords.reasons.none('source_symbol', ''))
  return {
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
    note: textOf(fields.note),
  }
}

export const INSTRUMENT_CODEC: RecordCodec<Instrument> = withIdField(
  INSTRUMENT_RECORDS,
  (fields) => labelWords([textOf(fields.name), textOf(fields.symbol)]),
  instrumentOf,
  (instrument) =>
    filledFields({
      name: instrument.name,
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
      note: instrument.note,
    }),
)
