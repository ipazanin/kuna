import { decimalField, importKeyOf, namedAccount, namedInstrument, positiveDecimal, requiredCurrency } from './investmentFields'
import { INSTRUMENT_RECORDS, INVESTMENT_ACCOUNT_RECORDS, TRANSFER_RECORDS } from './investmentKinds'
import type { Transfer } from './transfer'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'

function movedOf(fields: StoredFields): Transfer['moved'] {
  const units = fields.instrument !== undefined || fields.quantity !== undefined
  const cash = fields.currency !== undefined || fields.amount !== undefined
  if (units === cash) refuse(words.unitsOrCash)
  return units
    ? { kind: 'units', instrument: namedInstrument(fields, 'instrument'), quantity: positiveDecimal(fields, 'quantity') }
    : { kind: 'cash', currency: requiredCurrency(fields, 'currency'), amount: positiveDecimal(fields, 'amount') }
}

export function transferOf(fields: StoredFields, id: RecordId | null): Transfer {
  const from = namedAccount(fields, 'from')
  const to = namedAccount(fields, 'to')
  if (from === to) refuse(words.sameAccounts)
  return { id: ownId(id), from, to, date: requiredDate(fields, 'date'), moved: movedOf(fields), importKey: importKeyOf(fields), note: textOf(fields.note) }
}

export const TRANSFER_CODEC: RecordCodec<Transfer> = withIdField(TRANSFER_RECORDS, words.labels.transfer, transferOf, (transfer) =>
  filledFields({
    from: keyOfRecordId(INVESTMENT_ACCOUNT_RECORDS, transfer.from),
    to: keyOfRecordId(INVESTMENT_ACCOUNT_RECORDS, transfer.to),
    date: transfer.date,
    instrument: transfer.moved.kind === 'units' ? keyOfRecordId(INSTRUMENT_RECORDS, transfer.moved.instrument) : null,
    quantity: transfer.moved.kind === 'units' ? decimalField(transfer.moved.quantity) : null,
    currency: transfer.moved.kind === 'cash' ? transfer.moved.currency : null,
    amount: transfer.moved.kind === 'cash' ? decimalField(transfer.moved.amount) : null,
    import_key: transfer.importKey,
    note: transfer.note,
  }),
)
