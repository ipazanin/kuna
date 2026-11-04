import { ASSET_RECORDS, VALUATION_RECORDS } from './assetKinds'
import type { Valuation } from './valuation'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { amountText, filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId, recordIdOf } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredDate, requiredMoney, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'
import { words } from './words'

/** The field in which a valuation names its asset by the asset's bare UUID, as the asset's own `id` field holds it. */
const ASSET_FIELD = 'asset'

export function valuationOf(fields: StoredFields, id: RecordId | null): Valuation {
  const asset = textOf(fields[ASSET_FIELD])
  if (asset === '') refuse(storedWords.reasons.none(ASSET_FIELD, ''))
  const value = requiredMoney(fields, 'value')
  if (value < 0) refuse(words.valueBelowZero)
  return { id: ownId(id), asset: recordIdOf(ASSET_RECORDS, asset), date: requiredDate(fields, 'date'), value, note: textOf(fields.note) }
}

export const VALUATION_CODEC: RecordCodec<Valuation> = withIdField(VALUATION_RECORDS, words.valuationLabel, valuationOf, (valuation) =>
  filledFields({
    [ASSET_FIELD]: keyOfRecordId(ASSET_RECORDS, valuation.asset),
    date: valuation.date,
    value: amountText(valuation.value),
    note: valuation.note,
  }),
)
