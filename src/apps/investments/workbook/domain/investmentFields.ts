import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS } from './investmentKinds'
import { words } from './words'
import { EURO, currencyCodeOf } from '../../../../shared/money/currencyCode'
import type { CurrencyCode } from '../../../../shared/money/currencyCode'
import { DECIMAL_ZERO, decimalOfText, decimalText } from '../../../../shared/money/decimal'
import type { Decimal } from '../../../../shared/money/decimal'
import { recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordKind } from '../../../../shared/storage/domain/recordKind'
import { refuse, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

/** A decimal read from the field's text, never through a JavaScript number, or null for a blank field. */
export function optionalDecimal(fields: StoredFields, name: string): Decimal | null {
  const field = fields[name]
  if (field === undefined) return null
  return decimalOfText(field.text) ?? refuse(words.notADecimal(name, field.text))
}

export function requiredDecimal(fields: StoredFields, name: string): Decimal {
  return optionalDecimal(fields, name) ?? refuse(storedWords.reasons.none(name, ''))
}

export function positiveDecimal(fields: StoredFields, name: string): Decimal {
  const value = requiredDecimal(fields, name)
  return value > DECIMAL_ZERO ? value : refuse(storedWords.reasons.notAboveZero(name))
}

/** Zero or more, or null for a blank field. */
export function optionalUnsigned(fields: StoredFields, name: string): Decimal | null {
  const value = optionalDecimal(fields, name)
  return value === null || value >= DECIMAL_ZERO ? value : refuse(words.belowZero(name))
}

/** A decimal as the record stores it, or blank for none. */
export function decimalField(value: Decimal | null): string {
  return value === null ? '' : decimalText(value)
}

export function requiredCurrency(fields: StoredFields, name: string): CurrencyCode {
  const text = textOf(fields[name])
  if (text === '') refuse(storedWords.reasons.none(name, ''))
  return currencyCodeOf(text) ?? refuse(words.notACurrency(name, text))
}

/** Units of the currency per euro, above zero, filled exactly when the currency is not the euro. */
export function rateFor(fields: StoredFields, currency: CurrencyCode): Decimal | null {
  if (currency === EURO) {
    return fields.rate === undefined ? null : refuse(words.rateForEuros)
  }
  return fields.rate === undefined ? refuse(words.noRate(currency)) : positiveDecimal(fields, 'rate')
}

function namedId(fields: StoredFields, field: string, kind: RecordKind): RecordId {
  const key = textOf(fields[field])
  return key === '' ? refuse(storedWords.reasons.none(field, '')) : recordIdOf(kind, key)
}

/** The account a record names by the account's bare UUID in `field`. */
export function namedAccount(fields: StoredFields, field: string): RecordId {
  return namedId(fields, field, INVESTMENT_ACCOUNT_RECORDS)
}

/** The instrument a record names by the instrument's bare UUID in `field`. */
export function namedInstrument(fields: StoredFields, field: string): RecordId {
  return namedId(fields, field, INSTRUMENT_RECORDS)
}

/** The key of the imported rows a record came from, or null for one typed in. */
export function importKeyOf(fields: StoredFields): string | null {
  const key = textOf(fields.import_key)
  return key === '' ? null : key
}
