import { decimalField, importKeyOf, namedAccount, namedInstrument, optionalUnsigned, positiveDecimal, requiredDecimal } from './investmentFields'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS, TRADE_RECORDS } from './investmentKinds'
import { TRADE_SIDES } from './trade'
import type { Trade } from './trade'
import { words } from './words'
import { DECIMAL_ZERO } from '../../../../shared/money/decimal'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredChoice, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

/**
 * A buy or a sale. Its rate is read here, and whether it is filled exactly when the instrument quotes in a currency
 * other than the euro waits for the instrument, which reading the book checks.
 */
export function tradeOf(fields: StoredFields, id: RecordId | null): Trade {
  const price = requiredDecimal(fields, 'price')
  if (price < DECIMAL_ZERO) refuse(words.belowZero('price'))
  return {
    id: ownId(id),
    account: namedAccount(fields, 'account'),
    instrument: namedInstrument(fields, 'instrument'),
    side: requiredChoice(fields, 'side', TRADE_SIDES, 'side'),
    date: requiredDate(fields, 'date'),
    quantity: positiveDecimal(fields, 'quantity'),
    price,
    fees: optionalUnsigned(fields, 'fees'),
    rate: fields.rate === undefined ? null : positiveDecimal(fields, 'rate'),
    accrued: optionalUnsigned(fields, 'accrued'),
    importKey: importKeyOf(fields),
    note: textOf(fields.note),
  }
}

export const TRADE_CODEC: RecordCodec<Trade> = withIdField(TRADE_RECORDS, words.labels.trade, tradeOf, (trade) =>
  filledFields({
    account: keyOfRecordId(INVESTMENT_ACCOUNT_RECORDS, trade.account),
    instrument: keyOfRecordId(INSTRUMENT_RECORDS, trade.instrument),
    side: trade.side,
    date: trade.date,
    quantity: decimalField(trade.quantity),
    price: decimalField(trade.price),
    fees: decimalField(trade.fees),
    rate: decimalField(trade.rate),
    accrued: decimalField(trade.accrued),
    import_key: trade.importKey,
    note: trade.note,
  }),
)
