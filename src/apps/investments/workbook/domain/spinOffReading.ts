import { decimalField, importKeyOf, namedInstrument, positiveDecimal, requiredDecimal } from './investmentFields'
import { INSTRUMENT_RECORDS, SPIN_OFF_RECORDS } from './investmentKinds'
import type { SpinOff } from './spinOff'
import { words } from './words'
import { DECIMAL_ZERO, decimalOfText } from '../../../../shared/money/decimal'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

const WHOLE_COST = decimalOfText('1')!

export function spinOffOf(fields: StoredFields, id: RecordId | null): SpinOff {
  const instrument = namedInstrument(fields, 'instrument')
  const received = namedInstrument(fields, 'received')
  if (instrument === received) refuse(words.sameInstruments)
  const costShare = requiredDecimal(fields, 'cost_share')
  if (costShare < DECIMAL_ZERO || costShare > WHOLE_COST) refuse(words.costShareOutside(textOf(fields.cost_share)))
  return {
    id: ownId(id),
    instrument,
    received,
    date: requiredDate(fields, 'date'),
    quantity: positiveDecimal(fields, 'quantity'),
    costShare,
    importKey: importKeyOf(fields),
    note: textOf(fields.note),
  }
}

export const SPIN_OFF_CODEC: RecordCodec<SpinOff> = withIdField(SPIN_OFF_RECORDS, words.labels.spinOff, spinOffOf, (spinOff) =>
  filledFields({
    instrument: keyOfRecordId(INSTRUMENT_RECORDS, spinOff.instrument),
    received: keyOfRecordId(INSTRUMENT_RECORDS, spinOff.received),
    date: spinOff.date,
    quantity: decimalField(spinOff.quantity),
    cost_share: decimalField(spinOff.costShare),
    import_key: spinOff.importKey,
    note: spinOff.note,
  }),
)
