import type { HandPrice } from './handPrice'
import { decimalField, namedInstrument, positiveDecimal } from './investmentFields'
import { INSTRUMENT_RECORDS, PRICE_RECORDS } from './investmentKinds'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

export function handPriceOf(fields: StoredFields, id: RecordId | null): HandPrice {
  return {
    id: ownId(id),
    instrument: namedInstrument(fields, 'instrument'),
    date: requiredDate(fields, 'date'),
    price: positiveDecimal(fields, 'price'),
    note: textOf(fields.note),
  }
}

export const HAND_PRICE_CODEC: RecordCodec<HandPrice> = withIdField(PRICE_RECORDS, words.labels.price, handPriceOf, (price) =>
  filledFields({
    instrument: keyOfRecordId(INSTRUMENT_RECORDS, price.instrument),
    date: price.date,
    price: decimalField(price.price),
    note: price.note,
  }),
)
