import { importKeyOf, namedInstrument } from './investmentFields'
import { INSTRUMENT_RECORDS, SPLIT_RECORDS } from './investmentKinds'
import type { Split } from './split'
import { words } from './words'
import { withIdField } from '../../../../shared/storage/domain/recordCodec'
import type { RecordCodec } from '../../../../shared/storage/domain/recordCodec'
import { filledFields } from '../../../../shared/storage/domain/recordFields'
import { keyOfRecordId } from '../../../../shared/storage/domain/recordId'
import type { RecordId } from '../../../../shared/storage/domain/recordId'
import { ownId, refuse, requiredDate, textOf } from '../../../../shared/storage/domain/storedFields'
import type { StoredFields } from '../../../../shared/storage/domain/storedFields'
import { words as storedWords } from '../../../../shared/storage/domain/words'

const WHOLE = /^[1-9]\d*$/

/** A whole number above zero, read from its text so a ratio stays exact. */
function unitsOf(fields: StoredFields, name: string): number {
  const text = textOf(fields[name])
  if (text === '') refuse(storedWords.reasons.none(name, ''))
  return WHOLE.test(text) && Number.isSafeInteger(Number(text)) ? Number(text) : refuse(words.notAWholeNumber(name, text))
}

export function splitOf(fields: StoredFields, id: RecordId | null): Split {
  const newUnits = unitsOf(fields, 'new')
  const oldUnits = unitsOf(fields, 'old')
  if (newUnits === oldUnits) refuse(words.noSplit)
  return {
    id: ownId(id),
    instrument: namedInstrument(fields, 'instrument'),
    date: requiredDate(fields, 'date'),
    newUnits,
    oldUnits,
    importKey: importKeyOf(fields),
    note: textOf(fields.note),
  }
}

export const SPLIT_CODEC: RecordCodec<Split> = withIdField(SPLIT_RECORDS, words.labels.split, splitOf, (split) =>
  filledFields({
    instrument: keyOfRecordId(INSTRUMENT_RECORDS, split.instrument),
    date: split.date,
    new: String(split.newUnits),
    old: String(split.oldUnits),
    import_key: split.importKey,
    note: split.note,
  }),
)
